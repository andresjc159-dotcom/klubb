-- AlterTable
ALTER TABLE "Asistencia" ADD COLUMN     "latEntrada" DOUBLE PRECISION,
ADD COLUMN     "lonEntrada" DOUBLE PRECISION,
ADD COLUMN     "fotoEntrada" TEXT,
ADD COLUMN     "latSalida" DOUBLE PRECISION,
ADD COLUMN     "lonSalida" DOUBLE PRECISION,
ADD COLUMN     "fotoSalida" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
