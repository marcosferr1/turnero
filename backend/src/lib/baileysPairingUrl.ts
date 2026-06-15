import { config } from "../config";

export function baileysQrPairingUrl(): string | null {
  if (!config.publicUrl) return null;
  const base = `${config.publicUrl}/baileys/qr`;
  return config.baileys.qrSecret ? `${base}?token=${encodeURIComponent(config.baileys.qrSecret)}` : base;
}
