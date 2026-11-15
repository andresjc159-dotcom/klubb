import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { tenantEfectivo } from '../common/tenant.util';

@Controller('contabilidad')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class ContabilidadController {
  constructor(private prisma: PrismaService) {}

  @Get('cierre')
  async cierre(@Req() req: any, @Query('mes') mes?: string) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');

    const ahora = new Date();
    const mesStr = mes || `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const [anio, m] = mesStr.split('-').map(Number);
    const inicio = new Date(Date.UTC(anio, m - 1, 1));
    const fin = new Date(Date.UTC(anio, m, 0, 23, 59, 59, 999));

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        createdAt: { gte: inicio, lte: fin },
        estado: { not: 'CANCELADO' },
      },
      include: { detalles: { include: { producto: true } } },
    });

    let subtotal = 0;
    let propinas = 0;
    let total = 0;
    let costoVentas = 0;
    for (const p of pedidos) {
      subtotal += p.subtotal || 0;
      propinas += p.propina || 0;
      total += p.total || 0;
      for (const d of p.detalles) {
        costoVentas += (d.producto?.costo ?? 0) * d.cantidad;
      }
    }

    const nominas = await this.prisma.nomina.findMany({
      where: { tenantId, fechaInicio: { gte: inicio, lte: fin } },
      include: { items: true },
    });
    let nominaNeto = 0;
    let nominaAportes = 0;
    let nominaProvisiones = 0;
    for (const n of nominas) {
      for (const i of n.items) {
        nominaNeto += i.neto || 0;
        nominaAportes += i.aportes || 0;
        nominaProvisiones += i.provisiones || 0;
      }
    }

    const cajas = await this.prisma.caja.findMany({
      where: {
        tenantId,
        cerradaEn: { gte: inicio, lte: fin },
        cierre: { not: null },
      },
    });
    const totalCajas = cajas.reduce((s, c) => s + (c.cierre ?? 0), 0);

    const pagos = await this.prisma.pago.findMany({
      where: { tenantId, createdAt: { gte: inicio, lte: fin } },
    });
    const porMetodo: Record<string, number> = {};
    for (const p of pagos) {
      porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto;
    }

    const margenBruto = total - costoVentas;
    const margenNeto = margenBruto - nominaNeto;

    return {
      mes: mesStr,
      ingresos: { subtotal, propinas, total },
      costoVentas,
      margenBruto,
      nomina: { neto: nominaNeto, aportes: nominaAportes, provisiones: nominaProvisiones },
      margenNeto,
      cajas: { cierres: cajas.length, total: totalCajas },
      porMetodo,
      pedidos: pedidos.length,
    };
  }
}
