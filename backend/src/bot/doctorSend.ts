import { Doctor } from "@prisma/client";
import { config } from "../config";
import { runWithBotContext } from "../bot/context";

export function phoneNumberIdForDoctor(
  doctor: Pick<Doctor, "id" | "whatsappPhoneNumberId" | "whatsappDisplayPhone">
): string {
  if (config.whatsapp.mode === "simulator") {
    return doctor.whatsappPhoneNumberId || `sim-doctor-${doctor.id}`;
  }
  if (config.whatsapp.mode === "twilio") {
    return (
      doctor.whatsappPhoneNumberId ||
      config.twilio.whatsappFrom ||
      doctor.whatsappDisplayPhone ||
      `twilio-doctor-${doctor.id}`
    );
  }
  if (config.whatsapp.mode === "baileys") {
    return (
      doctor.whatsappDisplayPhone ||
      doctor.whatsappPhoneNumberId ||
      config.baileys.phone ||
      `baileys-doctor-${doctor.id}`
    );
  }
  return doctor.whatsappPhoneNumberId || config.whatsapp.phoneNumberId;
}

/** Número emisor Twilio (sandbox o sender aprobado). No usar whatsappDisplayPhone. */
export function twilioFromForDoctor(
  doctor: Pick<Doctor, "whatsappDisplayPhone" | "whatsappPhoneNumberId">
): string {
  return (
    doctor.whatsappPhoneNumberId ||
    config.twilio.whatsappFrom ||
    doctor.whatsappDisplayPhone ||
    ""
  );
}

/** Ejecuta un envío de WhatsApp usando el número configurado del doctor. */
export async function withDoctorContext<T>(
  doctor: Pick<Doctor, "id" | "name" | "specialty" | "whatsappPhoneNumberId" | "whatsappDisplayPhone">,
  patientPhone: string,
  fn: () => Promise<T>
): Promise<T> {
  return runWithBotContext(
    {
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      patientPhone,
      phoneNumberId: phoneNumberIdForDoctor(doctor),
    },
    fn
  );
}
