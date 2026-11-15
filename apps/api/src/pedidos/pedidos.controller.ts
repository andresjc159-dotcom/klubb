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
import { EstadoPedido, MetodoPago, ModoEntrega, Prisma } from '@prisma/client';
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
        estado: { not: EstadoPedido.CANCELADO },
      },
      include: {
        mesa: { include: { zona: true } },
        detalles: { include: { producto: true } },
        mesero: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('mesa')
  async crearPedidoMesa(
    @Req() req: any,
    @Body()
    body: {
      mesaId: string;
      items: Array<{ productoId?: string; promocionId?: string; cantidad: number; notas?: string }>;
      metodoPago?: MetodoPago;
      modo?: ModoEntrega;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.mesaId || !body.items?.length) {
      throw new BadRequestException('Mesa y productos son requeridos');
    }
    const mesa = await this.prisma.mesa.findUnique({
      where: { id: body.mesaId },
      include: { tenant: true },
    });
    if (!mesa || mesa.tenantId !== tenantId) {
      throw new NotFoundException('Mesa no encontrada');
    }

    const promos = await this.prisma.promocion.findMany({
      where: { tenantId, activa: true },
      include: { productos: true, items: { include: { producto: true } } },
    });
    const precioPromoMap: Record<string, number> = {};
    for (const p of promos) {
      if (p.tipo === 'PRECIO_FIJO' && p.precio != null) {
        for (const prod of p.productos) precioPromoMap[prod.id] = p.precio;
      }
    }
    const combosMap = new Map(
      promos.filter((p) => p.tipo === 'COMBO').map((p) => [p.id, p]),
    );

    const productIds = body.items
      .filter((i) => i.productoId)
      .map((i) => i.productoId as string);
    const comboConstituyentes = promos
      .filter((p) => p.tipo === 'COMBO')
      .flatMap((p) => p.items.map((it) => it.productoId));
    const allProductIds = Array.from(new Set([...productIds, ...comboConstituyentes]));

    const productos = await this.prisma.producto.findMany({
      where: { id: { in: allProductIds } },
    });
    const recetas = await this.prisma.recetaInsumo.findMany({
      where: { productoId: { in: allProductIds } },
    });

    let subtotal = 0;
    const detalles = body.items.map((item) => {
      if (item.promocionId) {
        const combo = combosMap.get(item.promocionId);
        if (!combo) throw new NotFoundException('Combo no encontrado');
        const precio = combo.precio ?? 0;
        subtotal += precio * item.cantidad;
        return {
          productoId: null,
          promocionId: combo.id,
          esPromo: true,
          nombre: combo.nombre,
          estacion: combo.estacion,
          cantidad: item.cantidad,
          precioUnitario: precio,
          notas: item.notas,
        };
      }
      const producto = productos.find((p) => p.id === item.productoId);
      if (!producto) throw new NotFoundException('Producto no encontrado');
      const precio = precioPromoMap[producto.id] ?? producto.precio;
      subtotal += precio * item.cantidad;
      return {
        productoId: producto.id,
        cantidad: item.cantidad,
        precioUnitario: precio,
        notas: item.notas,
      };
    });

    const codigo = `#B-${await this.prisma.pedido.count() + 1}`;
    const pin = Math.floor(1000 + Math.random() * 9000);

    const pedido = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pedido.create({
        data: {
          tenantId,
          mesaId: mesa.id,
          codigo,
          estado: EstadoPedido.RECIBIDO,
          modo: body.modo ?? ModoEntrega.MESA,
          subtotal,
          propina: 0,
          total: subtotal,
          metodoPago: body.metodoPago ?? MetodoPago.EFECTIVO,
          pin,
          meseroId: req.user.userId,
          detalles: { create: detalles },
        },
        include: { mesa: { include: { zona: true } }, detalles: { include: { producto: true } } },
      });

      for (const d of detalles) {
        if (d.esPromo) {
          const combo = combosMap.get(d.promocionId as string);
          if (!combo) continue;
          for (const it of combo.items) {
            await tx.producto.update({
              where: { id: it.productoId },
              data: { stock: { decrement: it.cantidad * d.cantidad } },
            });
            await tx.movimientoInventario.create({
              data: {
                tenantId,
                productoId: it.productoId,
                tipo: 'VENTA',
                cantidad: -(it.cantidad * d.cantidad),
              },
            });
            const rec = recetas.filter((r) => r.productoId === it.productoId);
            for (const r of rec) {
              await tx.insumo.update({
                where: { id: r.insumoId },
                data: { cantidad: { decrement: r.cantidad * it.cantidad * d.cantidad } },
              });
            }
          }
        } else {
          await tx.producto.update({
            where: { id: d.productoId as string },
            data: { stock: { decrement: d.cantidad } },
          });
          await tx.movimientoInventario.create({
            data: {
              tenantId,
              productoId: d.productoId as string,
              tipo: 'VENTA',
              cantidad: -d.cantidad,
            },
          });
          const rec = recetas.filter((r) => r.productoId === d.productoId);
          for (const r of rec) {
            await tx.insumo.update({
              where: { id: r.insumoId },
              data: { cantidad: { decrement: r.cantidad * d.cantidad } },
            });
          }
        }
      }

      return created;
    });

    this.events.emitToTenant(tenantId, 'pedido:nuevo', pedido);
    this.events.emitToMesa(mesa.id, 'mesa:actualizada', {});
    return pedido;
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
            (d) => `${d.cantidad}x ${d.nombre || d.producto?.nombre}`,
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
      where: { productoId: { in: pedido.detalles.map((d) => d.productoId).filter(Boolean) as string[] } },
    });
    const promoIds = pedido.detalles
      .filter((d) => d.esPromo && d.promocionId)
      .map((d) => d.promocionId as string);
    const promos = promoIds.length
      ? await this.prisma.promocion.findMany({
          where: { id: { in: promoIds } },
          include: { items: true },
        })
      : [];
    const combosMap = new Map(promos.map((p) => [p.id, p]));
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const d of pedido.detalles) {
        if (d.esPromo) {
          const combo = combosMap.get(d.promocionId as string);
          if (!combo) continue;
          for (const it of combo.items) {
            await tx.producto.update({
              where: { id: it.productoId },
              data: { stock: { increment: it.cantidad * d.cantidad } },
            });
            await tx.movimientoInventario.create({
              data: {
                tenantId: pedido.tenantId,
                productoId: it.productoId,
                tipo: 'DEVOLUCION',
                cantidad: it.cantidad * d.cantidad,
              },
            });
            const rec = recetas.filter((r) => r.productoId === it.productoId);
            for (const r of rec) {
              await tx.insumo.update({
                where: { id: r.insumoId },
                data: { cantidad: { increment: r.cantidad * it.cantidad * d.cantidad } },
              });
            }
          }
        } else if (d.productoId) {
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
    let subio: any = null;
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

      subio = await this.acreditarPuntos(tx, pedido);

      return p;
    });
    if (subio) {
      this.events.emitToTenant(subio.tenantId, 'cliente:subio-nivel', subio);
      this.events.emitToMesa(subio.mesaId, 'cliente:subio-nivel', subio);
    }
    this.events.emitToTenant(updated.tenantId, 'pedido:actualizado', updated);
    this.events.emitToMesa(updated.mesaId, 'pedido:pagado', { pedidoId: id });
    return updated;
  }

  private async acreditarPuntos(tx: any, pedido: any) {
    if (!pedido.miembroId) return null;
    const miembro = await tx.miembroSesion.findUnique({
      where: { id: pedido.miembroId },
    });
    if (!miembro?.clienteId) return null;
    const cliente = await tx.cliente.findUnique({
      where: { id: miembro.clienteId },
    });
    if (!cliente) return null;

    const config = await tx.configPuntos.findUnique({
      where: { tenantId: pedido.tenantId },
    });
    if (!config || !config.habilitado) return null;

    let puntos = 0;
    if (config.modo === 'PRODUCTO') {
      const detalles = await tx.detallePedido.findMany({
        where: { pedidoId: pedido.id },
        include: { producto: true },
      });
      puntos = detalles.reduce(
        (s: number, d: any) => s + (d.producto?.puntos ?? 0) * d.cantidad,
        0,
      );
    } else {
      const base = config.montoBase || 1;
      puntos = Math.floor(pedido.subtotal / base) * config.puntosBase;
    }

    if (puntos <= 0) return null;

    const nuevosPuntos = cliente.puntos + puntos;
    const niveles = await tx.nivelPuntos.findMany({
      where: { tenantId: pedido.tenantId },
      orderBy: { puntosRequeridos: 'desc' },
    });
    let nivel = cliente.nivel;
    for (const n of niveles) {
      if (nuevosPuntos >= n.puntosRequeridos) {
        nivel = n.nombre;
        break;
      }
    }

    await tx.cliente.update({
      where: { id: cliente.id },
      data: { puntos: nuevosPuntos, nivel },
    });

    if (nivel !== cliente.nivel && nivel) {
      return {
        miembroId: miembro.id,
        mesaId: pedido.mesaId,
        tenantId: pedido.tenantId,
        clienteNombre: cliente.nombre,
        nivelAnterior: cliente.nivel,
        nuevoNivel: nivel,
        puntos: nuevosPuntos,
      };
    }
    return null;
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

    const subidos: any[] = [];
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
        const subio = await this.acreditarPuntos(tx, p);
        if (subio) subidos.push(subio);
      }
    });

    for (const subio of subidos) {
      this.events.emitToTenant(subio.tenantId, 'cliente:subio-nivel', subio);
      this.events.emitToMesa(subio.mesaId, 'cliente:subio-nivel', subio);
    }

    if (pedidos.length > 0) {
      this.events.emitToTenant(pedidos[0].tenantId, 'pedido:actualizado', {});
      this.events.emitToMesa(body.mesaId, 'pedido:pagado', { mesaId: body.mesaId });
    }
    return { ok: true, total, pagados: pedidos.length };
  }
}
