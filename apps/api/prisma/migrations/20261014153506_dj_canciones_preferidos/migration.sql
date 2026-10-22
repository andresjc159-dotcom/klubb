-- DropForeignKey
ALTER TABLE "Cancion" DROP CONSTRAINT "Cancion_mesaId_fkey";

-- AlterTable
ALTER TABLE "Cancion" ADD COLUMN     "origen" TEXT NOT NULL DEFAULT 'CLIENTE',
ALTER COLUMN "mesaId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CancionPreferida" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancionPreferida_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Cancion" ADD CONSTRAINT "Cancion_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
