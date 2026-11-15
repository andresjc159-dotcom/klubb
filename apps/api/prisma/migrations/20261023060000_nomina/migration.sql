-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "entradaEn" TIMESTAMP(3),
    "salidaEn" TIMESTAMP(3),
    "horas" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoNomina" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "calculo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptoNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nomina" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'GENERADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NominaItem" (
    "id" TEXT NOT NULL,
    "nominaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "base" INTEGER NOT NULL,
    "propinas" INTEGER NOT NULL,
    "comisiones" INTEGER NOT NULL,
    "otrosIngresos" INTEGER NOT NULL,
    "deducciones" INTEGER NOT NULL,
    "neto" INTEGER NOT NULL,
    CONSTRAINT "NominaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_tenantId_userId_fecha_key" ON "Asistencia"("tenantId", "userId", "fecha");

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptoNomina" ADD CONSTRAINT "ConceptoNomina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nomina" ADD CONSTRAINT "Nomina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NominaItem" ADD CONSTRAINT "NominaItem_nominaId_fkey" FOREIGN KEY ("nominaId") REFERENCES "Nomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NominaItem" ADD CONSTRAINT "NominaItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
