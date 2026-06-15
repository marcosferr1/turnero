-- Cuentas por doctora: User.doctorId, User.active y Location.doctorId (sedes propias)

-- users
ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "doctorId" INTEGER;

CREATE UNIQUE INDEX "users_doctorId_key" ON "users"("doctorId");

ALTER TABLE "users" ADD CONSTRAINT "users_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- locations: columna nullable, backfill con el primer doctor existente y luego NOT NULL
ALTER TABLE "locations" ADD COLUMN "doctorId" INTEGER;

UPDATE "locations" SET "doctorId" = (SELECT MIN("id") FROM "doctors");

ALTER TABLE "locations" ALTER COLUMN "doctorId" SET NOT NULL;

ALTER TABLE "locations" ADD CONSTRAINT "locations_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
