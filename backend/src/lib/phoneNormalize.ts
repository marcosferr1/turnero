/** Solo dígitos, sin + ni espacios. Argentina móvil → 549… */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length === 12) {
    digits = "549" + digits.slice(2);
  }
  return digits;
}

/** Formato Twilio: whatsapp:+5493517714542 */
export function toTwilioWhatsAppAddress(raw: string): string {
  const digits = normalizeWhatsAppPhone(raw);
  return `whatsapp:+${digits}`;
}
