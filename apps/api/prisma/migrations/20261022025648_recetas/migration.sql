-- CreateTable
CREATE TABLE "RecetaInsumo" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecetaInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecetaInsumo_productoId_insumoId_key" ON "RecetaInsumo"("productoId", "insumoId");

-- AddForeignKey
ALTER TABLE "RecetaInsumo" ADD CONSTRAINT "RecetaInsumo_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaInsumo" ADD CONSTRAINT "RecetaInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
