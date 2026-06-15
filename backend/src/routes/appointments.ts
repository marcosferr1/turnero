import { Request, Router } from "express";
import { AppointmentActor } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { scopedDoctorId } from "../middleware/auth";
import * as svc from "../services/appointments";
import { AppError } from "../services/appointments";
import { listAppointmentEvents } from "../services/appointmentEvents";

export const appointmentsRouter = Router();

const FULL_INCLUDE = { doctor: true, location: true, patient: true } as const;

function panelEventCtx(req: Request) {
  return { actor: "PANEL" as AppointmentActor, userId: req.user?.id };
}

/** Verifica que el turno exista y, si el usuario es DOCTOR, que sea suyo. */
async function assertOwnership(req: Request, id: number): Promise<void> {
  const scope = scopedDoctorId(req);
  if (!scope) return;
  const a = await prisma.appointment.findUnique({ where: { id }, select: { doctorId: true } });
  if (!a || a.doctorId !== scope) throw new AppError(404, "Turno no encontrado");
}

appointmentsRouter.get("/", async (req, res) => {
  const { status, from, to, doctorId } = req.query as Record<string, string | undefined>;
  const where: Prisma.AppointmentWhereInput = {};
  if (status) where.status = { in: status.split(",") as never };
  if (doctorId) where.doctorId = parseInt(doctorId, 10);
  if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const scope = scopedDoctorId(req);
  if (scope) where.doctorId = scope;

  const appointments = await prisma.appointment.findMany({
    where,
    include: FULL_INCLUDE,
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  res.json(appointments);
});

appointmentsRouter.get("/pending", async (req, res) => {
  const scope = scopedDoctorId(req);
  const appointments = await prisma.appointment.findMany({
    where: { status: "PENDIENTE", ...(scope ? { doctorId: scope } : {}) },
    include: FULL_INCLUDE,
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  res.json(appointments);
});

appointmentsRouter.get("/events", async (req, res) => {
  const scope = scopedDoctorId(req);
  const rawLimit = parseInt(String(req.query.limit ?? "50"), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  res.json(await listAppointmentEvents(scope, limit));
});

appointmentsRouter.post("/", async (req, res) => {
  try {
    const scope = scopedDoctorId(req);
    const input = scope ? { ...req.body, doctorId: scope } : req.body;
    const a = await svc.createManual(input, panelEventCtx(req));
    res.status(201).json(a);
  } catch (err) {
    handleError(err, res);
  }
});

appointmentsRouter.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await assertOwnership(req, id);
    res.json(await svc.approve(id, panelEventCtx(req)));
  } catch (err) {
    handleError(err, res);
  }
});

appointmentsRouter.post("/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await assertOwnership(req, id);
    res.json(await svc.reject(id, panelEventCtx(req)));
  } catch (err) {
    handleError(err, res);
  }
});

appointmentsRouter.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await assertOwnership(req, id);
    res.json(await svc.cancelByDoctor(id, panelEventCtx(req)));
  } catch (err) {
    handleError(err, res);
  }
});

appointmentsRouter.post("/:id/reschedule", async (req, res) => {
  const { date, time, locationId } = req.body || {};
  if (!date || !time) {
    res.status(400).json({ error: "Fecha y hora requeridas" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    await assertOwnership(req, id);
    res.json(await svc.reschedule(id, date, time, locationId, panelEventCtx(req)));
  } catch (err) {
    handleError(err, res);
  }
});

appointmentsRouter.post("/:id/complete", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await assertOwnership(req, id);
    res.json(await svc.complete(id, panelEventCtx(req)));
  } catch (err) {
    handleError(err, res);
  }
});

function handleError(err: unknown, res: { status: (n: number) => { json: (b: object) => void } }) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
}
