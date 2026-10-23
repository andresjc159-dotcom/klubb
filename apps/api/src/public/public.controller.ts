import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EstadoCancion, EstadoPedido, MetodoPago, ModoEntrega } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { ClienteAuthService } from '../cliente-auth/cliente-auth.service';
import { metodosDe } from '../common/metodos';

@Controller('public')
export class PublicController {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private clienteAuth: ClienteAuthService,
  ) {}

  private clienteIdDeReq(req: any): string | null {
    const auth = req.headers?.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
      const payload = this.clienteAuth.verificar(auth.slice(7));
      return payload.tipo === 'cliente' ? payload.clienteId : null;
    } catch {
      return null;
    }
  }

  @Get('menu')
  async menu(@Query('qr') qr: string) {
    const mesa = await this.prisma.mesa.findUnique({
      where: { qrToken: qr },
      include: { zona: true, tenant: true },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    if (!mesa.tenant.abierto) {
      return {
        abierto: false,
        mensaje: 'El local no abre aún. Vuelve más tarde.',
        tenant: { id: mesa.tenant.id, nombre: mesa.tenant.nombre },
        mesa: { nombre: mesa.nombre },
      };
    }

    const categorias = await this.prisma.categoria.findMany({
      where: { tenantId: mesa.tenantId, activo: true },
      include: {
        productos: {
          where: { activo: true, stock: { gt: 0 } },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { orden: 'asc' },
    });

    const sesion = await this.prisma.sesionMesa.findUnique({
      where: { mesaId: mesa.id },
      include: { miembros: { select: { id: true, alias: true } } },
    });

    const promociones = await this.prisma.promocion.findMany({
      where: { tenantId: mesa.tenantId, activa: true },
      include: {
        productos: {
          where: { activo: true, stock: { gt: 0 } },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const configPuntos = await this.prisma.configPuntos.findUnique({
      where: { tenantId: mesa.tenantId },
      select: { habilitado: true, modo: true, montoBase: true, puntosBase: true },
    });

    const niveles = await this.prisma.nivelPuntos.findMany({
      where: { tenantId: mesa.tenantId },
      select: { id: true, nombre: true, puntosRequeridos: true },
      orderBy: { puntosRequeridos: 'asc' },
    });

    return {
      abierto: true,
      tenant: {
        id: mesa.tenant.id,
        nombre: mesa.tenant.nombre,
        logoUrl: mesa.tenant.logoUrl,
        mensajeBienvenida: mesa.tenant.mensajeBienvenida,
      },
      mesa: { id: mesa.id, nombre: mesa.nombre, zona: mesa.zona.nombre },
      sesion: sesion
        ? { id: sesion.id, activo: sesion.activo, miembros: sesion.miembros }
        : null,
      metodosPago: metodosDe(mesa.tenant),
      categorias,
      promociones,
      configPuntos,
      niveles,
    };
  }

  @Post('pedido')
  @UseGuards(AuthGuard('cliente'))
  async crearPedido(
    @Req() req: any,
    @Body()
    body: {
      modo: ModoEntrega;
      propina: number;
      metodoPago: MetodoPago;
      items: Array<{ productoId: string; cantidad: number; notas?: string }>;
    },
  ) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('Debes unirte a una mesa para pedir');
    }
    const mesaId = req.user.mesaId;
    const miembroId = req.user.miembroId;
    const mesa = await this.prisma.mesa.findUnique({
      where: { id: mesaId },
      include: { tenant: true },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    const asignacion = await this.prisma.asignacionMesero.findFirst({
      where: { mesaId },
    });

    const productos = await this.prisma.producto.findMany({
      where: { id: { in: body.items.map((i) => i.productoId) } },
    });

    const recetas = await this.prisma.recetaInsumo.findMany({
      where: { productoId: { in: body.items.map((i) => i.productoId) } },
    });

    let subtotal = 0;
    const detalles = body.items.map((item) => {
      const producto = productos.find((p) => p.id === item.productoId);
      if (!producto) throw new NotFoundException('Producto no encontrado');
      const precio = producto.precio;
      subtotal += precio * item.cantidad;
      return {
        productoId: producto.id,
        cantidad: item.cantidad,
        precioUnitario: precio,
        notas: item.notas,
      };
    });

    const propina = body.propina ?? 0;
    const total = subtotal + propina;

    const codigo = `#B-${await this.prisma.pedido.count() + 1}`;
    const pin = Math.floor(1000 + Math.random() * 9000);

    const pedido = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pedido.create({
        data: {
          tenantId: mesa.tenantId,
          mesaId: mesa.id,
          codigo,
          estado: EstadoPedido.RECIBIDO,
          modo: body.modo,
          subtotal,
          propina,
          total,
          metodoPago: body.metodoPago,
          pin,
          miembroId,
          meseroId: asignacion?.userId ?? null,
          detalles: { create: detalles },
        },
        include: { mesa: { include: { zona: true } }, detalles: { include: { producto: true } } },
      });

      for (const d of detalles) {
        await tx.producto.update({
          where: { id: d.productoId },
          data: { stock: { decrement: d.cantidad } },
        });
        await tx.movimientoInventario.create({
          data: {
            tenantId: mesa.tenantId,
            productoId: d.productoId,
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

      return created;
    });

    this.events.emitToTenant(mesa.tenantId, 'pedido:nuevo', pedido);
    this.events.emitToMesa(mesa.id, 'mesa:actualizada', {});

    return {
      id: pedido.id,
      codigo: pedido.codigo,
      pin: pedido.pin,
      total: pedido.total,
      estado: pedido.estado,
      metodoPago: pedido.metodoPago,
    };
  }

  @Post('pedido/:id/cancelar')
  @UseGuards(AuthGuard('cliente'))
  async cancelarPedido(@Req() req: any, @Param('id') id: string) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.mesaId !== req.user.mesaId) {
      throw new BadRequestException('No puedes cancelar este pedido');
    }
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
        data: { estado: EstadoPedido.CANCELADO, canceladoEn: new Date(), canceladoPor: 'Cliente' },
      });
    });
    this.events.emitToTenant(updated.tenantId, 'pedido:actualizado', updated);
    return updated;
  }

  @Post('llamar')
  @UseGuards(AuthGuard('cliente'))
  async llamar(@Req() req: any) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    const mesa = await this.prisma.mesa.findUnique({
      where: { id: req.user.mesaId },
      include: { zona: true },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    const asignacion = await this.prisma.asignacionMesero.findFirst({
      where: { mesaId: mesa.id },
    });
    if (asignacion) {
      this.events.emitToUser(asignacion.userId, 'llamado:mesa', {
        mesa: mesa.nombre,
        zona: mesa.zona.nombre,
      });
      return { ok: true, meseroId: asignacion.userId };
    }
    return { ok: false, mensaje: 'Sin mesero asignado' };
  }

  @Post('solicitar-pago')
  @UseGuards(AuthGuard('cliente'))
  async solicitarPago(@Req() req: any) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    const mesa = await this.prisma.mesa.findUnique({
      where: { id: req.user.mesaId },
      include: { zona: true },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    const total = await this.prisma.pedido.aggregate({
      where: { mesaId: mesa.id, estado: { not: 'CANCELADO' } },
      _sum: { total: true },
    });

    const asignacion = await this.prisma.asignacionMesero.findFirst({
      where: { mesaId: mesa.id },
    });
    if (asignacion) {
      this.events.emitToUser(asignacion.userId, 'solicitud:pago', {
        mesa: mesa.nombre,
        zona: mesa.zona.nombre,
        total: total._sum.total || 0,
      });
      return { ok: true, meseroId: asignacion.userId };
    }
    return { ok: false, mensaje: 'Sin mesero asignado' };
  }

  @Get('canciones')
  @UseGuards(AuthGuard('cliente'))
  async canciones(@Req() req: any) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    const mesa = await this.prisma.mesa.findUnique({
      where: { id: req.user.mesaId },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    return this.prisma.cancion.findMany({
      where: {
        tenantId: mesa.tenantId,
        estado: { in: [EstadoCancion.PENDIENTE, EstadoCancion.SONANDO] },
      },
      include: { mesa: { select: { nombre: true } } },
      orderBy: [{ estado: 'desc' }, { votos: 'desc' }],
    });
  }

  @Post('cancion')
  @UseGuards(AuthGuard('cliente'))
  async crearCancion(@Req() req: any, @Body() body: { tema: string }) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    const mesa = await this.prisma.mesa.findUnique({
      where: { id: req.user.mesaId },
    });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    const cancion = await this.prisma.cancion.create({
      data: { tenantId: mesa.tenantId, mesaId: mesa.id, tema: body.tema },
      include: { mesa: { select: { nombre: true } } },
    });
    this.events.emitToTenant(mesa.tenantId, 'cancion:nueva', cancion);
    return cancion;
  }

  @Post('cancion/:id/votar')
  @UseGuards(AuthGuard('cliente'))
  async votarCancion(@Req() req: any, @Param('id') id: string) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    const cancion = await this.prisma.cancion.update({
      where: { id },
      data: { votos: { increment: 1 } },
      include: { mesa: { select: { nombre: true } } },
    });
    this.events.emitToTenant(cancion.tenantId, 'cancion:actualizada', cancion);
    return cancion;
  }

  @Post('auth/registro')
  async registrarCliente(
    @Body()
    body: { mesaId: string; nombre: string; telefono: string; password: string },
  ) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id: body.mesaId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    const existente = await this.prisma.cliente.findUnique({
      where: { tenantId_telefono: { tenantId: mesa.tenantId, telefono: body.telefono } },
    });
    if (existente) {
      throw new BadRequestException('Ya tienes una cuenta con ese teléfono');
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const cliente = await this.prisma.cliente.create({
      data: {
        tenantId: mesa.tenantId,
        nombre: body.nombre,
        telefono: body.telefono,
        passwordHash,
        puntos: 200,
      },
    });
    return {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      puntos: cliente.puntos,
      nivel: cliente.nivel,
      token: this.clienteAuth.firmarCliente({
        clienteId: cliente.id,
        tenantId: cliente.tenantId,
        nombre: cliente.nombre,
      }),
    };
  }

  @Post('auth/login')
  async loginCliente(
    @Body() body: { mesaId: string; telefono: string; password: string },
  ) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id: body.mesaId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    const cliente = await this.prisma.cliente.findUnique({
      where: { tenantId_telefono: { tenantId: mesa.tenantId, telefono: body.telefono } },
    });
    if (!cliente) {
      throw new BadRequestException('No tienes una cuenta con ese teléfono');
    }
    const ok = await bcrypt.compare(body.password, cliente.passwordHash || '');
    if (!ok) {
      throw new BadRequestException('Contraseña incorrecta');
    }
    return {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      puntos: cliente.puntos,
      nivel: cliente.nivel,
      token: this.clienteAuth.firmarCliente({
        clienteId: cliente.id,
        tenantId: cliente.tenantId,
        nombre: cliente.nombre,
      }),
    };
  }

  @Post('sesion/crear')
  async crearSesion(
    @Req() req: any,
    @Body() body: { mesaId: string; alias: string },
  ) {
    const clienteId = this.clienteIdDeReq(req);
    const mesa = await this.prisma.mesa.findUnique({ where: { id: body.mesaId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    const existente = await this.prisma.sesionMesa.findUnique({
      where: { mesaId: mesa.id },
    });
    if (existente) {
      throw new BadRequestException('Ya existe una sesión para esta mesa');
    }
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const sesion = await this.prisma.sesionMesa.create({
      data: { tenantId: mesa.tenantId, mesaId: mesa.id, codigo },
    });
    const miembro = await this.prisma.miembroSesion.create({
      data: {
        sesionId: sesion.id,
        alias: body.alias || 'Anfitrión',
        clienteId,
      },
    });
    await this.prisma.mesa.update({
      where: { id: mesa.id },
      data: { estado: 'OCUPADA' },
    });
    this.events.emitToTenant(mesa.tenantId, 'sesion:nueva', {
      mesaId: mesa.id,
      mesa: mesa.nombre,
    });
    this.events.emitToMesa(mesa.id, 'mesa:actualizada', {});
    return {
      sesionId: sesion.id,
      miembroId: miembro.id,
      codigo,
      token: this.clienteAuth.firmarMiembro({
        miembroId: miembro.id,
        sesionId: sesion.id,
        mesaId: mesa.id,
        tenantId: mesa.tenantId,
        alias: miembro.alias,
        clienteId: clienteId ?? undefined,
      }),
    };
  }

  @Post('sesion/unirse')
  async unirseSesion(
    @Req() req: any,
    @Body() body: { mesaId: string; codigo: string; alias: string },
  ) {
    const clienteId = this.clienteIdDeReq(req);
    const sesion = await this.prisma.sesionMesa.findUnique({
      where: { mesaId: body.mesaId },
    });
    if (!sesion) throw new BadRequestException('No hay sesión en esta mesa');
    if (sesion.codigo !== body.codigo.trim()) {
      throw new BadRequestException('Código de invitación incorrecto');
    }
    const miembro = await this.prisma.miembroSesion.create({
      data: {
        sesionId: sesion.id,
        alias: body.alias || 'Invitado',
        clienteId,
      },
    });
    this.events.emitToMesa(body.mesaId, 'mesa:actualizada', {});
    return {
      sesionId: sesion.id,
      miembroId: miembro.id,
      token: this.clienteAuth.firmarMiembro({
        miembroId: miembro.id,
        sesionId: sesion.id,
        mesaId: body.mesaId,
        tenantId: sesion.tenantId,
        alias: miembro.alias,
        clienteId: clienteId ?? undefined,
      }),
    };
  }

  @Get('sesion/:id')
  @UseGuards(AuthGuard('cliente'))
  async detalleSesion(@Req() req: any, @Param('id') id: string) {
    if (req.user?.tipo !== 'miembro') {
      throw new BadRequestException('No autorizado');
    }
    if (req.user.sesionId !== id) {
      throw new BadRequestException('No perteneces a esta sesión');
    }
    return this.prisma.sesionMesa.findUnique({
      where: { id },
      include: {
        miembros: {
          include: {
            pedidos: {
              where: { estado: { not: 'CANCELADO' } },
              include: { detalles: { include: { producto: true } } },
            },
          },
        },
      },
    });
  }
}
