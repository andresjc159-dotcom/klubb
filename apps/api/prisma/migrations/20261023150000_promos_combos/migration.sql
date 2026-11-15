-- AlterTable
ALTER TABLE "Promocion" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'DESCUENTO',
ADD COLUMN     "precio" INTEGER,
ADD COLUMN     "imagenUrl" TEXT,
ADD COLUMN     "estacion" TEXT NOT NULL DEFAULT 'BARRA';

-- AlterTable
ALTER TABLE "DetallePedido" ALTER COLUMN "productoId" DROP NOT NULL,
ADD COLUMN     "promocionId" TEXT,
ADD COLUMN     "esPromo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nombre" TEXT,
ADD COLUMN     "estacion" TEXT;

-- CreateTable
CREATE TABLE "PromocionItem" (
    "id" TEXT NOT NULL,
    "promocionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "PromocionItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PromocionItem" ADD CONSTRAINT "PromocionItem_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromocionItem" ADD CONSTRAINT "PromocionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
