-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "estacion" TEXT NOT NULL DEFAULT 'BARRA';

-- DataMigration
UPDATE "Producto" SET "estacion" = 'BARMAN' WHERE "esCoctel" = true;
UPDATE "Producto" SET "estacion" = 'COCINA' WHERE "nombre" IN ('Nachos');

-- AlterTable
ALTER TABLE "Producto" DROP COLUMN "esCoctel";

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COCINA';
