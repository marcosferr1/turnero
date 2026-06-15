import { prisma } from "../prisma";
import { getSlotsForDate, getSlotMinutes } from "./slots";
import {
  FullAppointment,
  notifyCanceladoPorDoctor,
  notifyConfirmado,
  notifyRechazado,
  notifyReprogramado,
} from "./notifications";
import { type EventContext, logAppointmentEvent } from "./appointmentEvents";

const FULL_INCLUDE = { doctor: true, location: true, patient: true } as const;

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getFull(id: number): Promise<FullAppointment> {
  const a = await prisma.appointment.findUnique({ where: { id }, include: FULL_INCLUDE });
  if (!a) throw new AppError(404, "Turno no encontrado");
  return a;
}

/** WhatsApp puede tardar (humanize 2–4 s); no bloquear la respuesta del panel. */
function notifyInBackground(label: string, fn: () => Promise<void>): void {
  void fn().catch((err) => console.error(`[notifications] Error al enviar ${label}:`, err));
}

export async function approve(id: number, ctx?: EventContext): Promise<FullAppointment> {
  const a = await getFull(id);
  if (a.status !== "PENDIENTE") throw new AppError(400, "El turno no está pendiente");
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "CONFIRMADO" },
    include: FULL_INCLUDE,
  });
  await logAppointmentEvent(updated.id, updated.doctorId, "CONFIRMADO", {
    actor: ctx?.actor ?? "PANEL",
    userId: ctx?.userId,
  });
  notifyInBackground("confirmación", () => notifyConfirmado(updated));
  return updated;
}

export async function reject(id: number, ctx?: EventContext): Promise<FullAppointment> {
  const a = await getFull(id);
  if (a.status !== "PENDIENTE") throw new AppError(400, "El turno no está pendiente");
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "RECHAZADO" },
    include: FULL_INCLUDE,
  });
  await logAppointmentEvent(updated.id, updated.doctorId, "RECHAZADO", {
    actor: ctx?.actor ?? "PANEL",
    userId: ctx?.userId,
  });
  notifyInBackground("rechazo", () => notifyRechazado(updated));
  return updated;
}

export async function cancelByDoctor(id: number, ctx?: EventContext): Promise<FullAppointment> {
  const a = await getFull(id);
  if (!["PENDIENTE", "CONFIRMADO"].includes(a.status))
    throw new AppError(400, "El turno no se puede cancelar en su estado actual");
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELADO_DOCTOR" },
    include: FULL_INCLUDE,
  });
  await logAppointmentEvent(updated.id, updated.doctorId, "CANCELADO_DOCTOR", {
    actor: ctx?.actor ?? "PANEL",
    userId: ctx?.userId,
  });
  notifyInBackground("cancelación", () => notifyCanceladoPorDoctor(updated));
  return updated;
}

export async function reschedule(
  id: number,
  date: string,
  time: string,
  locationId?: number,
  ctx?: EventContext
): Promise<FullAppointment> {
  const a = await getFull(id);
  if (!["PENDIENTE", "CONFIRMADO"].includes(a.status))
    throw new AppError(400, "El turno no se puede reprogramar en su estado actual");

  const targetLocation = locationId ?? a.locationId;
  const free = await getSlotsForDate(a.doctorId, targetLocation, date);
  if (!free.includes(time)) throw new AppError(400, "El horario elegido no está disponible");

  const updated = await prisma.appointment.update({
    where: { id },
    data: { date, time, locationId: targetLocation, reminderSentAt: null },
    include: FULL_INCLUDE,
  });
  await logAppointmentEvent(updated.id, updated.doctorId, "REPROGRAMADO", {
    actor: ctx?.actor ?? "PANEL",
    userId: ctx?.userId,
    metadata: { oldDate: a.date, oldTime: a.time, newDate: date, newTime: time },
  });
  notifyInBackground("reprogramación", () => notifyReprogramado(updated, a.date, a.time));
  return updated;
}

export async function complete(id: number, ctx?: EventContext): Promise<FullAppointment> {
  const a = await getFull(id);
  if (a.status !== "CONFIRMADO") throw new AppError(400, "Solo se completan turnos confirmados");
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "COMPLETADO" },
    include: FULL_INCLUDE,
  });
  await logAppointmentEvent(updated.id, updated.doctorId, "COMPLETADO", {
    actor: ctx?.actor ?? "PANEL",
    userId: ctx?.userId,
  });
  return updated;
}

export interface ManualAppointmentInput {
  doctorId: number;
  locationId: number;
  date: string;
  time: string;
  phone: string;
  fullName: string;
  dni?: string;
  insurance?: string;
  email?: string;
  motivo?: string;
  patientAddress?: string;
}

/** Alta manual desde el panel: queda confirmado directamente. */
export async function createManual(
  input: ManualAppointmentInput,
  ctx?: EventContext
): Promise<FullAppointment> {
  const location = await prisma.location.findUnique({ where: { id: input.locationId } });
  if (!location || location.doctorId !== input.doctorId) {
    throw new AppError(400, "La sede no pertenece a este profesional");
  }
  if (location.isHomeVisit && !input.patientAddress?.trim()) {
    throw new AppError(400, "La dirección del paciente es requerida para turnos a domicilio");
  }
  if (location.isVirtualVisit && !input.email?.trim()) {
    throw new AppError(400, "El email del paciente es requerido para consultas virtuales");
  }

  const free = await getSlotsForDate(input.doctorId, input.locationId, input.date);
  if (!free.includes(input.time)) throw new AppError(400, "El horario elegido no está disponible");

  const patient = await prisma.patient.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      fullName: input.fullName,
      dni: input.dni,
      insurance: input.insurance,
      email: input.email?.trim().toLowerCase() || null,
    },
    update: {
      fullName: input.fullName,
      ...(input.dni ? { dni: input.dni } : {}),
      ...(input.insurance ? { insurance: input.insurance } : {}),
      ...(input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
    },
  });

  const durationMinutes = await getSlotMinutes(input.doctorId, input.locationId);
  const created = await prisma.appointment.create({
    data: {
      doctorId: input.doctorId,
      locationId: input.locationId,
      patientId: patient.id,
      date: input.date,
      time: input.time,
      durationMinutes,
      motivo: input.motivo,
      patientAddress: location.isHomeVisit ? input.patientAddress?.trim() || null : null,
      status: "CONFIRMADO",
      createdVia: "panel",
    },
    include: FULL_INCLUDE,
  });
  await logAppointmentEvent(created.id, created.doctorId, "CREADO_PANEL", {
    actor: ctx?.actor ?? "PANEL",
    userId: ctx?.userId,
  });
  return created;
}
