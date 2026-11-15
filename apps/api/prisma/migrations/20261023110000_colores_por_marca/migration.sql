-- AlterTable
ALTER TABLE "Marca" ADD COLUMN "colorPrimario" TEXT NOT NULL DEFAULT '#f5b301',
ADD COLUMN "colorMarca" TEXT NOT NULL DEFAULT '#ffffff';

-- DataMigration: copiar colores existentes del local a su marca
UPDATE "Marca" m
SET "colorPrimario" = t."colorPrimario",
    "colorMarca" = t."colorMarca"
FROM "Tenant" t
WHERE t."marcaId" = m.id;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "colorPrimario",
DROP COLUMN "colorMarca";
