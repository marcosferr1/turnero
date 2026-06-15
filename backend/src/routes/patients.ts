import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { scopedDoctorId } from "../middleware/auth";

export const patientsRouter = Router();

patientsRouter.get("/", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const scope = scopedDoctorId(req);

  const where: Prisma.PatientWhereInput = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { dni: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  // Una doctora solo ve pacientes que tuvieron turnos con ella.
  if (scope) where.appointments = { some: { doctorId: scope } };

  const patients = await prisma.patient.findMany({
    where,
    include: {
      _count: {
        select: { appointments: scope ? { where: { doctorId: scope } } : true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(patients);
});

patientsRouter.get("/:id", async (req, res) => {
  const scope = scopedDoctorId(req);
  const patient = await prisma.patient.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: {
      appointments: {
        where: scope ? { doctorId: scope } : undefined,
        include: { doctor: true, location: true },
        orderBy: [{ date: "desc" }, { time: "desc" }],
      },
    },
  });
  if (!patient || (scope && patient.appointments.length === 0)) {
    res.status(404).json({ error: "Paciente no encontrado" });
    return;
  }
  res.json(patient);
});
