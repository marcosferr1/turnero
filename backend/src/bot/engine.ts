import { prisma } from "../prisma";
import { formatDateHuman, todayStr } from "../lib/dates";
import { getAvailableDays, getSlotsForDate, getSlotMinutes } from "../services/slots";
import { notifySolicitudRecibida } from "../services/notifications";
import { logAppointmentEvent } from "../services/appointmentEvents";
import { isEmailSkipAnswer, isValidEmail } from "../lib/emailValidate";
import { getBotContext } from "./context";
import {
  sendText as waSendText,
  sendList as waSendList,
  sendButtons as waSendButtons,
} from "./whatsapp";
import { pickGreeting, pickMenuPrompt } from "./copy";

const CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000;
const RESET_WORDS = /^(menu|menú|hola|volver|inicio|empezar|cancelar)$/i;

export interface IncomingMessage {
  text?: string;
  interactiveId?: string;
}

interface ConvData {
  mode?: "avail" | "book";
  locationId?: number;
  date?: string;
  time?: string;
  slotOffset?: number;
  fullName?: string;
  dni?: string;
  insurance?: string;
  email?: string;
  motivo?: string;
  patientAddress?: string;
  cancelApptId?: number;
}

function convKey() {
  const { patientPhone, doctorId } = getBotContext();
  return { phone: patientPhone, doctorId };
}

/** Punto de entrada: procesa un mensaje entrante del paciente (contexto del doctor ya establecido). */
export async function handleIncoming(msg: IncomingMessage): Promise<void> {
  const { patientPhone, doctorId } = getBotContext();

  await prisma.messageLog.create({
    data: {
      phone: patientPhone,
      doctorId,
      direction: "IN",
      type: msg.interactiveId ? "interactive" : "text",
      content: msg.interactiveId || msg.text || "",
    },
  });

  let conv = await prisma.conversation.findUnique({ where: { phone_doctorId: convKey() } });
  const expired = conv && Date.now() - conv.updatedAt.getTime() > CONVERSATION_TIMEOUT_MS;
  if (!conv) {
    conv = await prisma.conversation.create({ data: { ...convKey(), state: "MENU", data: {} } });
    await sendGreeting();
    return;
  }
  if (expired) {
    await setState("MENU", {});
    await sendGreeting();
    return;
  }

  const text = (msg.text || "").trim();
  const optionId = msg.interactiveId;

  if (!optionId && RESET_WORDS.test(text)) {
    await setState("MENU", {});
    await sendMainMenu();
    return;
  }

  const data = (conv.data || {}) as ConvData;

  try {
    switch (conv.state) {
      case "MENU":
        await handleMenu(optionId, text);
        break;
      case "INFO_LIST":
        await handleInfoList(optionId);
        break;
      case "SELECT_LOCATION":
        await handleSelectLocation(data, optionId);
        break;
      case "SELECT_DAY":
        await handleSelectDay(data, optionId);
        break;
      case "SELECT_SLOT":
        await handleSelectSlot(data, optionId);
        break;
      case "ASK_NAME":
        await handleAskName(data, text);
        break;
      case "ASK_DNI":
        await handleAskDni(data, text);
        break;
      case "ASK_INSURANCE":
        await handleAskInsurance(data, text);
        break;
      case "ASK_EMAIL":
        await handleAskEmail(data, text);
        break;
      case "ASK_MOTIVO":
        await handleAskMotivo(data, text);
        break;
      case "ASK_PATIENT_ADDRESS":
        await handleAskPatientAddress(data, text);
        break;
      case "CONFIRM_BOOKING":
        await handleConfirmBooking(data, optionId);
        break;
      case "MY_APPTS":
        await handleMyAppts(optionId);
        break;
      case "CONFIRM_CANCEL":
        await handleConfirmCancel(data, optionId);
        break;
      default:
        await setState("MENU", {});
        await sendMainMenu();
    }
  } catch (err) {
    console.error("[bot] Error procesando mensaje:", err);
    await setState("MENU", {});
    await sendText("Ocurrió un error inesperado. Escribí *menu* para volver a empezar.");
  }
}

async function setState(state: string, data: ConvData): Promise<void> {
  await prisma.conversation.update({
    where: { phone_doctorId: convKey() },
    data: { state, data: data as object },
  });
}

async function isVirtualLocation(locationId?: number): Promise<boolean> {
  if (!locationId) return false;
  const { doctorId } = getBotContext();
  const loc = await prisma.location.findFirst({ where: { id: locationId, doctorId } });
  return Boolean(loc?.isVirtualVisit);
}

function emailPrompt(virtual: boolean, returningName?: string): string {
  if (virtual) {
    const hello = returningName ? `¡Hola de nuevo, ${returningName}!\n\n` : "";
    return (
      `${hello}Para la consulta virtual necesitamos tu *email*.\n` +
      "Te enviaremos el enlace de Google Meet por Gmail ~1 hora antes del turno."
    );
  }
  const hello = returningName ? `¡Hola de nuevo, ${returningName}!\n\n` : "";
  return (
    `${hello}¿Querés recibir el *recordatorio por email*? (opcional)\n` +
    "Escribí tu correo o *no* para omitir."
  );
}

async function sendGreeting(): Promise<void> {
  const { doctorName, doctorSpecialty } = getBotContext();
  await sendText(pickGreeting(doctorName, doctorSpecialty));
  await sendMainMenu();
}

async function sendMainMenu(): Promise<void> {
  await sendList(pickMenuPrompt(), "Ver opciones", [
    { id: "main_info", title: "Información", description: "Indicaciones y preguntas frecuentes" },
    { id: "main_locations", title: "Lugares de atención", description: "Sedes, direcciones y días" },
    { id: "main_avail", title: "Ver disponibilidad", description: "Días y horarios libres" },
    { id: "main_book", title: "Agendar turno", description: "Solicitar un nuevo turno" },
    { id: "main_appts", title: "Mis turnos", description: "Ver o cancelar tus turnos" },
  ]);
}

// ---------- Menú principal ----------

async function handleMenu(optionId?: string, text?: string): Promise<void> {
  const byNumber: Record<string, string> = {
    "1": "main_info",
    "2": "main_locations",
    "3": "main_avail",
    "4": "main_book",
    "5": "main_appts",
  };
  const choice = optionId || byNumber[text || ""] || "";

  switch (choice) {
    case "main_info":
      return startInfo();
    case "main_locations":
      return showLocations();
    case "main_avail":
      return startLocationSelection("avail");
    case "main_book":
      return startLocationSelection("book");
    case "main_appts":
      return startMyAppts();
    default:
      return sendMainMenu();
  }
}

// ---------- Información ----------

async function startInfo(): Promise<void> {
  const { doctorId } = getBotContext();
  const contents = await prisma.infoContent.findMany({
    where: { doctorId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (contents.length === 0) {
    await sendText("Todavía no hay información cargada. Escribí *menu* para volver.");
    return;
  }
  await setState("INFO_LIST", {});
  await sendList(
    "¿Sobre qué tema querés información?",
    "Ver temas",
    contents.map((c) => ({ id: `info_${c.id}`, title: c.title.slice(0, 24) }))
  );
}

async function handleInfoList(optionId?: string): Promise<void> {
  const { doctorId } = getBotContext();
  const id = optionId?.startsWith("info_") ? parseInt(optionId.slice(5), 10) : NaN;
  if (isNaN(id)) {
    await startInfo();
    return;
  }
  const content = await prisma.infoContent.findFirst({ where: { id, doctorId } });
  if (content) {
    await sendText(`*${content.title}*\n\n${content.body}`);
  }
  await setState("MENU", {});
  await sendButtons("¿Necesitás algo más?", [{ id: "back_menu", title: "Volver al menú" }]);
}

// ---------- Lugares de atención ----------

async function showLocations(): Promise<void> {
  const { doctorId } = getBotContext();
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      locations: { where: { active: true }, include: { schedules: true } },
    },
  });
  if (!doctor || doctor.locations.length === 0) {
    await sendText("No hay sedes cargadas por el momento.");
    await sendMainMenu();
    return;
  }

  const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const locLines = doctor.locations.map((loc) => {
    const days = [...new Set(loc.schedules.map((s) => s.weekday))].sort();
    const dayNames = days.map((d) => WEEKDAYS[d]).join(", ");
    let block = loc.isVirtualVisit
      ? `*${loc.name}*\nConsulta virtual por videollamada`
      : loc.isHomeVisit
        ? `*${loc.name}*\nAtención en el domicilio del paciente`
        : `*${loc.name}*\n${loc.address}`;
    if (dayNames) block += `\nDías de atención: ${dayNames}`;
    if (loc.notes) block += `\n${loc.notes}`;
    return block;
  });

  await sendText(`Estos son los lugares de atención de *${doctor.name}*:\n\n${locLines.join("\n\n")}`);
  await setState("MENU", {});
  await sendButtons("¿Necesitás algo más?", [{ id: "back_menu", title: "Volver al menú" }]);
}

// ---------- Selección de sede (disponibilidad y agendado) ----------

async function startLocationSelection(mode: "avail" | "book"): Promise<void> {
  const { doctorId } = getBotContext();
  const schedules = await prisma.doctorSchedule.findMany({
    where: { doctorId },
    include: { location: true },
  });
  const locations = [...new Map(schedules.map((s) => [s.locationId, s.location])).values()].filter(
    (l) => l.active
  );

  if (locations.length === 0) {
    await sendText("Todavía no hay horarios de atención cargados.");
    await setState("MENU", {});
    await sendMainMenu();
    return;
  }
  if (locations.length === 1) {
    await afterLocationChosen({ mode, locationId: locations[0].id });
    return;
  }
  await setState("SELECT_LOCATION", { mode });
  await sendList(
    "¿En qué sede?",
    "Ver sedes",
    locations.map((l) => ({
      id: `loc_${l.id}`,
      title: l.name.slice(0, 24),
      description: (l.isVirtualVisit
        ? "Videollamada (Meet)"
        : l.isHomeVisit
          ? "Visita a tu domicilio"
          : l.address
      ).slice(0, 72),
    }))
  );
}

async function handleSelectLocation(data: ConvData, optionId?: string): Promise<void> {
  const id = optionId?.startsWith("loc_") ? parseInt(optionId.slice(4), 10) : NaN;
  if (isNaN(id)) {
    await startLocationSelection(data.mode || "book");
    return;
  }
  await afterLocationChosen({ ...data, locationId: id });
}

async function afterLocationChosen(data: ConvData): Promise<void> {
  if (data.mode === "avail") {
    await showAvailability(data);
  } else {
    await startDaySelection(data);
  }
}

// ---------- Ver disponibilidad ----------

async function showAvailability(data: ConvData): Promise<void> {
  const { doctorId } = getBotContext();
  const days = await getAvailableDays(doctorId, data.locationId!);
  if (days.length === 0) {
    await sendText("No hay horarios disponibles en las próximas semanas.");
  } else {
    const lines = days.map((d) => {
      const sample = d.slots.slice(0, 6).join(", ");
      const extra = d.slots.length > 6 ? ` (+${d.slots.length - 6} más)` : "";
      return `*${formatDateHuman(d.date)}*: ${sample}${extra}`;
    });
    await sendText(
      `Estos son los próximos horarios disponibles:\n\n${lines.join("\n")}\n\n` +
        `Para reservar, elegí *Agendar turno* en el menú.`
    );
  }
  await setState("MENU", {});
  await sendMainMenu();
}

// ---------- Agendar turno ----------

async function startDaySelection(data: ConvData): Promise<void> {
  const { doctorId } = getBotContext();
  const days = await getAvailableDays(doctorId, data.locationId!);
  if (days.length === 0) {
    await sendText("No hay horarios disponibles en las próximas semanas.");
    await setState("MENU", {});
    await sendMainMenu();
    return;
  }
  await setState("SELECT_DAY", data);
  await sendList(
    "¿Qué día te queda cómodo?",
    "Ver días",
    days.map((d) => ({
      id: `day_${d.date}`,
      title: formatDateHuman(d.date, true).slice(0, 24),
      description: `${d.slots.length} horario${d.slots.length === 1 ? "" : "s"} disponible${d.slots.length === 1 ? "" : "s"}`,
    }))
  );
}

async function handleSelectDay(data: ConvData, optionId?: string): Promise<void> {
  const date = optionId?.startsWith("day_") ? optionId.slice(4) : "";
  if (!date) {
    await startDaySelection(data);
    return;
  }
  await showSlots({ ...data, date, slotOffset: 0 });
}

async function showSlots(data: ConvData): Promise<void> {
  const { doctorId } = getBotContext();
  const slots = await getSlotsForDate(doctorId, data.locationId!, data.date!);
  if (slots.length === 0) {
    await sendText("Ese día ya no tiene horarios libres. Elegí otro, por favor.");
    await startDaySelection(data);
    return;
  }
  const offset = data.slotOffset || 0;
  const page = slots.slice(offset, offset + 9);
  const rows = page.map((t) => ({ id: `slot_${t}`, title: `${t} hs` }));
  if (slots.length > offset + 9) {
    rows.push({ id: "slots_more", title: "Ver más horarios" });
  }
  await setState("SELECT_SLOT", data);
  await sendList(`Horarios para el ${formatDateHuman(data.date!)}:`, "Ver horarios", rows);
}

async function handleSelectSlot(data: ConvData, optionId?: string): Promise<void> {
  const { doctorId, patientPhone } = getBotContext();
  if (optionId === "slots_more") {
    await showSlots({ ...data, slotOffset: (data.slotOffset || 0) + 9 });
    return;
  }
  const time = optionId?.startsWith("slot_") ? optionId.slice(5) : "";
  if (!time) {
    await showSlots(data);
    return;
  }

  const slots = await getSlotsForDate(doctorId, data.locationId!, data.date!);
  if (!slots.includes(time)) {
    await sendText("Ese horario se acaba de ocupar. Elegí otro, por favor.");
    await showSlots({ ...data, slotOffset: 0 });
    return;
  }

  const next: ConvData = { ...data, time };
  const patient = await prisma.patient.findUnique({ where: { phone: patientPhone } });
  if (patient?.fullName && patient.dni) {
    next.fullName = patient.fullName;
    next.dni = patient.dni;
    next.insurance = patient.insurance || undefined;
    if (patient.email) next.email = patient.email;
    if (!patient.email) {
      const virtual = await isVirtualLocation(next.locationId);
      await setState("ASK_EMAIL", next);
      await sendText(emailPrompt(virtual, patient.fullName));
      return;
    }
    await setState("ASK_MOTIVO", next);
    await sendText(
      `¡Hola de nuevo, ${patient.fullName}!\nContanos brevemente el *motivo de la consulta*:`
    );
    return;
  }

  await setState("ASK_NAME", next);
  await sendText("Para completar la solicitud necesito algunos datos.\n\n¿Cuál es tu *nombre y apellido*?");
}

async function handleAskName(data: ConvData, text: string): Promise<void> {
  if (text.length < 3) {
    await sendText("Por favor, escribí tu nombre y apellido completos.");
    return;
  }
  await setState("ASK_DNI", { ...data, fullName: text });
  await sendText("¿Cuál es tu *DNI*? (solo números)");
}

async function handleAskDni(data: ConvData, text: string): Promise<void> {
  const dni = text.replace(/[.\s]/g, "");
  if (!/^\d{6,9}$/.test(dni)) {
    await sendText("El DNI no parece válido. Escribilo solo con números, por favor.");
    return;
  }
  await setState("ASK_INSURANCE", { ...data, dni });
  await sendText('¿Qué *obra social o prepaga* tenés? (si no tenés, escribí "particular")');
}

async function handleAskInsurance(data: ConvData, text: string): Promise<void> {
  if (text.length < 2) {
    await sendText('Escribí el nombre de tu obra social, o "particular".');
    return;
  }
  await setState("ASK_EMAIL", { ...data, insurance: text });
  const virtual = await isVirtualLocation(data.locationId);
  await sendText(emailPrompt(virtual));
}

async function handleAskEmail(data: ConvData, text: string): Promise<void> {
  const virtual = await isVirtualLocation(data.locationId);
  let email: string | undefined;
  if (isEmailSkipAnswer(text)) {
    if (virtual) {
      await sendText(
        "Para consultas virtuales el email es *obligatorio* (te enviamos el Meet por Gmail). Escribí tu correo:"
      );
      return;
    }
    email = undefined;
  } else if (isValidEmail(text)) {
    email = text.trim().toLowerCase();
  } else {
    await sendText('Escribí un email válido (ej. nombre@mail.com) o *no* para omitir.');
    return;
  }
  await setState("ASK_MOTIVO", { ...data, email });
  await sendText("Por último, contanos brevemente el *motivo de la consulta*:");
}

async function handleAskMotivo(data: ConvData, text: string): Promise<void> {
  if (text.length < 2) {
    await sendText("Contanos brevemente el motivo de la consulta, por favor.");
    return;
  }
  await proceedAfterMotivo({ ...data, motivo: text });
}

async function handleAskPatientAddress(data: ConvData, text: string): Promise<void> {
  if (text.length < 8) {
    await sendText("Necesitamos una dirección más completa (calle, número, piso/depto y localidad).");
    return;
  }
  await showBookingConfirmation({ ...data, patientAddress: text.trim() });
}

async function proceedAfterMotivo(data: ConvData): Promise<void> {
  const { doctorId } = getBotContext();
  const location = await prisma.location.findFirst({
    where: { id: data.locationId!, doctorId },
  });
  if (location?.isHomeVisit) {
    await setState("ASK_PATIENT_ADDRESS", data);
    await sendText(
      "Indicanos la *dirección completa* donde querés la visita\n" +
        "(calle, número, piso/depto y localidad):"
    );
    return;
  }
  await showBookingConfirmation(data);
}

async function showBookingConfirmation(data: ConvData): Promise<void> {
  const { doctorId, doctorName } = getBotContext();
  const location = await prisma.location.findFirst({
    where: { id: data.locationId!, doctorId },
  });
  await setState("CONFIRM_BOOKING", data);

  let placeBlock: string;
  if (location?.isHomeVisit) {
    placeBlock = `Modalidad: Visita a domicilio\nDirección: ${data.patientAddress}\n`;
  } else {
    placeBlock = `Lugar: ${location?.name}${location?.address ? ` (${location.address})` : ""}\n`;
  }

  await sendButtons(
    `Revisá los datos de tu solicitud:\n\n` +
      `Profesional: ${doctorName}\n` +
      placeBlock +
      `Fecha: ${formatDateHuman(data.date!)} a las ${data.time} hs\n\n` +
      `Paciente: ${data.fullName} — DNI ${data.dni}\n` +
      `Obra social: ${data.insurance}\n` +
      (data.email ? `Email: ${data.email}\n` : "") +
      `Motivo: ${data.motivo}\n\n¿Confirmás la solicitud?`,
    [
      { id: "confirm_yes", title: "Confirmar" },
      { id: "confirm_no", title: "Cancelar" },
    ]
  );
}

async function handleConfirmBooking(data: ConvData, optionId?: string): Promise<void> {
  const { doctorId, patientPhone } = getBotContext();
  if (optionId === "confirm_no") {
    await setState("MENU", {});
    await sendText("Solicitud descartada, no hay problema.");
    await sendMainMenu();
    return;
  }
  if (optionId !== "confirm_yes") {
    await sendButtons("¿Confirmás la solicitud?", [
      { id: "confirm_yes", title: "Confirmar" },
      { id: "confirm_no", title: "Cancelar" },
    ]);
    return;
  }

  const slots = await getSlotsForDate(doctorId, data.locationId!, data.date!);
  if (!slots.includes(data.time!)) {
    await sendText("Ese horario se acaba de ocupar. Elegí otro, por favor.");
    await showSlots({ ...data, slotOffset: 0 });
    return;
  }

  const patient = await prisma.patient.upsert({
    where: { phone: patientPhone },
    create: {
      phone: patientPhone,
      fullName: data.fullName,
      dni: data.dni,
      insurance: data.insurance,
      email: data.email || null,
    },
    update: {
      fullName: data.fullName,
      dni: data.dni,
      insurance: data.insurance,
      ...(data.email !== undefined ? { email: data.email || null } : {}),
    },
  });

  const durationMinutes = await getSlotMinutes(doctorId, data.locationId!);
  const location = await prisma.location.findFirst({ where: { id: data.locationId!, doctorId } });
  const appointment = await prisma.appointment.create({
    data: {
      doctorId,
      locationId: data.locationId!,
      patientId: patient.id,
      date: data.date!,
      time: data.time!,
      durationMinutes,
      motivo: data.motivo,
      patientAddress: location?.isHomeVisit ? data.patientAddress || null : null,
      status: "PENDIENTE",
      createdVia: "bot",
    },
    include: { doctor: true, location: true, patient: true },
  });

  await setState("MENU", {});
  await logAppointmentEvent(appointment.id, doctorId, "SOLICITUD_CREADA", { actor: "BOT" });
  await notifySolicitudRecibida(appointment);
}

// ---------- Mis turnos ----------

async function startMyAppts(): Promise<void> {
  const { doctorId, patientPhone } = getBotContext();
  const patient = await prisma.patient.findUnique({ where: { phone: patientPhone } });
  const appointments = patient
    ? await prisma.appointment.findMany({
        where: {
          patientId: patient.id,
          doctorId,
          status: { in: ["PENDIENTE", "CONFIRMADO"] },
          date: { gte: todayStr() },
        },
        include: { doctor: true, location: true },
        orderBy: [{ date: "asc" }, { time: "asc" }],
      })
    : [];

  if (appointments.length === 0) {
    await sendText("No tenés turnos próximos con este profesional. Podés agendar uno desde el menú.");
    await setState("MENU", {});
    await sendMainMenu();
    return;
  }

  const lines = appointments.map((a) => {
    const status = a.status === "PENDIENTE" ? "pendiente de confirmación" : "confirmado";
    const place = a.location.isVirtualVisit
      ? "consulta virtual"
      : a.location.isHomeVisit
      ? `a domicilio${a.patientAddress ? ` (${a.patientAddress})` : ""}`
      : a.location.name;
    return `• ${formatDateHuman(a.date)} ${a.time} hs — ${place} (${status})`;
  });
  await sendText(`Tus próximos turnos con *${appointments[0].doctor.name}*:\n\n${lines.join("\n")}`);

  await setState("MY_APPTS", {});
  await sendList("Si querés cancelar alguno, seleccionalo:", "Opciones", [
    ...appointments.map((a) => ({
      id: `cancel_${a.id}`,
      title: `${formatDateHuman(a.date, true)} ${a.time} hs`.slice(0, 24),
      description: "Cancelar este turno",
    })),
    { id: "back_menu", title: "Volver al menú" },
  ]);
}

async function handleMyAppts(optionId?: string): Promise<void> {
  const { doctorId } = getBotContext();
  if (!optionId || optionId === "back_menu") {
    await setState("MENU", {});
    await sendMainMenu();
    return;
  }
  const id = optionId.startsWith("cancel_") ? parseInt(optionId.slice(7), 10) : NaN;
  if (isNaN(id)) {
    await startMyAppts();
    return;
  }
  const a = await prisma.appointment.findFirst({
    where: { id, doctorId },
    include: { doctor: true, location: true },
  });
  if (!a || !["PENDIENTE", "CONFIRMADO"].includes(a.status)) {
    await startMyAppts();
    return;
  }
  await setState("CONFIRM_CANCEL", { cancelApptId: id });
  await sendButtons(
    `¿Seguro que querés cancelar el turno del ${formatDateHuman(a.date)} a las ${a.time} hs en ${a.location.name}?`,
    [
      { id: "cancel_yes", title: "Sí, cancelar" },
      { id: "cancel_no", title: "No, mantener" },
    ]
  );
}

async function handleConfirmCancel(data: ConvData, optionId?: string): Promise<void> {
  const { doctorId } = getBotContext();
  if (optionId === "cancel_yes" && data.cancelApptId) {
    const a = await prisma.appointment.findFirst({
      where: { id: data.cancelApptId, doctorId },
    });
    if (a && ["PENDIENTE", "CONFIRMADO"].includes(a.status)) {
      await prisma.appointment.update({
        where: { id: a.id },
        data: { status: "CANCELADO_PACIENTE" },
      });
      await logAppointmentEvent(a.id, doctorId, "CANCELADO_PACIENTE", { actor: "PATIENT" });
      await sendText("Listo, tu turno fue cancelado y el horario quedó liberado.");
    }
  } else if (optionId === "cancel_no") {
    await sendText("Perfecto, el turno sigue en pie.");
  } else {
    await sendButtons("¿Cancelamos el turno?", [
      { id: "cancel_yes", title: "Sí, cancelar" },
      { id: "cancel_no", title: "No, mantener" },
    ]);
    return;
  }
  await setState("MENU", {});
  await sendMainMenu();
}

// Envío usando el teléfono del paciente del contexto activo.
async function sendText(body: string) {
  return waSendText(getBotContext().patientPhone, body);
}
async function sendList(
  body: string,
  buttonLabel: string,
  rows: Parameters<typeof waSendList>[3]
) {
  return waSendList(getBotContext().patientPhone, body, buttonLabel, rows);
}
async function sendButtons(body: string, buttons: Parameters<typeof waSendButtons>[2]) {
  return waSendButtons(getBotContext().patientPhone, body, buttons);
}
