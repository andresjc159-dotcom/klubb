-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "puntos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Promocion" ADD COLUMN "descuento" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable (nivel: enum -> text)
ALTER TABLE "Cliente" ALTER COLUMN "nivel" DROP DEFAULT,
ALTER COLUMN "nivel" SET DATA TYPE TEXT USING "nivel"::text,
ALTER COLUMN "nivel" SET DEFAULT '';

-- DropEnum
DROP TYPE "NivelCliente";

-- CreateEnum
CREATE TYPE "ModoPuntos" AS ENUM ('PRODUCTO', 'CONSUMO');

-- CreateTable
CREATE TABLE "ConfigPuntos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "modo" "ModoPuntos" NOT NULL DEFAULT 'CONSUMO',
    "montoBase" INTEGER NOT NULL DEFAULT 1000,
    "puntosBase" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConfigPuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NivelPuntos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puntosRequeridos" INTEGER NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NivelPuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductoPromocion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigPuntos_tenantId_key" ON "ConfigPuntos"("tenantId");
CREATE UNIQUE INDEX "NivelPuntos_tenantId_nombre_key" ON "NivelPuntos"("tenantId", "nombre");
CREATE UNIQUE INDEX "_ProductoPromocion_AB_unique" ON "_ProductoPromocion"("A", "B");
CREATE INDEX "_ProductoPromocion_B_index" ON "_ProductoPromocion"("B");

-- AddForeignKey
ALTER TABLE "ConfigPuntos" ADD CONSTRAINT "ConfigPuntos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NivelPuntos" ADD CONSTRAINT "NivelPuntos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProductoPromocion" ADD CONSTRAINT "_ProductoPromocion_A_fkey" FOREIGN KEY ("A") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ProductoPromocion" ADD CONSTRAINT "_ProductoPromocion_B_fkey" FOREIGN KEY ("B") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
