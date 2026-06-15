import { prisma } from "../prisma";
import { addDays, addMinutes, nowHM, todayStr, weekdayOf } from "../lib/dates";

export interface DaySummary {
  date: string;
  slots: string[];
}

/** Horarios libres de un doctor en una sede para una fecha dada. */
export async function getSlotsForDate(
  doctorId: number,
  locationId: number,
  date: string
): Promise<string[]> {
  const weekday = weekdayOf(date);

  const [schedules, blocks, taken] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { doctorId, locationId, weekday } }),
    prisma.scheduleBlock.findMany({
      where: { doctorId, dateFrom: { lte: date }, dateTo: { gte: date } },
    }),
    prisma.appointment.findMany({
      where: { doctorId, date, status: { in: ["PENDIENTE", "CONFIRMADO"] } },
      select: { time: true },
    }),
  ]);

  if (schedules.length === 0 || blocks.length > 0) return [];

  const takenTimes = new Set(taken.map((a) => a.time));
  const isToday = date === todayStr();
  const now = nowHM();

  const slots: string[] = [];
  for (const sch of schedules) {
    let t = sch.startTime;
    while (addMinutes(t, sch.slotMinutes) <= sch.endTime) {
      if (!takenTimes.has(t) && (!isToday || t > now)) slots.push(t);
      t = addMinutes(t, sch.slotMinutes);
    }
  }
  return [...new Set(slots)].sort();
}

/** Próximos días con disponibilidad (escanea hasta `scanDays` días, devuelve hasta `maxDays`). */
export async function getAvailableDays(
  doctorId: number,
  locationId: number,
  from?: string,
  scanDays = 21,
  maxDays = 9
): Promise<DaySummary[]> {
  const start = from || todayStr();
  const result: DaySummary[] = [];
  for (let i = 0; i < scanDays && result.length < maxDays; i++) {
    const date = addDays(start, i);
    const slots = await getSlotsForDate(doctorId, locationId, date);
    if (slots.length > 0) result.push({ date, slots });
  }
  return result;
}

/** Duración del slot configurada para doctor+sede (usa la del primer horario que matchee). */
export async function getSlotMinutes(doctorId: number, locationId: number): Promise<number> {
  const sch = await prisma.doctorSchedule.findFirst({ where: { doctorId, locationId } });
  return sch?.slotMinutes ?? 30;
}
