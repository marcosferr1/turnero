import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // Usuario admin del panel
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      fullName: "Administración",
      role: "ADMIN",
    },
  });

  if (await prisma.doctor.count()) {
    // Base con datos: asegurar que la doctora existente tenga su usuario.
    const existing = await prisma.doctor.findFirst({ orderBy: { id: "asc" } });
    if (existing) {
      await prisma.user.upsert({
        where: { username: "dra.gonzalez" },
        update: {},
        create: {
          username: "dra.gonzalez",
          passwordHash: await bcrypt.hash("doctora123", 10),
          fullName: existing.name,
          role: "DOCTOR",
          doctorId: existing.id,
        },
      });
    }
    console.log("La base ya tiene datos; se aseguraron los usuarios admin y dra.gonzalez.");
    return;
  }

  // Doctora inicial
  const doctora = await prisma.doctor.create({
    data: { name: "Dra. María González", specialty: "Clínica médica" },
  });
  await prisma.doctor.update({
    where: { id: doctora.id },
    data: {
      whatsappPhoneNumberId: `sim-doctor-${doctora.id}`,
      whatsappDisplayPhone: "+54 9 261 555-0100",
    },
  });

  // Usuario del panel para la doctora
  await prisma.user.upsert({
    where: { username: "dra.gonzalez" },
    update: { doctorId: doctora.id },
    create: {
      username: "dra.gonzalez",
      passwordHash: await bcrypt.hash("doctora123", 10),
      fullName: doctora.name,
      role: "DOCTOR",
      doctorId: doctora.id,
    },
  });

  // Sedes propias de la doctora
  const centro = await prisma.location.create({
    data: {
      doctorId: doctora.id,
      name: "Consultorio Centro",
      address: "Av. San Martín 1234, Piso 2, Of. B",
      notes: "Tocar timbre 2B. Hay ascensor.",
    },
  });
  const norte = await prisma.location.create({
    data: {
      doctorId: doctora.id,
      name: "Clínica Norte",
      address: "Calle Belgrano 567",
      notes: "Anunciarse en recepción, consultorio 5.",
    },
  });

  // Disponibilidad semanal (1=lunes ... 5=viernes)
  await prisma.doctorSchedule.createMany({
    data: [
      { doctorId: doctora.id, locationId: centro.id, weekday: 1, startTime: "09:00", endTime: "13:00", slotMinutes: 30 },
      { doctorId: doctora.id, locationId: centro.id, weekday: 3, startTime: "09:00", endTime: "13:00", slotMinutes: 30 },
      { doctorId: doctora.id, locationId: norte.id, weekday: 2, startTime: "14:00", endTime: "18:00", slotMinutes: 30 },
      { doctorId: doctora.id, locationId: norte.id, weekday: 4, startTime: "14:00", endTime: "18:00", slotMinutes: 30 },
      { doctorId: doctora.id, locationId: centro.id, weekday: 5, startTime: "09:00", endTime: "12:00", slotMinutes: 30 },
    ],
  });

  // Textos de la sección "Información" del bot
  await prisma.infoContent.createMany({
    data: [
      {
        doctorId: doctora.id,
        title: "Obras sociales",
        body: "Atendemos OSDE, Swiss Medical, Galeno y particulares.\nTraé tu credencial y DNI a la consulta.",
        sortOrder: 1,
      },
      {
        doctorId: doctora.id,
        title: "Primera consulta",
        body: "Si es tu primera consulta, llegá 10 minutos antes para completar la ficha.\nTraé estudios previos si los tenés.",
        sortOrder: 2,
      },
      {
        doctorId: doctora.id,
        title: "Formas de pago",
        body: "Aceptamos efectivo, transferencia y tarjetas de débito/crédito.",
        sortOrder: 3,
      },
    ],
  });

  // Paciente y solicitud pendiente de ejemplo (para ver la bandeja del panel)
  const paciente = await prisma.patient.create({
    data: {
      phone: "5491155550001",
      fullName: "Juan Pérez",
      dni: "30123456",
      insurance: "OSDE",
    },
  });

  // Próximo lunes (weekday 1) a las 09:00
  const today = new Date().toISOString().slice(0, 10);
  let nextMonday = today;
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(today, i);
    if (new Date(`${candidate}T00:00:00Z`).getUTCDay() === 1) {
      nextMonday = candidate;
      break;
    }
  }

  await prisma.appointment.create({
    data: {
      doctorId: doctora.id,
      locationId: centro.id,
      patientId: paciente.id,
      date: nextMonday,
      time: "09:00",
      durationMinutes: 30,
      status: "PENDIENTE",
      motivo: "Control anual",
      createdVia: "bot",
    },
  });

  console.log("Seed completado:");
  console.log("  - Usuario admin del panel: admin / admin123");
  console.log("  - Usuario de la doctora: dra.gonzalez / doctora123");
  console.log(`  - ${doctora.name} con 2 sedes y agenda semanal`);
  console.log(`  - 1 solicitud pendiente de ejemplo (${nextMonday} 09:00)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
