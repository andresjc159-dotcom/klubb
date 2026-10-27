import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { EstadoPedido, Role } from '@prisma/client';
import { tenantEfectivo } from '../common/tenant.util';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class CatalogoController {
  constructor(private prisma: PrismaService) {}

  private tenantId(req: any): string {
    const id = tenantEfectivo(req.user);
    if (!id) {
      throw new BadRequestException('Se requiere un local asignado (tenant)');
    }
    return id;
  }

  // ---------- Lectura ----------
  @Get('categorias')
  categorias(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.categoria.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { productos: { where: { activo: true } } },
      orderBy: { orden: 'asc' },
    });
  }

  @Get('productos')
  productos(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.producto.findMany({
      where: { ...(tenantId ? { tenantId } : {}), activo: true },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });
  }

  @Get('productos/vendidos-por-dia')
  async vendidosPorDia(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const desde = new Date();
    desde.setDate(desde.getDate() - 14);
    const movimientos = await this.prisma.movimientoInventario.findMany({
      where: {
        tenantId,
        tipo: 'VENTA',
        createdAt: { gte: desde },
      },
      select: { cantidad: true, createdAt: true },
    });
    const porDia: Record<string, number> = {};
    for (const m of movimientos) {
      const fecha = m.createdAt.toISOString().slice(0, 10);
      porDia[fecha] = (porDia[fecha] || 0) + Math.abs(m.cantidad);
    }
    return Object.entries(porDia)
      .map(([fecha, unidades]) => ({ fecha, unidades }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  @Get('zonas')
  zonas(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.zona.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { mesas: { orderBy: { nombre: 'asc' } } },
      orderBy: { orden: 'asc' },
    });
  }

  @Get('mesas')
  mesas(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.mesa.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { zona: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // ---------- Zonas ----------
  @Post('zonas')
  crearZona(@Req() req: any, @Body() body: { nombre: string; orden?: number }) {
    if (!body.nombre) throw new BadRequestException('El nombre es requerido');
    return this.prisma.zona.create({
      data: { tenantId: this.tenantId(req), nombre: body.nombre, orden: body.orden ?? 0 },
    });
  }

  @Patch('zonas/:id')
  editarZona(@Param('id') id: string, @Body() body: { nombre?: string; orden?: number }) {
    return this.prisma.zona.update({
      where: { id },
      data: { nombre: body.nombre, orden: body.orden },
    });
  }

  @Delete('zonas/:id')
  async eliminarZona(@Param('id') id: string) {
    const mesas = await this.prisma.mesa.count({ where: { zonaId: id } });
    if (mesas > 0) {
      throw new BadRequestException('La zona tiene mesas. Elimínalas o muévelas primero.');
    }
    return this.prisma.zona.delete({ where: { id } });
  }

  // ---------- Mesas ----------
  @Post('mesas')
  async crearMesa(
    @Req() req: any,
    @Body() body: { zonaId: string; nombre: string; capacidad?: number },
  ) {
    if (!body.zonaId || !body.nombre) {
      throw new BadRequestException('Zona y nombre son requeridos');
    }
    const tenantId = this.tenantId(req);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const qrToken = `${tenant?.slug ?? 'local'}-${Math.random().toString(36).slice(2, 8)}`;
    return this.prisma.mesa.create({
      data: {
        tenantId,
        zonaId: body.zonaId,
        nombre: body.nombre,
        capacidad: body.capacidad ?? 4,
        qrToken,
      },
      include: { zona: true },
    });
  }

  @Patch('mesas/:id')
  async editarMesa(
    @Param('id') id: string,
    @Body() body: { nombre?: string; zonaId?: string; capacidad?: number; estado?: any },
  ) {
    if (body.estado === 'LIBRE') {
      const activos = await this.prisma.pedido.count({
        where: {
          mesaId: id,
          estado: { notIn: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO] },
        },
      });
      if (activos > 0) {
        throw new BadRequestException(
          'No puedes liberar la mesa: tiene productos pendientes de entrega',
        );
      }
      const sinPago = await this.prisma.pedido.count({
        where: {
          mesaId: id,
          pagadoEn: null,
          estado: { not: EstadoPedido.CANCELADO },
        },
      });
      if (sinPago > 0) {
        throw new BadRequestException(
          'No puedes liberar la mesa: hay productos sin registrar el pago',
        );
      }
      await this.prisma.sesionMesa.updateMany({
        where: { mesaId: id, activo: true },
        data: { activo: false, terminadaEn: new Date() },
      });
    }
    return this.prisma.mesa.update({
      where: { id },
      data: {
        nombre: body.nombre,
        zonaId: body.zonaId,
        capacidad: body.capacidad,
        estado: body.estado,
      },
      include: { zona: true },
    });
  }

  @Delete('mesas/:id')
  eliminarMesa(@Param('id') id: string) {
    return this.prisma.mesa.delete({ where: { id } });
  }

  // ---------- Categorías ----------
  @Post('categorias')
  crearCategoria(@Req() req: any, @Body() body: { nombre: string; icono?: string }) {
    if (!body.nombre) throw new BadRequestException('El nombre es requerido');
    return this.prisma.categoria.create({
      data: { tenantId: this.tenantId(req), nombre: body.nombre, icono: body.icono },
    });
  }

  @Patch('categorias/:id')
  editarCategoria(
    @Param('id') id: string,
    @Body() body: { nombre?: string; icono?: string },
  ) {
    return this.prisma.categoria.update({
      where: { id },
      data: { nombre: body.nombre, icono: body.icono },
    });
  }

  @Delete('categorias/:id')
  async eliminarCategoria(@Param('id') id: string) {
    const productos = await this.prisma.producto.count({
      where: { categoriaId: id },
    });
    if (productos > 0) {
      throw new BadRequestException('No puedes eliminar una categoría que tiene productos');
    }
    return this.prisma.categoria.delete({ where: { id } });
  }

  // ---------- Productos ----------
  @Post('productos')
  crearProducto(
    @Req() req: any,
    @Body()
    body: {
      categoriaId: string;
      nombre: string;
      descripcion?: string;
      precio: number;
      costo?: number;
      stock?: number;
      stockMinimo?: number;
      emoji?: string;
      estacion?: string;
      puntos?: number;
    },
  ) {
    if (!body.categoriaId || !body.nombre || body.precio == null) {
      throw new BadRequestException('Categoría, nombre y precio son requeridos');
    }
    return this.prisma.producto.create({
      data: {
        tenantId: this.tenantId(req),
        categoriaId: body.categoriaId,
        nombre: body.nombre,
        descripcion: body.descripcion,
        precio: Number(body.precio),
        costo: Number(body.costo ?? 0),
        stock: Number(body.stock ?? 0),
        stockMinimo: Number(body.stockMinimo ?? 5),
        emoji: body.emoji,
        estacion: body.estacion ?? 'BARRA',
        puntos: Number(body.puntos ?? 0),
      },
      include: { categoria: true },
    });
  }

  @Patch('productos/:id')
  editarProducto(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      categoriaId?: string;
      descripcion?: string;
      precio?: number;
      costo?: number;
      stock?: number;
      stockMinimo?: number;
      emoji?: string;
      estacion?: string;
      activo?: boolean;
      puntos?: number;
    },
  ) {
    return this.prisma.producto.update({
      where: { id },
      data: {
        nombre: body.nombre,
        categoriaId: body.categoriaId,
        descripcion: body.descripcion,
        precio: body.precio != null ? Number(body.precio) : undefined,
        costo: body.costo != null ? Number(body.costo) : undefined,
        stock: body.stock != null ? Number(body.stock) : undefined,
        stockMinimo: body.stockMinimo != null ? Number(body.stockMinimo) : undefined,
        emoji: body.emoji,
        estacion: body.estacion,
        activo: body.activo,
        puntos: body.puntos != null ? Number(body.puntos) : undefined,
      },
      include: { categoria: true },
    });
  }

  @Delete('productos/:id')
  eliminarProducto(@Param('id') id: string) {
    return this.prisma.producto.update({ where: { id }, data: { activo: false } });
  }

  @Post('productos/:id/foto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async subirFoto(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Archivo no recibido');
    const imagenUrl = `/uploads/${file.filename}`;
    await this.prisma.producto.update({ where: { id }, data: { imagenUrl } });
    return { imagenUrl };
  }

  @Get('mesas/:id/pedidos')
  pedidosPorMesa(@Param('id') id: string) {
    return this.prisma.pedido.findMany({
      where: { mesaId: id },
      include: {
        detalles: { include: { producto: true } },
        mesero: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('mesas/:id/asignar')
  async asignarMesero(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { meseroId: string | null },
  ) {
    const tenantId = this.tenantId(req);
    await this.prisma.asignacionMesero.deleteMany({ where: { mesaId: id } });
    if (body.meseroId) {
      await this.prisma.asignacionMesero.create({
        data: { tenantId, userId: body.meseroId, mesaId: id },
      });
    }
    return { ok: true };
  }

  @Get('asignaciones')
  async asignaciones(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const meseros = await this.prisma.user.findMany({
      where: { tenantId, role: Role.MESERO },
      select: { id: true, nombre: true },
    });
    const asignaciones = await this.prisma.asignacionMesero.findMany({
      where: { tenantId },
      include: { mesa: { include: { zona: { select: { nombre: true } } } } },
    });
    return meseros.map((m) => ({
      ...m,
      mesas: asignaciones.filter((a) => a.userId === m.id).map((a) => a.mesa),
    }));
  }

  @Get('mis-mesas')
  async misMesas(@Req() req: any) {
    const userId = req.user?.userId;
    const asignaciones = await this.prisma.asignacionMesero.findMany({
      where: { userId },
      include: { mesa: { include: { zona: true } } },
    });
    return asignaciones.map((a) => a.mesa);
  }

  @Get('productos/:id/receta')
  async getReceta(@Param('id') id: string) {
    return this.prisma.recetaInsumo.findMany({
      where: { productoId: id },
      include: { insumo: true },
    });
  }

  @Put('productos/:id/receta')
  async setReceta(
    @Param('id') id: string,
    @Body() body: { items: Array<{ insumoId: string; cantidad: number }> },
  ) {
    await this.prisma.recetaInsumo.deleteMany({ where: { productoId: id } });
    if (Array.isArray(body.items) && body.items.length > 0) {
      await this.prisma.recetaInsumo.createMany({
        data: body.items.map((i) => ({
          productoId: id,
          insumoId: i.insumoId,
          cantidad: Number(i.cantidad),
        })),
      });
    }
    return this.prisma.recetaInsumo.findMany({
      where: { productoId: id },
      include: { insumo: true },
    });
  }
}
