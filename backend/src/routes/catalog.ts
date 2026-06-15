import { Router } from "express";
import { prisma } from "../prisma";
import { requireAdmin, scopedDoctorId } from "../middleware/auth";

/** CRUD de doctores, sedes, horarios, bloqueos y textos de información. */
export const catalogRouter = Router();

// ---------- Doctores ----------

catalogRouter.get("/doctors", async (_req, res) => {
  res.json(await prisma.doctor.findMany({ orderBy: { name: "asc" } }));
});

/** La doctora edita su propio perfil y WhatsApp. */
catalogRouter.put("/doctors/me", async (req, res) => {
  const scope = scopedDoctorId(req);
  if (!scope) {
    res.status(403).json({ error: "Solo disponible para usuarios con rol doctor" });
    return;
  }
  const { name, specialty, whatsappPhoneNumberId, whatsappDisplayPhone } = req.body || {};
  if (!name || !specialty) {
    res.status(400).json({ error: "Nombre y especialidad requeridos" });
    return;
  }
  const doctor = await prisma.doctor.update({
    where: { id: scope },
    data: {
      name,
      specialty,
      ...(whatsappPhoneNumberId !== undefined ? { whatsappPhoneNumberId: whatsappPhoneNumberId || null } : {}),
      ...(whatsappDisplayPhone !== undefined ? { whatsappDisplayPhone: whatsappDisplayPhone || null } : {}),
    },
  });
  await prisma.user.update({ where: { id: req.user!.id }, data: { fullName: name } });
  res.json(doctor);
});

catalogRouter.post("/doctors", requireAdmin, async (req, res) => {
  const { name, specialty } = req.body || {};
  if (!name || !specialty) {
    res.status(400).json({ error: "Nombre y especialidad requeridos" });
    return;
  }
  res.status(201).json(await prisma.doctor.create({ data: { name, specialty } }));
});

catalogRouter.put("/doctors/:id", requireAdmin, async (req, res) => {
  const { name, specialty, active, whatsappPhoneNumberId, whatsappDisplayPhone } = req.body || {};
  res.json(
    await prisma.doctor.update({
      where: { id: parseInt(req.params.id, 10) },
      data: {
        name,
        specialty,
        active,
        ...(whatsappPhoneNumberId !== undefined ? { whatsappPhoneNumberId: whatsappPhoneNumberId || null } : {}),
        ...(whatsappDisplayPhone !== undefined ? { whatsappDisplayPhone: whatsappDisplayPhone || null } : {}),
      },
    })
  );
});

// ---------- Sedes (propias de cada doctor) ----------

catalogRouter.get("/locations", async (req, res) => {
  const scope = scopedDoctorId(req);
  const filterDoctor = scope ?? (req.query.doctorId ? parseInt(String(req.query.doctorId), 10) : undefined);
  res.json(
    await prisma.location.findMany({
      where: filterDoctor ? { doctorId: filterDoctor } : undefined,
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    })
  );
});

catalogRouter.post("/locations", async (req, res) => {
  const { name, address, notes } = req.body || {};
  const doctorId = scopedDoctorId(req) ?? req.body?.doctorId;
  if (!name || !address || !doctorId) {
    res.status(400).json({ error: "Nombre, dirección y doctor requeridos" });
    return;
  }
  res.status(201).json(await prisma.location.create({ data: { doctorId, name, address, notes } }));
});

catalogRouter.put("/locations/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const scope = scopedDoctorId(req);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing || (scope && existing.doctorId !== scope)) {
    res.status(404).json({ error: "Sede no encontrada" });
    return;
  }
  const { name, address, notes, active } = req.body || {};
  res.json(await prisma.location.update({ where: { id }, data: { name, address, notes, active } }));
});

// ---------- Horarios semanales ----------

catalogRouter.get("/schedules", async (req, res) => {
  const scope = scopedDoctorId(req);
  const doctorId = scope ?? (req.query.doctorId ? parseInt(String(req.query.doctorId), 10) : undefined);
  res.json(
    await prisma.doctorSchedule.findMany({
      where: doctorId ? { doctorId } : undefined,
      include: { location: true, doctor: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    })
  );
});

catalogRouter.post("/schedules", async (req, res) => {
  const { locationId, weekday, startTime, endTime, slotMinutes } = req.body || {};
  const doctorId = scopedDoctorId(req) ?? req.body?.doctorId;
  if (doctorId == null || locationId == null || weekday == null || !startTime || !endTime || !slotMinutes) {
    res.status(400).json({ error: "Faltan campos requeridos" });
    return;
  }
  if (startTime >= endTime) {
    res.status(400).json({ error: "La hora de inicio debe ser anterior a la de fin" });
    return;
  }
  // La sede debe pertenecer al mismo doctor del horario.
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || location.doctorId !== doctorId) {
    res.status(400).json({ error: "La sede no pertenece a este profesional" });
    return;
  }
  res.status(201).json(
    await prisma.doctorSchedule.create({
      data: { doctorId, locationId, weekday, startTime, endTime, slotMinutes },
      include: { location: true, doctor: true },
    })
  );
});

catalogRouter.delete("/schedules/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const scope = scopedDoctorId(req);
  const existing = await prisma.doctorSchedule.findUnique({ where: { id } });
  if (!existing || (scope && existing.doctorId !== scope)) {
    res.status(404).json({ error: "Horario no encontrado" });
    return;
  }
  await prisma.doctorSchedule.delete({ where: { id } });
  res.json({ ok: true });
});

// ---------- Bloqueos ----------

catalogRouter.get("/blocks", async (req, res) => {
  const scope = scopedDoctorId(req);
  const doctorId = scope ?? (req.query.doctorId ? parseInt(String(req.query.doctorId), 10) : undefined);
  res.json(
    await prisma.scheduleBlock.findMany({
      where: doctorId ? { doctorId } : undefined,
      include: { doctor: true },
      orderBy: { dateFrom: "asc" },
    })
  );
});

catalogRouter.post("/blocks", async (req, res) => {
  const { dateFrom, dateTo, reason } = req.body || {};
  const doctorId = scopedDoctorId(req) ?? req.body?.doctorId;
  if (!doctorId || !dateFrom || !dateTo) {
    res.status(400).json({ error: "Doctor y rango de fechas requeridos" });
    return;
  }
  res
    .status(201)
    .json(await prisma.scheduleBlock.create({ data: { doctorId, dateFrom, dateTo, reason } }));
});

catalogRouter.delete("/blocks/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const scope = scopedDoctorId(req);
  const existing = await prisma.scheduleBlock.findUnique({ where: { id } });
  if (!existing || (scope && existing.doctorId !== scope)) {
    res.status(404).json({ error: "Bloqueo no encontrado" });
    return;
  }
  await prisma.scheduleBlock.delete({ where: { id } });
  res.json({ ok: true });
});

// ---------- Textos de información del bot (por doctor) ----------

catalogRouter.get("/info", async (req, res) => {
  const scope = scopedDoctorId(req);
  const doctorId = scope ?? (req.query.doctorId ? parseInt(String(req.query.doctorId), 10) : undefined);
  res.json(
    await prisma.infoContent.findMany({
      where: doctorId ? { doctorId } : undefined,
      orderBy: { sortOrder: "asc" },
    })
  );
});

catalogRouter.post("/info", async (req, res) => {
  const { title, body, sortOrder } = req.body || {};
  const doctorId = scopedDoctorId(req) ?? req.body?.doctorId;
  if (!title || !body || !doctorId) {
    res.status(400).json({ error: "Título, contenido y doctor requeridos" });
    return;
  }
  if (!scopedDoctorId(req) && req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  res
    .status(201)
    .json(await prisma.infoContent.create({ data: { title, body, sortOrder: sortOrder ?? 0, doctorId } }));
});

catalogRouter.put("/info/:id", async (req, res) => {
  const scope = scopedDoctorId(req);
  const id = parseInt(req.params.id, 10);
  const existing = await prisma.infoContent.findUnique({ where: { id } });
  if (!existing || (scope && existing.doctorId !== scope)) {
    res.status(404).json({ error: "Texto no encontrado" });
    return;
  }
  const { title, body, sortOrder, active } = req.body || {};
  res.json(await prisma.infoContent.update({ where: { id }, data: { title, body, sortOrder, active } }));
});

catalogRouter.delete("/info/:id", async (req, res) => {
  const scope = scopedDoctorId(req);
  const id = parseInt(req.params.id, 10);
  const existing = await prisma.infoContent.findUnique({ where: { id } });
  if (!existing || (scope && existing.doctorId !== scope)) {
    res.status(404).json({ error: "Texto no encontrado" });
    return;
  }
  await prisma.infoContent.delete({ where: { id } });
  res.json({ ok: true });
});
