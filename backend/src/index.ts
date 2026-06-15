import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { runStartupSecurityChecks } from "./lib/startupChecks";
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
import { baileysQrPairingUrl } from "./lib/baileysPairingUrl";

runStartupSecurityChecks();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

const corsOrigin = config.corsOrigins.length
  ? config.corsOrigins
  : config.isProduction
    ? false
    : true;
app.use(cors({ origin: corsOrigin }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  if (config.isProduction) {
    res.json({ ok: true });
    return;
  }
  res.json({ ok: true, mode: config.whatsapp.mode });
});

app.use(baileysQrRouter);
app.use("/webhook", webhookRouter);
app.use("/webhook/twilio", twilioWebhookRouter);
app.use("/api/public", publicRouter);

app.use("/api/auth", authRouter);
app.use("/api/users", requireAuth, requireAdmin, usersRouter);
app.use("/api/appointments", requireAuth, appointmentsRouter);
app.use("/api/availability", requireAuth, availabilityRouter);
app.use("/api/patients", requireAuth, patientsRouter);
app.use("/api/simulator", requireAuth, requireAdmin, simulatorRouter);
app.use("/api", requireAuth, catalogRouter);

app.listen(config.port, () => {
  console.log(`[api] Escuchando en http://localhost:${config.port} (WhatsApp: ${config.whatsapp.mode})`);
  if (config.whatsapp.mode === "baileys") {
    const qrUrl = baileysQrPairingUrl();
    if (qrUrl) console.log(`[baileys] Vinculación WhatsApp (página QR): ${qrUrl}`);
  }
  startReminderJob();
  startBaileys();
});
