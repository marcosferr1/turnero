import { AppointmentActor, AppointmentEventType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export interface EventContext {
  actor: AppointmentActor;
  userId?: number | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logAppointmentEvent(
  appointmentId: number,
  doctorId: number,
  type: AppointmentEventType,
  ctx: EventContext
): Promise<void> {
  try {
    await prisma.appointmentEvent.create({
      data: {
        appointmentId,
        doctorId,
        type,
        actor: ctx.actor,
        userId: ctx.userId ?? null,
        metadata: ctx.metadata ?? undefined,
      },
    });
  } catch (err) {
    console.error(`[events] No se pudo registrar ${type} del turno ${appointmentId}:`, err);
  }
}

const EVENT_INCLUDE = {
  appointment: {
    include: {
      patient: { select: { id: true, phone: true, fullName: true } },
      location: { select: { id: true, name: true, isHomeVisit: true, isVirtualVisit: true } },
    },
  },
  user: { select: { id: true, fullName: true } },
} as const;

export async function listAppointmentEvents(doctorId: number | undefined, limit: number) {
  return prisma.appointmentEvent.findMany({
    where: doctorId ? { doctorId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: EVENT_INCLUDE,
  });
}
