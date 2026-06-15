/** Convierte un número visible (+54 9 …) en enlace wa.me para abrir WhatsApp. */
export function buildWhatsAppUrl(displayPhone: string | null | undefined, message = "hola"): string | null {
  if (!displayPhone?.trim()) return null;
  let digits = displayPhone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Argentina móvil: wa.me suele requerir 549…
  if (digits.startsWith("54") && !digits.startsWith("549") && digits.length === 12) {
    digits = "549" + digits.slice(2);
  }
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
