import { Router } from "express";
import { normalizeWhatsAppPhone } from "../lib/phoneNormalize";
import { resolvePendingChoice } from "./pendingChoices";
import { handlePatientMessage, resolveDoctorByTwilioTo } from "./dispatch";

export const twilioWebhookRouter = Router();

/** Webhook de mensajes entrantes de Twilio WhatsApp (application/x-www-form-urlencoded). */
twilioWebhookRouter.post("/", (req, res) => {
  res.status(200).send("OK");

  const fromRaw: string = req.body?.From || "";
  const toRaw: string = req.body?.To || "";
  const body: string = (req.body?.Body || "").trim();
  const buttonPayload: string | undefined = req.body?.ButtonPayload?.trim() || undefined;

  if (!fromRaw || !toRaw) {
    console.warn("[twilio] Webhook sin From/To; ignorado.");
    return;
  }

  const patientPhone = normalizeWhatsAppPhone(fromRaw);
  const toNumber = normalizeWhatsAppPhone(toRaw);

  resolveDoctorByTwilioTo(toNumber)
    .then((doctor) => {
      if (!doctor) {
        console.warn(`[twilio] Número destino ${toNumber} no vinculado a ningún doctor.`);
        return;
      }

      let interactiveId = buttonPayload;
      let text = body;

      if (!interactiveId && body) {
        const fromChoice = resolvePendingChoice(patientPhone, doctor.id, body);
        if (fromChoice) {
          interactiveId = fromChoice;
          text = "";
        }
      }

      return handlePatientMessage(patientPhone, doctor.id, { text, interactiveId });
    })
    .catch((err) => console.error("[twilio] Error procesando mensaje:", err));
});
