-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "miembroId" TEXT;

-- CreateTable
CREATE TABLE "SesionMesa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionMesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroSesion" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "clienteId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiembroSesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SesionMesa_mesaId_key" ON "SesionMesa"("mesaId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_miembroId_fkey" FOREIGN KEY ("miembroId") REFERENCES "MiembroSesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionMesa" ADD CONSTRAINT "SesionMesa_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroSesion" ADD CONSTRAINT "MiembroSesion_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionMesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
