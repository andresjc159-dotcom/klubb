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
import { tenantEfectivo } from '../common/tenant.util';

@Controller('promociones')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class PromocionesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.promocion.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { productos: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async crear(
    @Req() req: any,
    @Body()
    body: {
      nombre: string;
      descripcion?: string;
      descuento?: number;
      activa?: boolean;
      horaInicio?: string;
      horaFin?: string;
      productoIds?: string[];
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.nombre) throw new BadRequestException('El nombre es requerido');
    return this.prisma.promocion.create({
      data: {
        tenantId,
        nombre: body.nombre,
        descripcion: body.descripcion,
        descuento: Number(body.descuento ?? 0),
        activa: body.activa ?? false,
        horaInicio: body.horaInicio ? new Date(body.horaInicio) : undefined,
        horaFin: body.horaFin ? new Date(body.horaFin) : undefined,
        productos:
          body.productoIds && body.productoIds.length
            ? { connect: body.productoIds.map((id) => ({ id })) }
            : undefined,
      },
      include: { productos: true },
    });
  }

  @Patch(':id')
  async editar(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      descripcion?: string;
      descuento?: number;
      activa?: boolean;
      horaInicio?: string;
      horaFin?: string;
      productoIds?: string[];
    },
  ) {
    return this.prisma.promocion.update({
      where: { id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        descuento: body.descuento != null ? Number(body.descuento) : undefined,
        activa: body.activa,
        horaInicio: body.horaInicio ? new Date(body.horaInicio) : undefined,
        horaFin: body.horaFin ? new Date(body.horaFin) : undefined,
        productos: body.productoIds
          ? { set: body.productoIds.map((pid) => ({ id: pid })) }
          : undefined,
      },
      include: { productos: true },
    });
  }

  @Delete(':id')
  async eliminar(@Param('id') id: string) {
    return this.prisma.promocion.delete({ where: { id } });
  }
}
