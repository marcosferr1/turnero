import { Router } from "express";
import { prisma } from "../prisma";
import { buildWhatsAppUrl } from "../lib/whatsappLink";
import { getAvailableDays } from "../services/slots";

export const publicRouter = Router();

/** Perfil público de un profesional (sin auth). */
publicRouter.get("/doctors/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const doctor = await prisma.doctor.findFirst({
    where: { id, active: true },
    select: {
      id: true,
      name: true,
      specialty: true,
      whatsappDisplayPhone: true,
      locations: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          notes: true,
          isHomeVisit: true,
          schedules: {
            orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
            select: { weekday: true, startTime: true, endTime: true, slotMinutes: true },
          },
        },
      },
    },
  });

  if (!doctor) {
    res.status(404).json({ error: "Profesional no encontrado" });
    return;
  }

  const locations = await Promise.all(
    doctor.locations.map(async (loc) => ({
      id: loc.id,
      name: loc.name,
      address: loc.isHomeVisit ? "Atención en el domicilio del paciente" : loc.address,
      notes: loc.notes,
      isHomeVisit: loc.isHomeVisit,
      schedules: loc.schedules,
      availability: await getAvailableDays(doctor.id, loc.id),
    }))
  );

  res.json({
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    whatsappDisplayPhone: doctor.whatsappDisplayPhone,
    whatsappUrl: buildWhatsAppUrl(doctor.whatsappDisplayPhone),
    locations,
  });
});

/** Listado mínimo de profesionales activos (página índice opcional). */
publicRouter.get("/doctors", async (_req, res) => {
  const doctors = await prisma.doctor.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      specialty: true,
      whatsappDisplayPhone: true,
    },
  });
  res.json(
    doctors.map((d) => ({
      ...d,
      whatsappUrl: buildWhatsAppUrl(d.whatsappDisplayPhone),
    }))
  );
});
