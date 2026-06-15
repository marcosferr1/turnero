export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** Lunes de la semana a la que pertenece la fecha. */
export function mondayOf(date: string): string {
  const wd = weekdayOf(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function formatShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${WEEKDAYS_SHORT[weekdayOf(date)]} ${d}/${m}`
}

export function formatLong(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}
