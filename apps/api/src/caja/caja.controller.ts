import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { tenantEfectivo } from '../common/tenant.util';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('caja')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.CAJERO, Role.ADMIN, Role.MASTER)
export class CajaController {
  constructor(private prisma: PrismaService) {}

  private async buildResumen(caja: any) {
    if (!caja) return null;
    const fin = caja.cerradaEn ?? new Date();

    const pagos = await this.prisma.pago.findMany({
      where: {
        tenantId: caja.tenantId,
        createdAt: { gte: caja.abiertaEn, lte: fin },
      },
    });
    const totalRecaudado = pagos.reduce((s, p) => s + p.monto, 0);

    const porMetodo: Record<string, number> = {};
    for (const p of pagos) {
      porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + p.monto;
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        tenantId: caja.tenantId,
        entregadoEn: { not: null, gte: caja.abiertaEn, lte: fin },
      },
      include: { mesero: { select: { nombre: true } } },
    });
    const porMesero: Record<string, { pedidos: number; total: number }> = {};
    let propinas = 0;
    for (const p of pedidos) {
      propinas += p.propina;
      const nombre = p.mesero?.nombre || 'Sin mesero';
      porMesero[nombre] = porMesero[nombre] || { pedidos: 0, total: 0 };
      porMesero[nombre].pedidos += 1;
      porMesero[nombre].total += p.total;
    }

    const pedidosVenta = await this.prisma.pedido.findMany({
      where: {
        tenantId: caja.tenantId,
        createdAt: { gte: caja.abiertaEn, lte: fin },
      },
      include: { detalles: { include: { producto: true } } },
    });
    const vendidosMap: Record<string, { cantidad: number; total: number }> = {};
    for (const p of pedidosVenta) {
      for (const d of p.detalles) {
        const nombre = d.producto?.nombre || 'Desconocido';
        vendidosMap[nombre] = vendidosMap[nombre] || { cantidad: 0, total: 0 };
        vendidosMap[nombre].cantidad += d.cantidad;
        vendidosMap[nombre].total += d.cantidad * d.precioUnitario;
      }
    }
    const productosVendidos = Object.entries(vendidosMap).map(([nombre, v]) => ({
      nombre,
      cantidad: v.cantidad,
      total: v.total,
    }));

    const inventarioFinal = await this.prisma.producto.findMany({
      where: { tenantId: caja.tenantId },
      select: { nombre: true, stock: true },
    });

    const pedidosCancelados = await this.prisma.pedido.findMany({
      where: {
        tenantId: caja.tenantId,
        estado: 'CANCELADO',
        canceladoEn: { gte: caja.abiertaEn, lte: fin },
      },
      include: { mesa: { select: { nombre: true } } },
      orderBy: { canceladoEn: 'desc' },
    });

    const meseros = await this.prisma.user.findMany({
      where: { tenantId: caja.tenantId, role: Role.MESERO, activo: true },
      select: { id: true, nombre: true, base: true },
    });
    const basesMeseros = meseros.filter((m) => m.base > 0);
    const sumaBases = basesMeseros.reduce((s, m) => s + m.base, 0);

    return {
      caja,
      baseInicial: caja.apertura,
      basesMeseros,
      sumaBases,
      baseTotal: caja.apertura + sumaBases,
      cierre: caja.cierre,
      totalRecaudado,
      porMetodo,
      porMesero,
      propinas,
      productosVendidos,
      inventarioInicio: caja.inventarioInicio ?? [],
      inventarioFinal,
      pedidosCancelados,
    };
  }

  @Post('abrir')
  async abrir(@Req() req: any, @Body() body: { apertura: number }) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    const abierta = await this.prisma.caja.findFirst({
      where: { tenantId, cerradaEn: null },
    });
    if (abierta) return abierta;

    const productos = await this.prisma.producto.findMany({
      where: { tenantId },
      select: { nombre: true, stock: true },
    });
    const inventarioInicio = productos.map((p) => ({ nombre: p.nombre, stock: p.stock }));

    return this.prisma.caja.create({
      data: {
        tenantId,
        userId: req.user.userId,
        apertura: Number(body.apertura ?? 0),
        inventarioInicio,
      },
    });
  }

  @Post('cerrar')
  async cerrar(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const caja = await this.prisma.caja.findFirst({
      where: { tenantId, cerradaEn: null },
    });
    if (!caja) throw new BadRequestException('No hay caja abierta');
    const pagos = await this.prisma.pago.findMany({
      where: { tenantId, createdAt: { gte: caja.abiertaEn } },
    });
    const recaudado = pagos.reduce((s, p) => s + p.monto, 0);
    const cerrada = await this.prisma.caja.update({
      where: { id: caja.id },
      data: { cerradaEn: new Date(), cierre: caja.apertura + recaudado },
      include: { user: { select: { nombre: true } } },
    });
    return this.buildResumen(cerrada);
  }

  @Get('actual')
  actual(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.caja.findFirst({
      where: { tenantId, cerradaEn: null },
      orderBy: { abiertaEn: 'desc' },
      include: { user: { select: { nombre: true } } },
    });
  }

  @Get('movimientos')
  async movimientos(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const caja = await this.prisma.caja.findFirst({
      where: { tenantId, cerradaEn: null },
      orderBy: { abiertaEn: 'desc' },
    });
    if (!caja) return [];
    return this.prisma.cajaMovimiento.findMany({
      where: { cajaId: caja.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('movimientos')
  async crearMovimiento(
    @Req() req: any,
    @Body()
    body: {
      tipo: string;
      monto: number;
      metodo?: string;
      concepto?: string;
      productoId?: string;
      cantidad?: number;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.monto || body.monto <= 0) throw new BadRequestException('Monto inválido');
    const caja = await this.prisma.caja.findFirst({
      where: { tenantId, cerradaEn: null },
    });
    if (!caja) throw new BadRequestException('No hay caja abierta');

    const movimiento = await this.prisma.cajaMovimiento.create({
      data: {
        cajaId: caja.id,
        tipo: body.tipo === 'EGRESO' ? 'EGRESO' : 'INGRESO',
        monto: Number(body.monto),
        metodo: (body.metodo as any) || null,
        concepto: body.concepto,
      },
    });

    if (body.tipo !== 'EGRESO' && body.productoId && body.cantidad) {
      const producto = await this.prisma.producto.findFirst({
        where: { id: body.productoId, tenantId },
      });
      if (!producto) throw new BadRequestException('Producto no encontrado');
      const cant = Number(body.cantidad);
      if (cant <= 0) throw new BadRequestException('Cantidad inválida');
      await this.prisma.producto.update({
        where: { id: body.productoId },
        data: { stock: { decrement: cant } },
      });
      await this.prisma.movimientoInventario.create({
        data: {
          tenantId,
          productoId: body.productoId,
          tipo: 'VENTA',
          cantidad: -cant,
        },
      });
    }

    return movimiento;
  }

  @Get('meseros')
  async meseros(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.user.findMany({
      where: { tenantId, role: Role.MESERO, activo: true },
      select: { id: true, nombre: true, base: true },
      orderBy: { nombre: 'asc' },
    });
  }

  @Patch('meseros/:id')
  async editarBaseMesero(
    @Param('id') id: string,
    @Body() body: { base: number },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { base: Number(body.base ?? 0) },
      select: { id: true, nombre: true, base: true },
    });
  }

  @Get('historial')
  async historial(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const cajas = await this.prisma.caja.findMany({
      where: { tenantId, cerradaEn: { not: null } },
      orderBy: { cerradaEn: 'desc' },
      include: { user: { select: { nombre: true } } },
    });
    return cajas.map((c) => ({
      id: c.id,
      apertura: c.apertura,
      cierre: c.cierre,
      abiertaEn: c.abiertaEn,
      cerradaEn: c.cerradaEn,
      usuario: c.user?.nombre,
    }));
  }

  @Get('resumen')
  async resumen(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const caja = await this.prisma.caja.findFirst({
      where: { tenantId },
      orderBy: { abiertaEn: 'desc' },
      include: { user: { select: { nombre: true } } },
    });
    return this.buildResumen(caja);
  }

  @Get(':id')
  async detalle(@Req() req: any, @Param('id') id: string) {
    const caja = await this.prisma.caja.findUnique({
      where: { id },
      include: { user: { select: { nombre: true } } },
    });
    if (!caja) throw new BadRequestException('Caja no encontrada');
    return this.buildResumen(caja);
  }
}
