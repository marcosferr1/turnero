import dotenv from "dotenv";
import { normalizeWhatsAppPhone } from "./lib/phoneNormalize";

dotenv.config();

export type WhatsAppMode = "simulator" | "cloud" | "twilio" | "baileys";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  utcOffset: process.env.APP_UTC_OFFSET || "-03:00",
  whatsapp: {
    mode: (process.env.WHATSAPP_MODE || "simulator") as WhatsAppMode,
    token: process.env.WHATSAPP_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "turnero-verify",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    /** false = envía texto plano (desarrollo / sin plantillas en Meta). */
    useTemplates: process.env.WHATSAPP_USE_TEMPLATES === "true",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    /** Número WhatsApp de Twilio: +5493517714542 o whatsapp:+5493517714542 */
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || "",
    /** Opcional: si usás Messaging Service, no hace falta TWILIO_WHATSAPP_FROM. */
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || "",
  },
  baileys: {
    /** Número vinculado. Acepta 543517714542 o 5493517714542 */
    phone: normalizeWhatsAppPhone(process.env.BAILEYS_PHONE || "5493517714542"),
    authDir: process.env.BAILEYS_AUTH_DIR || ".baileys_auth",
    /** Intentar menús nativos además del texto numerado (experimental). */
    nativeMenus: process.env.BAILEYS_NATIVE_MENUS === "true",
  },
  email: {
    from: process.env.EMAIL_FROM || "",
    resend: {
      apiKey: process.env.RESEND_API_KEY || "",
      get enabled(): boolean {
        return Boolean(config.email.from && this.apiKey);
      },
    },
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      get enabled(): boolean {
        return Boolean(this.host && this.user && this.pass);
      },
    },
    get enabled(): boolean {
      return this.resend.enabled || this.smtp.enabled;
    },
    /** Remitente efectivo (EMAIL_FROM o SMTP_USER). */
    get fromAddress(): string {
      if (config.email.from) return config.email.from;
      if (config.email.smtp.user) return config.email.smtp.user;
      return "";
    },
  },
};
