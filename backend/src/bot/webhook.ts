import { Router } from "express";
import { config } from "../config";
import { handlePatientMessage, resolveDoctorByWhatsAppId } from "./dispatch";

export const webhookRouter = Router();

// Verificación del webhook (la hace Meta al configurarlo).
webhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recepción de mensajes.
webhookRouter.post("/", (req, res) => {
  // Meta exige responder 200 rápido; el procesamiento sigue en background.
  res.sendStatus(200);

  const entries = req.body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const phoneNumberId: string | undefined = change.value?.metadata?.phone_number_id;
      const messages = change.value?.messages || [];
      for (const message of messages) {
        const from: string = message.from;
        let text: string | undefined;
        let interactiveId: string | undefined;

        if (message.type === "text") {
          text = message.text?.body;
        } else if (message.type === "interactive") {
          interactiveId =
            message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;
        } else if (message.type === "button") {
          text = message.button?.text;
        } else {
          text = "";
        }

        if (!phoneNumberId) {
          console.warn("[webhook] Mensaje sin phone_number_id; ignorado.");
          continue;
        }

        resolveDoctorByWhatsAppId(phoneNumberId).then((doctor) => {
          if (!doctor) {
            console.warn(`[webhook] Número ${phoneNumberId} no vinculado a ningún doctor.`);
            return;
          }
          return handlePatientMessage(from, doctor.id, { text, interactiveId });
        }).catch((err) => console.error("[webhook] Error procesando mensaje:", err));
      }
    }
  }
});
