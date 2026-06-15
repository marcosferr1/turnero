import express from "express";
import cors from "cors";
import { config } from "./config";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { appointmentsRouter } from "./routes/appointments";
import { availabilityRouter } from "./routes/availability";
import { catalogRouter } from "./routes/catalog";
import { patientsRouter } from "./routes/patients";
import { simulatorRouter } from "./routes/simulator";
import { publicRouter } from "./routes/public";
import { webhookRouter } from "./bot/webhook";
import { twilioWebhookRouter } from "./bot/twilioWebhook";
import { startBaileys } from "./bot/baileys";
import { startReminderJob } from "./jobs/reminders";
import { baileysQrRouter } from "./routes/baileysQr";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => res.json({ ok: true, mode: config.whatsapp.mode }));

// QR Baileys para vincular WhatsApp (sin auth; opcional ?token=)
app.use(baileysQrRouter);

// Webhook Meta Cloud API (sin auth)
app.use("/webhook", webhookRouter);

// Webhook Twilio WhatsApp (sin auth)
app.use("/webhook/twilio", twilioWebhookRouter);

// Perfil público de profesionales (sin auth)
app.use("/api/public", publicRouter);

// API del panel
app.use("/api/auth", authRouter);
app.use("/api/users", requireAuth, requireAdmin, usersRouter);
app.use("/api/appointments", requireAuth, appointmentsRouter);
app.use("/api/availability", requireAuth, availabilityRouter);
app.use("/api/patients", requireAuth, patientsRouter);
app.use("/api/simulator", requireAuth, requireAdmin, simulatorRouter);
app.use("/api", requireAuth, catalogRouter);

app.listen(config.port, () => {
  console.log(`[api] Escuchando en http://localhost:${config.port} (WhatsApp: ${config.whatsapp.mode})`);
  startReminderJob();
  startBaileys();
});
