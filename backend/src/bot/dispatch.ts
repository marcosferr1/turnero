import { prisma } from "../prisma";
import { config } from "../config";
import { normalizeWhatsAppPhone } from "../lib/phoneNormalize";
import { BotContext, runWithBotContext } from "./context";
import { phoneNumberIdForDoctor } from "./doctorSend";
import { handleIncoming } from "./engine";
import type { IncomingMessage } from "./engine";

/** Resuelve el doctor dueño de un phone_number_id de Meta Cloud API. */
export async function resolveDoctorByWhatsAppId(phoneNumberId: string) {
  return prisma.doctor.findFirst({
    where: { whatsappPhoneNumberId: phoneNumberId, active: true },
  });
}

/** Resuelve el doctor dueño del número Twilio que recibió el mensaje (campo To). */
export async function resolveDoctorByTwilioTo(toNumber: string) {
  const normalized = normalizeWhatsAppPhone(toNumber);
  const doctors = await prisma.doctor.findMany({ where: { active: true } });

  for (const doctor of doctors) {
    if (
      doctor.whatsappDisplayPhone &&
      normalizeWhatsAppPhone(doctor.whatsappDisplayPhone) === normalized
    ) {
      return doctor;
    }
    if (
      doctor.whatsappPhoneNumberId &&
      normalizeWhatsAppPhone(doctor.whatsappPhoneNumberId) === normalized
    ) {
      return doctor;
    }
  }

  const defaultFrom = config.twilio.whatsappFrom;
  if (defaultFrom && normalizeWhatsAppPhone(defaultFrom) === normalized) {
    return prisma.doctor.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  }

  return null;
}

/** Doctor asociado al número conectado vía Baileys (un chip = un consultorio). */
export async function resolveDoctorForBaileys() {
  const target = normalizeWhatsAppPhone(config.baileys.phone);
  const doctors = await prisma.doctor.findMany({ where: { active: true } });

  for (const doctor of doctors) {
    if (
      doctor.whatsappDisplayPhone &&
      normalizeWhatsAppPhone(doctor.whatsappDisplayPhone) === target
    ) {
      return doctor;
    }
    if (
      doctor.whatsappPhoneNumberId &&
      normalizeWhatsAppPhone(doctor.whatsappPhoneNumberId) === target
    ) {
      return doctor;
    }
  }

  return prisma.doctor.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
}

/** Arma el contexto del bot para un doctor y procesa el mensaje del paciente. */
export async function handlePatientMessage(
  patientPhone: string,
  doctorId: number,
  msg: IncomingMessage,
  patientJid?: string
): Promise<void> {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor?.active) {
    console.warn(`[bot] Doctor ${doctorId} inactivo o inexistente; mensaje ignorado.`);
    return;
  }

  const phoneNumberId = phoneNumberIdForDoctor(doctor);
  if (!phoneNumberId && config.whatsapp.mode === "cloud") {
    console.warn(`[bot] Doctor ${doctor.id} sin whatsappPhoneNumberId configurado.`);
    return;
  }

  const ctx: BotContext = {
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorSpecialty: doctor.specialty,
    patientPhone,
    patientJid,
    phoneNumberId,
  };

  try {
    await runWithBotContext(ctx, () => handleIncoming(msg));
  } catch (err) {
    console.error(`[bot] Error procesando mensaje de ${patientJid ?? patientPhone}:`, err);
  }
}
