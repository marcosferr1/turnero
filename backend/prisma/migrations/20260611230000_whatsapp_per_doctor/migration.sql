-- WhatsApp por doctor: cada profesional con su número y conversaciones separadas.

-- Campos de WhatsApp en doctors
ALTER TABLE "doctors" ADD COLUMN "whatsappPhoneNumberId" TEXT;
ALTER TABLE "doctors" ADD COLUMN "whatsappDisplayPhone" TEXT;
CREATE UNIQUE INDEX "doctors_whatsappPhoneNumberId_key" ON "doctors"("whatsappPhoneNumberId");

-- Info por doctor
ALTER TABLE "info_contents" ADD COLUMN "doctorId" INTEGER;
UPDATE "info_contents" SET "doctorId" = (SELECT MIN("id") FROM "doctors");
ALTER TABLE "info_contents" ALTER COLUMN "doctorId" SET NOT NULL;
ALTER TABLE "info_contents" ADD CONSTRAINT "info_contents_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conversaciones por (teléfono + doctor)
ALTER TABLE "conversations" ADD COLUMN "doctorId" INTEGER;
UPDATE "conversations" SET "doctorId" = (SELECT MIN("id") FROM "doctors");
ALTER TABLE "conversations" ALTER COLUMN "doctorId" SET NOT NULL;
DROP INDEX IF EXISTS "conversations_phone_key";
CREATE UNIQUE INDEX "conversations_phone_doctorId_key" ON "conversations"("phone", "doctorId");
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Log de mensajes con doctor
ALTER TABLE "message_log" ADD COLUMN "doctorId" INTEGER;
DROP INDEX IF EXISTS "message_log_phone_createdAt_idx";
CREATE INDEX "message_log_phone_doctorId_createdAt_idx" ON "message_log"("phone", "doctorId", "createdAt");

-- Número simulado para la doctora de demo (modo simulator)
UPDATE "doctors" SET
  "whatsappPhoneNumberId" = 'sim-doctor-' || "id"::text,
  "whatsappDisplayPhone" = '+54 9 261 555-0100'
WHERE "whatsappPhoneNumberId" IS NULL;
