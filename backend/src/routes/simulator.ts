import { Router } from "express";
import { prisma } from "../prisma";
import { handlePatientMessage } from "../bot/dispatch";
import { outboxLength, outboxSince } from "../bot/whatsapp";
import { config } from "../config";

/**
 * Simulador local del bot: permite probar los flujos de cada doctor sin cuenta de Meta.
 * Solo disponible en WHATSAPP_MODE=simulator.
 */
export const simulatorRouter = Router();

simulatorRouter.get("/doctors", async (_req, res) => {
  const doctors = await prisma.doctor.findMany({
    where: { active: true },
    select: { id: true, name: true, specialty: true, whatsappDisplayPhone: true, whatsappPhoneNumberId: true },
    orderBy: { name: "asc" },
  });
  res.json(doctors);
});

simulatorRouter.post("/message", async (req, res) => {
  if (config.whatsapp.mode !== "simulator") {
    res.status(400).json({ error: "El simulador solo funciona con WHATSAPP_MODE=simulator" });
    return;
  }
  const { phone, text, optionId, doctorId } = req.body || {};
  if (!phone || !doctorId || (!text && !optionId)) {
    res.status(400).json({ error: "phone, doctorId y (text u optionId) son requeridos" });
    return;
  }
  const doctor = await prisma.doctor.findUnique({ where: { id: Number(doctorId) } });
  if (!doctor?.active) {
    res.status(404).json({ error: "Doctor no encontrado o inactivo" });
    return;
  }
  const before = outboxLength();
  await handlePatientMessage(String(phone), doctor.id, { text, interactiveId: optionId });
  res.json({ replies: outboxSince(before, String(phone)) });
});

simulatorRouter.post("/reset", async (req, res) => {
  const { phone, doctorId } = req.body || {};
  if (!phone || !doctorId) {
    res.status(400).json({ error: "phone y doctorId requeridos" });
    return;
  }
  await prisma.conversation.deleteMany({
    where: { phone: String(phone), doctorId: Number(doctorId) },
  });
  res.json({ ok: true });
});

simulatorRouter.get("/history", async (req, res) => {
  const phone = String(req.query.phone || "");
  const doctorId = req.query.doctorId ? Number(req.query.doctorId) : undefined;
  if (!phone) {
    res.status(400).json({ error: "phone requerido" });
    return;
  }
  const log = await prisma.messageLog.findMany({
    where: { phone, ...(doctorId ? { doctorId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.json(log);
});
