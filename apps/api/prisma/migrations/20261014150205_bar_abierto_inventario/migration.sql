-- AlterTable
ALTER TABLE "Caja" ADD COLUMN     "inventarioInicio" JSONB;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "abierto" BOOLEAN NOT NULL DEFAULT false;
