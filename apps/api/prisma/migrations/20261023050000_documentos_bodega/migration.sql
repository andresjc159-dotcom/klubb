-- CreateEnum
CREATE TYPE "TipoDocumentoBodega" AS ENUM ('INGRESO', 'SALIDA');

-- CreateTable
CREATE TABLE "DocumentoBodega" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoDocumentoBodega" NOT NULL,
    "numero" TEXT NOT NULL,
    "factura" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoBodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoBodegaItem" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    CONSTRAINT "DocumentoBodegaItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentoBodega" ADD CONSTRAINT "DocumentoBodega_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentoBodegaItem" ADD CONSTRAINT "DocumentoBodegaItem_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoBodega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentoBodegaItem" ADD CONSTRAINT "DocumentoBodegaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
