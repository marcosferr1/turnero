import { config } from "../config";
import { prisma } from "../prisma";
import { getBotContext } from "./context";
import { setPendingChoices } from "./pendingChoices";
import { sendTwilioWhatsApp } from "./twilioApi";
import { twilioFromForDoctor } from "./doctorSend";
import { sendBaileysText } from "./baileys";

export interface ListRow {
  id: string;
  title: string; // máx 24 caracteres (límite de Meta)
  description?: string; // máx 72 caracteres
}

export interface Button {
  id: string;
  title: string; // máx 20 caracteres
}

/** Mensaje saliente capturado en modo simulador. */
export interface SimMessage {
  kind: "text" | "list" | "buttons" | "template";
  text: string;
  options?: { id: string; title: string; description?: string }[];
}

const simulatorOutbox: { phone: string; message: SimMessage }[] = [];

export function outboxLength(): number {
  return simulatorOutbox.length;
}

export function outboxSince(index: number, phone: string): SimMessage[] {
  return simulatorOutbox
    .slice(index)
    .filter((m) => m.phone === phone)
    .map((m) => m.message);
}

async function logOut(phone: string, type: string, content: string) {
  const ctx = getBotContext();
  await prisma.messageLog.create({
    data: { phone, doctorId: ctx.doctorId, direction: "OUT", type, content },
  });
}

/** Argentina: webhook envía 549XXXXXXXXX; la API de Meta espera 54XXXXXXXXX. */
function toWhatsAppApiPhone(phone: string): string {
  if (phone.startsWith("549") && phone.length >= 12) {
    return "54" + phone.slice(3);
  }
  return phone;
}

function formatNumberedList(body: string, rows: ListRow[]): string {
  const lines = rows.map((r, i) => {
    const desc = r.description ? ` — ${r.description}` : "";
    return `${i + 1}. ${r.title}${desc}`;
  });
  return `${body}\n\n${lines.join("\n")}\n\n_Respondé con el número de la opción._`;
}

function formatNumberedButtons(body: string, buttons: Button[]): string {
  const lines = buttons.map((b, i) => `${i + 1}. ${b.title}`);
  return `${body}\n\n${lines.join("\n")}\n\n_Respondé con el número de la opción._`;
}

async function callBaileysApi(body: string): Promise<boolean> {
  const ctx = getBotContext();
  const ok = await sendBaileysText(ctx.patientPhone, body, ctx.patientJid);
  if (!ok) {
    console.error(`[whatsapp] Baileys no pudo enviar a ${ctx.patientJid ?? ctx.patientPhone}`);
  }
  return ok;
}

async function callTwilioApi(body: string): Promise<boolean> {
  const ctx = getBotContext();
  const doctor = await prisma.doctor.findUnique({ where: { id: ctx.doctorId } });
  if (!doctor) return false;
  const from = twilioFromForDoctor(doctor);
  return sendTwilioWhatsApp(ctx.patientPhone, body, from);
}

async function callCloudApi(payload: Record<string, unknown>): Promise<boolean> {
  const { apiVersion, token } = config.whatsapp;
  const phoneNumberId = getBotContext().phoneNumberId;
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const to = typeof payload.to === "string" ? toWhatsAppApiPhone(payload.to) : payload.to;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload, to }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[whatsapp] Error ${res.status} al enviar mensaje:`, body);
    return false;
  }
  return true;
}

export async function sendText(to: string, body: string): Promise<void> {
  await logOut(to, "text", body);
  if (config.whatsapp.mode === "simulator") {
    simulatorOutbox.push({ phone: to, message: { kind: "text", text: body } });
    return;
  }
  if (config.whatsapp.mode === "twilio") {
    await callTwilioApi(body);
    return;
  }
  if (config.whatsapp.mode === "baileys") {
    await callBaileysApi(body);
    return;
  }
  await callCloudApi({ to, type: "text", text: { body } });
}

export async function sendList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: ListRow[]
): Promise<void> {
  const limited = rows.slice(0, 10); // Meta permite máximo 10 filas
  await logOut(to, "interactive", `${body} [${limited.map((r) => r.title).join(" | ")}]`);
  if (config.whatsapp.mode === "simulator") {
    simulatorOutbox.push({
      phone: to,
      message: { kind: "list", text: body, options: limited },
    });
    return;
  }
  if (config.whatsapp.mode === "twilio") {
    setPendingChoices(to, getBotContext().doctorId, limited.map((r) => r.id));
    await callTwilioApi(formatNumberedList(body, limited));
    return;
  }
  if (config.whatsapp.mode === "baileys") {
    const ctx = getBotContext();
    setPendingChoices(to, ctx.doctorId, limited.map((r) => r.id));
    const textBody = formatNumberedList(body, limited);
    const textOk = await callBaileysApi(textBody);
    if (!textOk) {
      console.error("[whatsapp] Baileys no pudo enviar menú numerado.");
    }
    return;
  }
  await callCloudApi({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            title: "Opciones",
            rows: limited.map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              description: r.description?.slice(0, 72),
            })),
          },
        ],
      },
    },
  });
}

export async function sendButtons(to: string, body: string, buttons: Button[]): Promise<void> {
  const limited = buttons.slice(0, 3); // Meta permite máximo 3 botones
  await logOut(to, "interactive", `${body} [${limited.map((b) => b.title).join(" | ")}]`);
  if (config.whatsapp.mode === "simulator") {
    simulatorOutbox.push({
      phone: to,
      message: { kind: "buttons", text: body, options: limited },
    });
    return;
  }
  if (config.whatsapp.mode === "twilio") {
    setPendingChoices(to, getBotContext().doctorId, limited.map((b) => b.id));
    await callTwilioApi(formatNumberedButtons(body, limited));
    return;
  }
  if (config.whatsapp.mode === "baileys") {
    const ctx = getBotContext();
    setPendingChoices(to, ctx.doctorId, limited.map((b) => b.id));
    const textBody = formatNumberedButtons(body, limited);
    const textOk = await callBaileysApi(textBody);
    if (!textOk) {
      console.error("[whatsapp] Baileys no pudo enviar botones numerados.");
    }
    return;
  }
  await callCloudApi({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: limited.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * Envía una plantilla pre-aprobada de Meta (necesaria para mensajes fuera de la
 * ventana de 24 hs). En modo simulador envía el texto equivalente.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  params: string[],
  fallbackText: string
): Promise<void> {
  await logOut(to, "template", `[${templateName}] ${fallbackText}`);
  if (config.whatsapp.mode === "simulator") {
    simulatorOutbox.push({ phone: to, message: { kind: "template", text: fallbackText } });
    return;
  }
  if (config.whatsapp.mode === "twilio") {
    await callTwilioApi(fallbackText);
    return;
  }
  if (config.whatsapp.mode === "baileys") {
    await callBaileysApi(fallbackText);
    return;
  }
  if (config.whatsapp.useTemplates) {
    const sent = await callCloudApi({
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "es_AR" },
        components: [
          {
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: p })),
          },
        ],
      },
    });
    if (sent) return;
    console.warn(`[whatsapp] Plantilla "${templateName}" no disponible; enviando texto.`);
  }
  await callCloudApi({ to, type: "text", text: { body: fallbackText } });
}
