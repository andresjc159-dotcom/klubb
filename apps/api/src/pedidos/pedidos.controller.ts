import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EstadoPedido, MetodoPago, Prisma } from '@prisma/client';
import { tenantEfectivo } from '../common/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Controller('pedidos')
@UseGuards(AuthGuard('jwt'))
export class PedidosController {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  @Get()
  list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.pedido.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        estado: { notIn: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO] },
      },
      include: {
        mesa: { include: { zona: true } },
        detalles: { include: { producto: true } },
        mesero: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Patch(':id/estado')
  async updateEstado(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { estado: EstadoPedido },
  ) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const data: Prisma.PedidoUpdateInput = { estado: body.estado };
    if (body.estado === EstadoPedido.LISTO) data.listoEn = new Date();
    if (body.estado === EstadoPedido.ENTREGADO) data.entregadoEn = new Date();

    const updated = await this.prisma.pedido.update({
      where: { id },
      data,
      include: { mesa: true, detalles: { include: { producto: true } } },
    });

    this.events.emitToTenant(pedido.tenantId, 'pedido:actualizado', updated);
    this.events.emitToMesa(pedido.mesaId, 'pedido:estado', updated);
    if (body.estado === EstadoPedido.LISTO && updated.modo === 'MESA') {
      let meseroId = updated.meseroId;
      if (!meseroId) {
        const asignacion = await this.prisma.asignacionMesero.findFirst({
          where: { mesaId: pedido.mesaId },
        });
        meseroId = asignacion?.userId ?? null;
      }
      if (meseroId) {
        this.events.emitToUser(meseroId, 'pedido:listo', {
          codigo: updated.codigo,
          mesa: updated.mesa.nombre,
          detalles: updated.detalles.map(
            (d) => `${d.cantidad}x ${d.producto.nombre}`,
          ),
        });
      }
    }
    return updated;
  }

  @Patch(':id/asignar')
  async asignar(
    @Param('id') id: string,
    @Body() body: { meseroId: string },
  ) {
    const updated = await this.prisma.pedido.update({
      where: { id },
      data: { meseroId: body.meseroId },
      include: { mesa: { include: { zona: true } }, detalles: { include: { producto: true } } },
    });
    this.events.emitToTenant(updated.tenantId, 'pedido:actualizado', updated);
    return updated;
  }

  @Patch(':id/cancelar')
  async cancelar(@Req() req: any, @Param('id') id: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado !== EstadoPedido.RECIBIDO) {
      throw new BadRequestException('No se puede cancelar: el pedido ya está en preparación');
    }
    const recetas = await this.prisma.recetaInsumo.findMany({
      where: { productoId: { in: pedido.detalles.map((d) => d.productoId) } },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const d of pedido.detalles) {
        await tx.producto.update({
          where: { id: d.productoId },
          data: { stock: { increment: d.cantidad } },
        });
        await tx.movimientoInventario.create({
          data: {
            tenantId: pedido.tenantId,
            productoId: d.productoId,
            tipo: 'DEVOLUCION',
            cantidad: d.cantidad,
          },
        });
        const rec = recetas.filter((r) => r.productoId === d.productoId);
        for (const r of rec) {
          await tx.insumo.update({
            where: { id: r.insumoId },
            data: { cantidad: { increment: r.cantidad * d.cantidad } },
          });
        }
      }
      return tx.pedido.update({
        where: { id },
        data: {
          estado: EstadoPedido.CANCELADO,
          canceladoEn: new Date(),
          canceladoPor: req.user.nombre,
        },
        include: { mesa: { include: { zona: true } }, detalles: { include: { producto: true } } },
      });
    });
    this.events.emitToTenant(updated.tenantId, 'pedido:actualizado', updated);
    return updated;
  }

  @Patch(':id/pagar')
  async pagar(
    @Param('id') id: string,
    @Body() body?: { metodoPago?: MetodoPago },
  ) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.pagadoEn) {
      throw new BadRequestException('El pedido ya está pagado');
    }
    const metodo = body?.metodoPago || pedido.metodoPago || MetodoPago.EFECTIVO;
    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.pedido.update({
        where: { id },
        data: { pagadoEn: new Date(), metodoPago: metodo },
        include: { mesa: { include: { zona: true } }, detalles: { include: { producto: true } } },
      });
      await tx.pago.create({
        data: {
          tenantId: pedido.tenantId,
          pedidoId: id,
          metodo,
          monto: pedido.total,
          estado: 'aprobado',
        },
      });

      await this.acreditarPuntos(tx, pedido);

      return p;
    });
    this.events.emitToTenant(updated.tenantId, 'pedido:actualizado', updated);
    return updated;
  }

  private async acreditarPuntos(tx: any, pedido: any) {
    if (!pedido.miembroId) return;
    const miembro = await tx.miembroSesion.findUnique({
      where: { id: pedido.miembroId },
    });
    if (!miembro?.clienteId) return;
    const cliente = await tx.cliente.findUnique({
      where: { id: miembro.clienteId },
    });
    if (!cliente) return;
    const multiplicador: Record<string, number> = {
      BRONCE: 1,
      PLATA: 1.25,
      ORO: 1.5,
      BLACK: 2,
    };
    const mult = multiplicador[cliente.nivel] || 1;
    const pts = Math.floor(pedido.total / 1000) * mult;
    const nuevosPuntos = cliente.puntos + pts;
    const nivel =
      nuevosPuntos >= 3000
        ? 'BLACK'
        : nuevosPuntos >= 1500
          ? 'ORO'
          : nuevosPuntos >= 500
            ? 'PLATA'
            : 'BRONCE';
    await tx.cliente.update({
      where: { id: cliente.id },
      data: { puntos: nuevosPuntos, nivel },
    });
  }

  @Post('pagar-mesa')
  async pagarMesa(
    @Body() body: { mesaId: string; metodoPago?: MetodoPago },
  ) {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        mesaId: body.mesaId,
        pagadoEn: null,
        estado: { not: 'CANCELADO' },
      },
    });
    if (pedidos.length === 0) {
      throw new BadRequestException('No hay pedidos por pagar en esta mesa');
    }
    const metodo = body.metodoPago || MetodoPago.EFECTIVO;
    const total = pedidos.reduce((s, p) => s + p.total, 0);

    await this.prisma.$transaction(async (tx) => {
      for (const p of pedidos) {
        await tx.pedido.update({
          where: { id: p.id },
          data: { pagadoEn: new Date(), metodoPago: metodo },
        });
        await tx.pago.create({
          data: {
            tenantId: p.tenantId,
            pedidoId: p.id,
            metodo,
            monto: p.total,
            estado: 'aprobado',
          },
        });
        await this.acreditarPuntos(tx, p);
      }
    });

    if (pedidos.length > 0) {
      this.events.emitToTenant(pedidos[0].tenantId, 'pedido:actualizado', {});
    }
    return { ok: true, total, pagados: pedidos.length };
  }
}
