import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

/** Gestión de usuarios del panel. Solo ADMIN (se aplica en index.ts). */
export const usersRouter = Router();

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { doctor: true },
    orderBy: { id: "asc" },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      active: u.active,
      doctor: u.doctor ? { id: u.doctor.id, name: u.doctor.name, specialty: u.doctor.specialty } : null,
    }))
  );
});

/** Alta de doctora: crea el profesional y su usuario del panel en una transacción. */
usersRouter.post("/doctor", async (req, res) => {
  const { name, specialty, username, password } = req.body || {};
  if (!name || !specialty || !username || !password) {
    res.status(400).json({ error: "Nombre, especialidad, usuario y contraseña son requeridos" });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }
  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) {
    res.status(400).json({ error: "Ese nombre de usuario ya existe" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.create({ data: { name, specialty } });
    await tx.doctor.update({
      where: { id: doctor.id },
      data: { whatsappPhoneNumberId: `sim-doctor-${doctor.id}` },
    });
    const user = await tx.user.create({
      data: { username, passwordHash, fullName: name, role: "DOCTOR", doctorId: doctor.id },
    });
    return { doctor, user };
  });

  res.status(201).json({
    id: result.user.id,
    username: result.user.username,
    fullName: result.user.fullName,
    role: result.user.role,
    active: result.user.active,
    doctor: { id: result.doctor.id, name: result.doctor.name, specialty: result.doctor.specialty },
  });
});

usersRouter.post("/:id/reset-password", async (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  res.json({ ok: true });
});

usersRouter.post("/:id/toggle-active", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user!.id) {
    res.status(400).json({ error: "No podés desactivar tu propio usuario" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const updated = await prisma.user.update({ where: { id }, data: { active: !user.active } });
  res.json({ ok: true, active: updated.active });
});
