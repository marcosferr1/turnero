import { config } from "../config";
import { normalizeWhatsAppPhone, toTwilioWhatsAppAddress } from "../lib/phoneNormalize";

function authHeader(): string {
  const { accountSid, authToken } = config.twilio;
  const token = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return `Basic ${token}`;
}

export async function sendTwilioWhatsApp(
  to: string,
  body: string,
  fromRaw: string
): Promise<boolean> {
  const { accountSid, messagingServiceSid } = config.twilio;
  if (!accountSid || !config.twilio.authToken) {
    console.error("[twilio] TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN no configurados.");
    return false;
  }

  const params = new URLSearchParams();
  const toAddr = toTwilioWhatsAppAddress(to);
  params.set("To", toAddr);
  params.set("Body", body);

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromRaw) {
    const fromAddr = toTwilioWhatsAppAddress(fromRaw);
    if (normalizeWhatsAppPhone(to) === normalizeWhatsAppPhone(fromRaw)) {
      console.error(
        "[twilio] To y From son el mismo número. En sandbox, el emisor debe ser +14155238886 " +
          "y el paciente tu celular (campo ID emisor en Mi consultorio, no el número visible)."
      );
      return false;
    }
    params.set("From", fromAddr);
  } else {
    console.error("[twilio] Falta TWILIO_WHATSAPP_FROM o TWILIO_MESSAGING_SERVICE_SID.");
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[twilio] Error ${res.status} al enviar:`, err);
    return false;
  }
  return true;
}
