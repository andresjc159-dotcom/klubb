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
import { tenantEfectivo, exigirPlanPro } from '../common/tenant.util';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

@Controller('reportes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class ReportesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async reportes(
    @Req() req: any,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    await exigirPlanPro(this.prisma, tenantId);

    const fin = hasta ? new Date(`${hasta}T23:59:59.999Z`) : new Date();
    const inicio = desde
      ? new Date(`${desde}T00:00:00.000Z`)
      : new Date(fin.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        createdAt: { gte: inicio, lte: fin },
        estado: { not: 'CANCELADO' },
      },
      include: {
        detalles: { include: { producto: true } },
        mesero: { select: { nombre: true } },
      },
    });

    // ---------- Ventas ----------
    let total = 0;
    let propinas = 0;
    for (const p of pedidos) {
      total += p.total || 0;
      propinas += p.propina || 0;
    }
    const pedidosCount = pedidos.length;
    const ticketPromedio = pedidosCount > 0 ? Math.round(total / pedidosCount) : 0;

    // ---------- Márgenes y rendimiento por producto ----------
    let ingresos = 0;
    let ganancia = 0;
    const productoStats: Record<
      string,
      { id: string; nombre: string; cantidad: number; total: number; ganancia: number; costoTotal: number }
    > = {};

    for (const p of pedidos) {
      for (const d of p.detalles) {
        const prod = d.producto;
        const nombre = prod?.nombre || 'Desconocido';
        const ing = d.precioUnitario * d.cantidad;
        const costo = (prod?.costo ?? 0) * d.cantidad;
        ingresos += ing;
        ganancia += ing - costo;
        const key = prod?.id || nombre;
        productoStats[key] = productoStats[key] || {
          id: key,
          nombre,
          cantidad: 0,
          total: 0,
          ganancia: 0,
          costoTotal: 0,
        };
        productoStats[key].cantidad += d.cantidad;
        productoStats[key].total += ing;
        productoStats[key].ganancia += ing - costo;
        productoStats[key].costoTotal += costo;
      }
    }

    const margenPct = ingresos > 0 ? Math.round((ganancia / ingresos) * 1000) / 10 : 0;

    const rendimientoProducto = Object.values(productoStats)
      .map((x) => ({
        nombre: x.nombre,
        cantidad: x.cantidad,
        total: x.total,
        ganancia: x.ganancia,
        margenPct: x.total > 0 ? Math.round((x.ganancia / x.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const topProductos = rendimientoProducto.slice(0, 5);

    // ---------- Ventas por día ----------
    const porDiaMap: Record<string, { total: number; pedidos: number }> = {};
    for (const p of pedidos) {
      const fecha = p.createdAt.toISOString().slice(0, 10);
      porDiaMap[fecha] = porDiaMap[fecha] || { total: 0, pedidos: 0 };
      porDiaMap[fecha].total += p.total || 0;
      porDiaMap[fecha].pedidos += 1;
    }
    const ventasPorDia = Object.entries(porDiaMap)
      .map(([fecha, v]) => ({ fecha, ...v }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // ---------- Ventas por hora ----------
    const porHoraMap: Record<number, { total: number; pedidos: number }> = {};
    for (let h = 0; h < 24; h++) porHoraMap[h] = { total: 0, pedidos: 0 };
    for (const p of pedidos) {
      const hora = p.createdAt.getUTCHours();
      porHoraMap[hora].total += p.total || 0;
      porHoraMap[hora].pedidos += 1;
    }
    const ventasPorHora = Object.entries(porHoraMap).map(([hora, v]) => ({
      hora: Number(hora),
      ...v,
    }));

    // ---------- Ventas por mesero ----------
    const porMeseroMap: Record<string, { total: number; pedidos: number }> = {};
    for (const p of pedidos) {
      const nombre = p.mesero?.nombre || 'Sin mesero';
      porMeseroMap[nombre] = porMeseroMap[nombre] || { total: 0, pedidos: 0 };
      porMeseroMap[nombre].total += p.total || 0;
      porMeseroMap[nombre].pedidos += 1;
    }
    const ventasPorMesero = Object.entries(porMeseroMap)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total);

    // ---------- Tiempos promedio ----------
    const sesiones = await this.prisma.sesionMesa.findMany({
      where: {
        tenantId,
        terminadaEn: { not: null, gte: inicio, lte: fin },
      },
      select: { creadoEn: true, terminadaEn: true },
    });
    const ocupaciones = sesiones
      .filter((s) => s.terminadaEn && s.creadoEn)
      .map((s) => (s.terminadaEn as Date).getTime() - s.creadoEn.getTime());
    const tiempoPromedioOcupacion = ocupaciones.length
      ? Math.round(ocupaciones.reduce((a, b) => a + b, 0) / ocupaciones.length / 60000)
      : 0;

    const pedidosOrdenados = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        createdAt: { gte: inicio, lte: fin },
        estado: { not: 'CANCELADO' },
      },
      select: { mesaId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const porMesaTiempos: Record<string, Date[]> = {};
    for (const p of pedidosOrdenados) {
      (porMesaTiempos[p.mesaId] = porMesaTiempos[p.mesaId] || []).push(p.createdAt);
    }
    const gaps: number[] = [];
    for (const times of Object.values(porMesaTiempos)) {
      for (let i = 1; i < times.length; i++) {
        gaps.push(times[i].getTime() - times[i - 1].getTime());
      }
    }
    const tiempoPromedioEntrePedidos = gaps.length
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 60000)
      : 0;

    const pedidosEntregados = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        listoEn: { not: null },
        entregadoEn: { not: null, gte: inicio, lte: fin },
      },
      select: { listoEn: true, entregadoEn: true },
    });
    const tiemposEntrega = pedidosEntregados
      .filter((p) => p.listoEn && p.entregadoEn)
      .map((p) => (p.entregadoEn as Date).getTime() - (p.listoEn as Date).getTime());
    const tiempoPromedioEntrega = tiemposEntrega.length
      ? Math.round(tiemposEntrega.reduce((a, b) => a + b, 0) / tiemposEntrega.length / 60000)
      : 0;

    // ---------- Inventario ----------
    const productos = await this.prisma.producto.findMany({
      where: { tenantId, activo: true },
      select: { id: true, nombre: true, stock: true, stockMinimo: true, emoji: true },
    });
    const agotados = productos.filter((p) => p.stock === 0);
    const bajoMinimo = productos.filter(
      (p) => p.stock > 0 && p.stock <= p.stockMinimo,
    );
    const sobreStock = productos.filter(
      (p) => p.stockMinimo > 0 && p.stock > p.stockMinimo * 2,
    );

    // ---------- Sugerencias (reglas) ----------
    const sugerencias: string[] = [];
    if (ventasPorHora.length > 0) {
      const pico = ventasPorHora.reduce((a, b) => (b.total > a.total ? b : a));
      if (pico.total > 0) {
        sugerencias.push(
          `Tu hora pico es a las ${pico.hora}:00. Refuerza personal y stock en esa franja.`,
        );
      }
    }
    if (ventasPorDia.length >= 3) {
      const flojo = ventasPorDia.reduce((a, b) => (b.total < a.total ? b : a));
      const diaNombre = DAYS[new Date(`${flojo.fecha}T12:00:00Z`).getUTCDay()];
      sugerencias.push(
        `El ${diaNombre.toLowerCase()} (${flojo.fecha}) es tu día más flojo. Considera una promoción para ese día.`,
      );
    }
    for (const p of agotados.slice(0, 3)) {
      sugerencias.push(`"${p.nombre}" está agotado. Repónlo lo antes posible.`);
    }
    for (const p of bajoMinimo.slice(0, 3)) {
      sugerencias.push(
        `"${p.nombre}" está bajo el mínimo (${p.stock}/${p.stockMinimo}). Programa reposición.`,
      );
    }
    const bajoMargen = rendimientoProducto
      .filter((x) => x.cantidad > 0 && x.margenPct < 20)
      .slice(0, 3);
    for (const x of bajoMargen) {
      sugerencias.push(
        `"${x.nombre}" tiene margen bajo (${x.margenPct}%). Revisa su precio o costo.`,
      );
    }
    if (ventasPorMesero.length > 0) {
      const top = ventasPorMesero[0];
      sugerencias.push(
        `"${top.nombre}" es tu mesero más productivo (${top.pedidos} pedidos). Reconoce su desempeño.`,
      );
    }
    if (sugerencias.length === 0) {
      sugerencias.push('Aún no hay suficiente información para generar sugerencias.');
    }

    return {
      rango: { desde: inicio.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) },
      ventas: { total, pedidos: pedidosCount, ticketPromedio, propinas },
      margen: { ganancia, ingresos, porcentaje: margenPct },
      topProductos,
      rendimientoProducto,
      ventasPorDia,
      ventasPorHora,
      ventasPorMesero,
      tiempos: {
        ocupacionPromedio: tiempoPromedioOcupacion,
        entrePedidosPromedio: tiempoPromedioEntrePedidos,
        entregaPromedio: tiempoPromedioEntrega,
      },
      inventario: {
        totalActivos: productos.length,
        agotados,
        bajoMinimo,
        sobreStock,
      },
      sugerencias,
    };
  }
}
