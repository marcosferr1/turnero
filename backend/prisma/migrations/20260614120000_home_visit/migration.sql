-- AlterTable
ALTER TABLE "locations" ADD COLUMN "isHomeVisit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "patientAddress" TEXT;
