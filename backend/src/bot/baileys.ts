import path from "node:path";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  extractMessageContent,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
  getContentType,
  isJidUser,
  isLidUser,
  jidNormalizedUser,
  proto,
  useMultiFileAuthState,
  type WASocket,
  type proto as ProtoTypes,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { config } from "../config";
import { logQrForCloud } from "../lib/qrTerminal";
import { logBaileysQrHint, resetBaileysQrLogThrottle } from "../lib/baileysPairingUrl";
import { normalizeWhatsAppPhone } from "../lib/phoneNormalize";
import { resolvePendingChoice } from "./pendingChoices";
import { handlePatientMessage, resolveDoctorForBaileys } from "./dispatch";

let socket: WASocket | null = null;
let starting = false;
let pendingQr: string | null = null;
let baileysConnected = false;

export function getBaileysPairingState(): { qr: string | null; connected: boolean } {
  return { qr: pendingQr, connected: baileysConnected };
}

const messageStore = new Map<string, ProtoTypes.IMessage>();
/** Clave de conversación (teléfono o lid:…) → JID para responder. */
const patientJidByKey = new Map<string, string>();
/** LID @lid → teléfono real cuando WhatsApp lo expone en contactos. */
const lidToPhone = new Map<string, string>();

function conversationKey(phone: string): string {
  return phone.replace(/\D/g, "") || phone;
}

export function registerPatientJid(phone: string, jid: string): void {
  patientJidByKey.set(conversationKey(phone), jidNormalizedUser(jid));
}

export function phoneToJid(phone: string): string {
  return `${normalizeWhatsAppPhone(phone)}@s.whatsapp.net`;
}

function resolveReplyJid(phone: string, replyJid?: string): string {
  if (replyJid) return jidNormalizedUser(replyJid);
  const cached = patientJidByKey.get(conversationKey(phone));
  if (cached) return cached;
  return phoneToJid(phone);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs(): number {
  const { replyDelayMinMs, replyDelayMaxMs } = config.baileys;
  const min = Math.min(replyDelayMinMs, replyDelayMaxMs);
  const max = Math.max(replyDelayMinMs, replyDelayMaxMs);
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function setPresence(jid: string, presence: "composing" | "paused"): Promise<void> {
  if (!socket) return;
  try {
    await socket.sendPresenceUpdate(presence, jid);
  } catch {
    // presencia opcional; no bloquear el envío
  }
}

async function humanizeBeforeSend(jid: string): Promise<void> {
  if (!config.baileys.humanize) return;
  await setPresence(jid, "composing");
  await sleep(randomDelayMs());
}

export async function sendBaileysText(
  to: string,
  body: string,
  replyJid?: string
): Promise<boolean> {
  if (!socket) {
    console.error("[baileys] WhatsApp no conectado; no se puede enviar.");
    return false;
  }
  const jid = resolveReplyJid(to, replyJid);
  try {
    await humanizeBeforeSend(jid);
    await socket.sendMessage(jid, { text: body });
    console.log(`[baileys] Enviado a ${jid} (${body.length} chars)`);
    return true;
  } catch (err) {
    console.error(`[baileys] Error al enviar mensaje a ${jid}:`, err);
    return false;
  } finally {
    if (config.baileys.humanize) {
      await setPresence(jid, "paused");
    }
  }
}

function wrapViewOnce(inner: ProtoTypes.IMessage): ProtoTypes.IMessage {
  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        ...inner,
      },
    },
  };
}

const RELAY_TIMEOUT_MS = 8_000;

async function relayBaileysMessage(
  to: string,
  inner: ProtoTypes.IMessage,
  replyJid?: string,
  useViewOnce = false
): Promise<boolean> {
  if (!socket?.user?.id) {
    console.error("[baileys] WhatsApp no conectado; no se puede enviar interactivo.");
    return false;
  }
  const jid = resolveReplyJid(to, replyJid);
  const payload = useViewOnce ? wrapViewOnce(inner) : inner;
  try {
    const waMsg = generateWAMessageFromContent(jid, payload, {
      userJid: jidNormalizedUser(socket.user.id),
    });
    if (!waMsg.message || !waMsg.key.id) {
      console.error(`[baileys] No se pudo armar mensaje interactivo para ${jid}`);
      return false;
    }
    await Promise.race([
      socket.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("relay timeout")), RELAY_TIMEOUT_MS)
      ),
    ]);
    return true;
  } catch (err) {
    console.error(`[baileys] Error al enviar interactivo a ${jid}:`, err);
    return false;
  }
}

export interface BaileysListRow {
  id: string;
  title: string;
  description?: string;
}

export interface BaileysButton {
  id: string;
  title: string;
}

/** Lista nativa de WhatsApp (botón que despliega opciones). */
export async function sendBaileysList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: BaileysListRow[],
  replyJid?: string
): Promise<boolean> {
  const limited = rows.slice(0, 10);
  const listRows = limited.map((r) => ({
    id: r.id,
    title: r.title.slice(0, 24),
    description: (r.description ?? "").slice(0, 72),
  }));

  const nativeFlow = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: 1,
      buttons: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: buttonLabel.slice(0, 20),
            sections: [{ title: "Opciones", rows: listRows }],
          }),
        },
      ],
    }),
  });

  const classicList = proto.Message.ListMessage.create({
    description: body,
    buttonText: buttonLabel.slice(0, 20),
    listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
    sections: [
      {
        title: "Opciones",
        rows: listRows.map((r) => ({
          rowId: r.id,
          title: r.title,
          description: r.description || undefined,
        })),
      },
    ],
  });

  if (await relayBaileysMessage(to, { listMessage: classicList }, replyJid, true)) {
    return true;
  }

  return relayBaileysMessage(to, { interactiveMessage: nativeFlow }, replyJid, false);
}

/** Botones nativos de WhatsApp (máx. 3). */
export async function sendBaileysButtons(
  to: string,
  body: string,
  buttons: BaileysButton[],
  replyJid?: string
): Promise<boolean> {
  const limited = buttons.slice(0, 3);

  const nativeFlow = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: 1,
      buttons: limited.map((b) => ({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: b.title.slice(0, 20),
          id: b.id,
        }),
      })),
    }),
  });

  const classicButtons = proto.Message.ButtonsMessage.create({
    contentText: body,
    headerType: proto.Message.ButtonsMessage.HeaderType.EMPTY,
    buttons: limited.map((b) => ({
      buttonId: b.id,
      buttonText: { displayText: b.title.slice(0, 20) },
      type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
    })),
  });

  if (await relayBaileysMessage(to, { buttonsMessage: classicButtons }, replyJid, true)) {
    return true;
  }

  return relayBaileysMessage(to, { interactiveMessage: nativeFlow }, replyJid, false);
}

function phoneFromPnJid(jid: string): string {
  const user = jid.split("@")[0]?.split(":")[0] ?? "";
  return user ? normalizeWhatsAppPhone(user) : "";
}

function resolvePatientIdentity(remoteJid: string | null | undefined): {
  patientPhone: string;
  patientJid: string;
} | null {
  if (!remoteJid) return null;
  const patientJid = jidNormalizedUser(remoteJid);
  if (!patientJid || patientJid.endsWith("@g.us")) return null;

  if (isJidUser(patientJid)) {
    const patientPhone = phoneFromPnJid(patientJid);
    if (!patientPhone) return null;
    return { patientPhone, patientJid };
  }

  if (isLidUser(patientJid)) {
    const mappedPhone = lidToPhone.get(patientJid);
    const lidUser = patientJid.split("@")[0] ?? "";
    const patientPhone = mappedPhone ?? `lid:${lidUser}`;
    return { patientPhone, patientJid };
  }

  return null;
}

function extractIncoming(msg: ProtoTypes.IWebMessageInfo): { text?: string; interactiveId?: string } {
  if (!msg.message) return {};
  const content = extractMessageContent(msg.message);
  if (!content) return {};
  const type = getContentType(content);
  if (!type) return {};

  if (type === "conversation") {
    return { text: content.conversation || undefined };
  }
  if (type === "extendedTextMessage") {
    return { text: content.extendedTextMessage?.text ?? undefined };
  }
  if (type === "buttonsResponseMessage") {
    const id = content.buttonsResponseMessage?.selectedButtonId;
    return id ? { interactiveId: id } : {};
  }
  if (type === "listResponseMessage") {
    const id = content.listResponseMessage?.singleSelectReply?.selectedRowId;
    return id ? { interactiveId: id } : {};
  }
  if (type === "interactiveResponseMessage") {
    const paramsJson =
      content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (paramsJson) {
      try {
        const params = JSON.parse(paramsJson) as Record<string, string>;
        const id = params.id ?? params.selected_row_id ?? params.selectedRowId;
        if (id) return { interactiveId: id };
      } catch {
        // respuesta mal formada
      }
    }
  }
  return {};
}

async function onIncomingMessage(msg: ProtoTypes.IWebMessageInfo): Promise<void> {
  if (!msg.key || msg.key.fromMe || !msg.message) return;

  const identity = resolvePatientIdentity(msg.key.remoteJid);
  if (!identity) return;

  const { patientPhone, patientJid } = identity;
  registerPatientJid(patientPhone, patientJid);

  const doctor = await resolveDoctorForBaileys();
  if (!doctor) {
    console.warn("[baileys] No hay doctor activo configurado.");
    return;
  }

  let { text, interactiveId } = extractIncoming(msg);

  if (!interactiveId && text) {
    const fromChoice = resolvePendingChoice(patientPhone, doctor.id, text);
    if (fromChoice) {
      interactiveId = fromChoice;
      text = "";
    }
  }

  if (!text && !interactiveId) return;

  const label = isLidUser(patientJid) ? `${patientJid}` : `+${patientPhone}`;
  console.log(`[baileys] Mensaje de ${label}: ${interactiveId || text}`);
  await handlePatientMessage(patientPhone, doctor.id, { text, interactiveId }, patientJid);
}

function indexContactMapping(contact: { id?: string; lid?: string; jid?: string }): void {
  const lid = contact.lid ?? (contact.id?.endsWith("@lid") ? contact.id : undefined);
  const pnJid = contact.jid ?? (contact.id?.endsWith("@s.whatsapp.net") ? contact.id : undefined);
  if (!lid || !pnJid) return;
  const phone = phoneFromPnJid(pnJid);
  if (!phone) return;
  const lidJid = jidNormalizedUser(lid);
  lidToPhone.set(lidJid, phone);
  registerPatientJid(phone, lidJid);
}

async function connect(): Promise<void> {
  if (starting) return;
  starting = true;

  const authDir = path.resolve(process.cwd(), config.baileys.authDir);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    maxMsgRetryCount: 5,
    getMessage: async (key) => {
      if (!key.id) return undefined;
      return messageStore.get(key.id);
    },
  });

  socket = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("contacts.upsert", (contacts) => {
    for (const contact of contacts) indexContactMapping(contact);
  });

  sock.ev.on("contacts.update", (updates) => {
    for (const contact of updates) indexContactMapping(contact);
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      pendingQr = qr;
      if (config.isProduction && !config.baileys.qrSecret) {
        console.error("[baileys] QR generado pero BAILEYS_QR_SECRET no está configurado; /baileys/qr deshabilitado.");
        return;
      }
      if (config.publicUrl) {
        logBaileysQrHint();
      } else {
        logQrForCloud(qr, "[baileys] Escaneá este QR con WhatsApp → Dispositivos vinculados:");
      }
    }

    if (connection === "open") {
      starting = false;
      pendingQr = null;
      baileysConnected = true;
      resetBaileysQrLogThrottle();
      console.log(`[baileys] Conectado (+${config.baileys.phone}). Listo para recibir mensajes.`);
    }

    if (connection === "connecting") {
      console.log("[baileys] Conectando…");
    }

    if (connection === "close") {
      starting = false;
      socket = null;
      baileysConnected = false;
      pendingQr = null;
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.error("[baileys] Sesión cerrada. Ejecutá: rm -rf .baileys_auth && npm run dev");
        return;
      }
      if (code === 405) {
        console.error("[baileys] Error 405 (versión WhatsApp). Reintentando con versión actualizada…");
      } else {
        console.warn(`[baileys] Conexión cerrada (código ${code ?? "?"}). Reconectando en 5 s…`);
      }
      resetBaileysQrLogThrottle();
      setTimeout(() => {
        connect().catch((err) => console.error("[baileys] Error reconectando:", err));
      }, 5000);
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.id && msg.message) {
        messageStore.set(msg.key.id, msg.message);
      }
      onIncomingMessage(msg).catch((err) => console.error("[baileys] Error procesando mensaje:", err));
    }
  });

  starting = false;
}

export function startBaileys(): void {
  if (config.whatsapp.mode !== "baileys") return;
  console.log(`[baileys] Iniciando sesión para +${config.baileys.phone}…`);
  connect().catch((err) => console.error("[baileys] Error al iniciar:", err));
}
