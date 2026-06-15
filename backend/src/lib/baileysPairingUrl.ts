import { config } from "../config";

const QR_LOG_COOLDOWN_MS = 5 * 60 * 1000;
let lastQrLogAt = 0;

export function baileysQrBaseUrl(): string | null {
  if (!config.publicUrl) return null;
  return `${config.publicUrl}/baileys/qr`;
}

/** URL completa con token (solo para uso local; no loguear en producción). */
export function baileysQrPairingUrl(): string | null {
  const base = baileysQrBaseUrl();
  if (!base) return null;
  return config.baileys.qrSecret ? `${base}?token=${encodeURIComponent(config.baileys.qrSecret)}` : base;
}

export function resetBaileysQrLogThrottle(): void {
  lastQrLogAt = 0;
}

/** Indica cómo abrir la página de QR sin filtrar el secreto en producción. */
export function logBaileysQrHint(options?: { force?: boolean; reason?: string }): void {
  const base = baileysQrBaseUrl();
  if (!base) return;

  const now = Date.now();
  if (!options?.force && now - lastQrLogAt < QR_LOG_COOLDOWN_MS) return;
  lastQrLogAt = now;

  const prefix = options?.reason ? `[baileys] ${options.reason} ` : "[baileys] ";

  if (config.isProduction) {
    console.log(
      `${prefix}Escaneá el QR en ${base}?token=<BAILEYS_QR_SECRET> (el valor está en Railway; no se escribe en logs).`,
    );
    return;
  }

  const url = baileysQrPairingUrl();
  if (url) console.log(`${prefix}Escaneá el QR en: ${url}`);
}
