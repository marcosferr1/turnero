/** Opciones numeradas enviadas en modo Twilio (listas/botones como texto). */
const pending = new Map<string, string[]>();

function key(phone: string, doctorId: number): string {
  return `${normalizeKeyPhone(phone)}:${doctorId}`;
}

function normalizeKeyPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function setPendingChoices(phone: string, doctorId: number, optionIds: string[]): void {
  pending.set(key(phone, doctorId), optionIds);
}

export function resolvePendingChoice(
  phone: string,
  doctorId: number,
  text: string
): string | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const ids = pending.get(key(phone, doctorId));
  if (!ids?.length) return undefined;
  const idx = parseInt(trimmed, 10) - 1;
  return ids[idx];
}
