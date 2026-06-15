import { config } from "../config";

export function runStartupSecurityChecks(): void {
  if (!config.isProduction) return;

  if (config.jwtSecret === "dev-secret" || config.jwtSecret.length < 32) {
    console.error("[seguridad] JWT_SECRET débil o sin configurar en producción.");
  }

  if (config.corsOrigins.length === 0) {
    console.error("[seguridad] CORS_ORIGIN no configurado: el panel en Vercel no podrá llamar a la API.");
  }

  if (config.whatsapp.mode === "baileys" && !config.baileys.qrSecret) {
    console.error("[seguridad] BAILEYS_QR_SECRET obligatorio en producción con WHATSAPP_MODE=baileys.");
  }
}
