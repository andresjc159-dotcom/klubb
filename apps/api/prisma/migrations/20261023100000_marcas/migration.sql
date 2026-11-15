-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER';

-- CreateTable
CREATE TABLE "Marca" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "marcaId" TEXT;
ALTER TABLE "User" ADD COLUMN "marcaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Marca_slug_key" ON "Marca"("slug");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: preservar la información existente
INSERT INTO "Marca" ("id", "nombre", "slug", "createdAt", "updatedAt")
VALUES ('marca-principal', 'Marca Principal', 'marca-principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Tenant" SET "marcaId" = 'marca-principal' WHERE "marcaId" IS NULL;
UPDATE "User" SET "marcaId" = 'marca-principal' WHERE "role" = 'MASTER';
