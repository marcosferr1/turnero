-- CreateEnum
CREATE TYPE "AppointmentEventType" AS ENUM ('SOLICITUD_CREADA', 'CREADO_PANEL', 'CONFIRMADO', 'RECHAZADO', 'CANCELADO_PACIENTE', 'CANCELADO_DOCTOR', 'COMPLETADO', 'REPROGRAMADO', 'RECORDATORIO_ENVIADO');

-- CreateEnum
CREATE TYPE "AppointmentActor" AS ENUM ('BOT', 'PANEL', 'PATIENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "appointment_events" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "doctorId" INTEGER NOT NULL,
    "type" "AppointmentEventType" NOT NULL,
    "actor" "AppointmentActor" NOT NULL,
    "userId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_events_doctorId_createdAt_idx" ON "appointment_events"("doctorId", "createdAt");

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
