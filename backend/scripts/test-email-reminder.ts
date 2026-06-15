/**
 * Prueba de envío de recordatorio por email (SMTP / Resend).
 * Uso: npm run test:email -- --to=tu@gmail.com
 *      npm run test:email -- --to=tu@gmail.com --appointment=3
 */
import { config } from "../src/config";
import { prisma } from "../src/prisma";
import { sendReminderEmail } from "../src/services/email";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const to = arg("to") || config.email.smtp.user;
  if (!to) {
    console.error("Indicá el destinatario: npm run test:email -- --to=correo@ejemplo.com");
    process.exit(1);
  }
  if (!config.email.enabled) {
    console.error("Email no configurado (SMTP_USER/SMTP_PASS o RESEND_API_KEY + EMAIL_FROM).");
    process.exit(1);
  }

  const apptId = arg("appointment");
  const appointment = apptId
    ? await prisma.appointment.findUnique({
        where: { id: parseInt(apptId, 10) },
        include: { doctor: true, location: true, patient: true },
      })
    : await prisma.appointment.findFirst({
        where: { status: "CONFIRMADO" },
        include: { doctor: true, location: true, patient: true },
        orderBy: { id: "desc" },
      });

  if (!appointment) {
    console.error("No hay turno CONFIRMADO. Creá uno desde el panel o indicá --appointment=ID");
    process.exit(1);
  }

  const payload = {
    ...appointment,
    patient: { ...appointment.patient, email: to },
  };

  console.log(`Enviando recordatorio de prueba → ${to}`);
  console.log(`Turno #${appointment.id} — ${appointment.doctor.name} — ${appointment.date} ${appointment.time}`);

  const ok = await sendReminderEmail(payload);
  if (ok) {
    console.log("Listo. Revisá la bandeja de entrada (y spam).");
    process.exit(0);
  }
  console.error("No se pudo enviar. Mirá los errores arriba.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
