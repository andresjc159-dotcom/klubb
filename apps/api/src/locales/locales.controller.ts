import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AuthService } from '../auth/auth.service';

@Controller('locales')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.MASTER)
export class LocalesController {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  @Get()
  async list(@Req() req: any) {
    return this.prisma.tenant.findMany({
      where: { marcaId: req.user.marcaId },
      include: {
        _count: {
          select: { mesas: true, productos: true, usuarios: true, pedidos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('consolidado')
  async consolidado(@Req() req: any) {
    const tenants = await this.prisma.tenant.findMany({
      where: { marcaId: req.user.marcaId },
      include: {
        _count: { select: { pedidos: true, mesas: true, usuarios: true } },
      },
    });
    const tenantIds = tenants.map((t) => t.id);
    const pagos = await this.prisma.pago.findMany({
      where: { tenantId: { in: tenantIds } },
    });
    const porLocal = tenants.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      ventas: pagos.filter((p) => p.tenantId === t.id).reduce((s, p) => s + p.monto, 0),
      pedidos: t._count.pedidos,
      mesas: t._count.mesas,
      usuarios: t._count.usuarios,
    }));
    return {
      totalVentas: pagos.reduce((s, p) => s + p.monto, 0),
      totalPedidos: tenants.reduce((s, t) => s + t._count.pedidos, 0),
      totalLocales: tenants.length,
      porLocal,
    };
  }

  @Get('mi-marca')
  async miMarca(@Req() req: any) {
    const marca = await this.prisma.marca.findUnique({
      where: { id: req.user.marcaId },
      select: { id: true, nombre: true, colorPrimario: true, colorMarca: true },
    });
    if (!marca) throw new BadRequestException('No tienes una marca asignada');
    return marca;
  }

  @Patch('mi-marca')
  async editarMiMarca(
    @Req() req: any,
    @Body() body: { colorPrimario?: string; colorMarca?: string },
  ) {
    return this.prisma.marca.update({
      where: { id: req.user.marcaId },
      data: {
        colorPrimario: body.colorPrimario,
        colorMarca: body.colorMarca,
      },
      select: { id: true, nombre: true, colorPrimario: true, colorMarca: true },
    });
  }

  @Post()
  async crear(
    @Req() req: any,
    @Body() body: { nombre: string; direccion?: string; plan?: string },
  ) {
    if (!body.nombre?.trim()) {
      throw new BadRequestException('El nombre es requerido');
    }
    const base = body.nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const slug = `${base || 'local'}-${Math.random().toString(36).slice(2, 6)}`;
    return this.prisma.tenant.create({
      data: {
        nombre: body.nombre.trim(),
        slug,
        direccion: body.direccion,
        mensajeBienvenida: '¡Bienvenido! Pide tus tragos sin filas',
        plan: body.plan === 'BASICA' ? 'BASICA' : 'PRO',
        marcaId: req.user.marcaId,
      },
    });
  }

  @Patch(':id')
  async editar(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      direccion?: string;
      mensajeBienvenida?: string;
      plan?: string;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        nombre: body.nombre,
        direccion: body.direccion,
        mensajeBienvenida: body.mensajeBienvenida,
        plan: body.plan,
      },
    });
  }

  @Delete(':id')
  async eliminar(@Param('id') id: string) {
    return this.prisma.tenant.delete({ where: { id } });
  }

  @Post(':id/entrar')
  async entrar(@Req() req: any, @Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new BadRequestException('Local no encontrado');
    if (req.user.role === Role.MASTER && tenant.marcaId !== req.user.marcaId) {
      throw new BadRequestException('Este local no pertenece a tu marca');
    }
    await this.prisma.user.update({
      where: { id: req.user.userId },
      data: { tenantActivoId: id },
    });
    return this.auth.signUser(req.user.userId);
  }
}
