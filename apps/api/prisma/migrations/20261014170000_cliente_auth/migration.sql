-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_telefono_key" ON "Cliente"("tenantId", "telefono");
