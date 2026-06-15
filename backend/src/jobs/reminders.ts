import cron from "node-cron";
import { prisma } from "../prisma";
import { combine, todayStr } from "../lib/dates";
import { notifyRecordatorio } from "../services/notifications";
import { logAppointmentEvent } from "../services/appointmentEvents";

/**
 * Cada 10 minutos busca turnos confirmados que empiezan dentro de las próximas
 * 24 horas y todavía no recibieron recordatorio.
 */
export function startReminderJob(): void {
  cron.schedule("*/10 * * * *", runReminders);
  console.log("[jobs] Recordatorios de turnos programados (cada 10 minutos)");
}

export async function runReminders(): Promise<number> {
  const now = new Date();
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const candidates = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMADO",
      reminderSentAt: null,
      date: { gte: todayStr() },
    },
    include: { doctor: true, location: true, patient: true },
  });

  let sent = 0;
  for (const a of candidates) {
    const startsAt = combine(a.date, a.time);
    if (startsAt > now && startsAt <= limit) {
      try {
        await notifyRecordatorio(a);
        await prisma.appointment.update({
          where: { id: a.id },
          data: { reminderSentAt: new Date() },
        });
        await logAppointmentEvent(a.id, a.doctorId, "RECORDATORIO_ENVIADO", { actor: "SYSTEM" });
        sent++;
      } catch (err) {
        console.error(`[jobs] Error enviando recordatorio del turno ${a.id}:`, err);
      }
    }
  }
  if (sent > 0) console.log(`[jobs] ${sent} recordatorio(s) enviado(s) (WhatsApp / email / plantilla)`);
  return sent;
}
