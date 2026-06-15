import { Appointment, Doctor, Location, Patient } from "@prisma/client";
import { formatDateHuman } from "../lib/dates";
import { isWhatsAppCustomerWindowOpen } from "../lib/customerWindow";
import { sendTemplate, sendText } from "../bot/whatsapp";
import { withDoctorContext } from "../bot/doctorSend";
import { sendReminderEmail } from "./email";

export type FullAppointment = Appointment & {
  doctor: Doctor;
  location: Location;
  patient: Patient;
};

function when(a: FullAppointment): string {
  return `${formatDateHuman(a.date)} a las ${a.time} hs`;
}

function where(a: FullAppointment): string {
  if (a.location.isHomeVisit) {
    return a.patientAddress
      ? `A domicilio — ${a.patientAddress}`
      : `A domicilio (${a.location.name})`;
  }
  return `${a.location.name} (${a.location.address})`;
}

/** Mensaje de sesión: el paciente acaba de escribir, no requiere plantilla. */
export async function notifySolicitudRecibida(a: FullAppointment): Promise<void> {
  await sendText(
    a.patient.phone,
    `Recibimos tu solicitud de turno con ${a.doctor.name} para el ${when(a)} en ${where(a)}.\n\n` +
      `Te vamos a avisar por este medio cuando el consultorio la confirme.\n\n` +
      `Escribí *menu* para volver al menú.`
  );
}

export async function notifyConfirmado(a: FullAppointment): Promise<void> {
  await withDoctorContext(a.doctor, a.patient.phone, () =>
    sendTemplate(
      a.patient.phone,
      "turno_confirmado",
      [a.patient.fullName || "paciente", a.doctor.name, when(a), where(a)],
      `*Tu turno fue confirmado*\n\n` +
        `Profesional: ${a.doctor.name}\nFecha: ${when(a)}\nLugar: ${where(a)}\n\n` +
        `Si no podés asistir, escribinos para cancelarlo.`
    )
  );
}

export async function notifyRechazado(a: FullAppointment): Promise<void> {
  await withDoctorContext(a.doctor, a.patient.phone, () =>
    sendTemplate(
      a.patient.phone,
      "turno_rechazado",
      [a.patient.fullName || "paciente", a.doctor.name, when(a)],
      `Lamentablemente no pudimos confirmar tu turno con ${a.doctor.name} del ${when(a)}.\n\n` +
        `Podés escribirnos *hola* para buscar otro horario disponible.`
    )
  );
}

export async function notifyRecordatorio(a: FullAppointment): Promise<void> {
  const fallbackText =
    `*Recordatorio de turno*\n\n` +
    `Profesional: ${a.doctor.name}\nFecha: ${when(a)}\nLugar: ${where(a)}\n\n` +
    `Si no podés asistir, escribinos para cancelarlo y liberar el horario.`;

  await withDoctorContext(a.doctor, a.patient.phone, async () => {
    if (await isWhatsAppCustomerWindowOpen(a.patient.phone, a.doctorId)) {
      await sendText(a.patient.phone, fallbackText);
      return;
    }
    if (await sendReminderEmail(a)) return;
    await sendTemplate(
      a.patient.phone,
      "turno_recordatorio",
      [a.patient.fullName || "paciente", a.doctor.name, when(a), where(a)],
      fallbackText
    );
  });
}

export async function notifyCanceladoPorDoctor(a: FullAppointment): Promise<void> {
  await withDoctorContext(a.doctor, a.patient.phone, () =>
    sendTemplate(
      a.patient.phone,
      "turno_cancelado",
      [a.patient.fullName || "paciente", a.doctor.name, when(a)],
      `Tu turno con ${a.doctor.name} del ${when(a)} fue cancelado por el consultorio.\n\n` +
        `Escribinos *hola* para agendar un nuevo horario. Disculpá las molestias.`
    )
  );
}

export async function notifyReprogramado(
  a: FullAppointment,
  oldDate: string,
  oldTime: string
): Promise<void> {
  await withDoctorContext(a.doctor, a.patient.phone, () =>
    sendTemplate(
      a.patient.phone,
      "turno_reprogramado",
      [a.patient.fullName || "paciente", a.doctor.name, `${formatDateHuman(oldDate)} ${oldTime} hs`, when(a), where(a)],
      `*Tu turno fue reprogramado*\n\n` +
        `Profesional: ${a.doctor.name}\n` +
        `Antes: ${formatDateHuman(oldDate)} a las ${oldTime} hs\n` +
        `Ahora: ${when(a)}\nLugar: ${where(a)}\n\n` +
        `Si el nuevo horario no te sirve, escribinos para cambiarlo.`
    )
  );
}
