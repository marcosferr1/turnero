import { config } from "../config";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Combina fecha "YYYY-MM-DD" y hora "HH:MM" en un Date usando el offset fijo de la app. */
export function combine(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${config.utcOffset}`);
}

/** Fecha actual "YYYY-MM-DD" en la zona horaria de la app. */
export function todayStr(): string {
  return toAppDateStr(new Date());
}

/** Hora actual "HH:MM" en la zona horaria de la app. */
export function nowHM(): string {
  const d = shiftToApp(new Date());
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function formatDateHuman(date: string, short = false): string {
  const wd = weekdayOf(date);
  const [, m, d] = date.split("-");
  const name = short ? WEEKDAYS_SHORT[wd] : WEEKDAYS[wd];
  return `${name} ${d}/${m}`;
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Suma minutos a una hora "HH:MM". */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function offsetMinutes(): number {
  const m = config.utcOffset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function shiftToApp(d: Date): Date {
  return new Date(d.getTime() + offsetMinutes() * 60_000);
}

function toAppDateStr(d: Date): string {
  return shiftToApp(d).toISOString().slice(0, 10);
}
