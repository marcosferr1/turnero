import nodemailer from "nodemailer";
import { Appointment, Doctor, Location, Patient } from "@prisma/client";
import { config } from "../config";
import { formatDateHuman } from "../lib/dates";

type ReminderAppointment = Appointment & {
  doctor: Doctor;
  location: Location;
  patient: Patient;
};

function when(a: ReminderAppointment): string {
  return `${formatDateHuman(a.date)} a las ${a.time} hs`;
}

function where(a: ReminderAppointment): string {
  return `${a.location.name} (${a.location.address})`;
}

function buildReminderMail(a: ReminderAppointment) {
  const name = a.patient.fullName || "paciente";
  const subject = `Recordatorio de turno — ${a.doctor.name}`;
  const text =
    `Hola ${name},\n\n` +
    `Te recordamos tu turno con ${a.doctor.name} el ${when(a)} en ${where(a)}.\n\n` +
    `Si no podés asistir, escribinos por WhatsApp para cancelarlo y liberar el horario.\n\n` +
    `— ${a.doctor.name}`;
  return { subject, text };
}

async function sendViaResend(to: string, subject: string, text: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.email.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.email.fromAddress,
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[email] Resend error ${res.status}:`, body);
    return false;
  }
  return true;
}

async function sendViaSmtp(to: string, subject: string, text: string): Promise<boolean> {
  const { host, port, user, pass } = config.email.smtp;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: config.email.fromAddress,
    to,
    subject,
    text,
  });
  return true;
}

/**
 * Recordatorio por email cuando la ventana WhatsApp está cerrada.
 * Prioridad: Resend → SMTP (Gmail, etc.) → false.
 */
export async function sendReminderEmail(a: ReminderAppointment): Promise<boolean> {
  const to = a.patient.email?.trim();
  if (!to || !config.email.enabled || !config.email.fromAddress) return false;

  const { subject, text } = buildReminderMail(a);

  try {
    if (config.email.resend.enabled) {
      const ok = await sendViaResend(to, subject, text);
      if (ok) {
        console.log(`[email] Recordatorio (Resend) → ${to} (turno ${a.id})`);
        return true;
      }
    }
    if (config.email.smtp.enabled) {
      await sendViaSmtp(to, subject, text);
      console.log(`[email] Recordatorio (SMTP) → ${to} (turno ${a.id})`);
      return true;
    }
  } catch (err) {
    console.error("[email] Error enviando recordatorio:", err);
  }
  return false;
}
