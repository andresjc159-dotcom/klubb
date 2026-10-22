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

@Controller('insumos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class InsumosController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.insumo.findMany({
      where: { ...(tenantId ? { tenantId } : {}), activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  @Post()
  crear(
    @Req() req: any,
    @Body()
    body: {
      nombre: string;
      categoria?: string;
      cantidad?: number;
      unidad?: string;
      stockMinimo?: number;
      costo?: number;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.nombre?.trim()) throw new BadRequestException('El nombre es requerido');
    return this.prisma.insumo.create({
      data: {
        tenantId,
        nombre: body.nombre.trim(),
        categoria: body.categoria,
        cantidad: Number(body.cantidad ?? 0),
        unidad: body.unidad || 'unidad',
        stockMinimo: Number(body.stockMinimo ?? 0),
        costo: Number(body.costo ?? 0),
      },
    });
  }

  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      categoria?: string;
      cantidad?: number;
      unidad?: string;
      stockMinimo?: number;
      costo?: number;
    },
  ) {
    return this.prisma.insumo.update({
      where: { id },
      data: {
        nombre: body.nombre,
        categoria: body.categoria,
        cantidad: body.cantidad != null ? Number(body.cantidad) : undefined,
        unidad: body.unidad,
        stockMinimo: body.stockMinimo != null ? Number(body.stockMinimo) : undefined,
        costo: body.costo != null ? Number(body.costo) : undefined,
      },
    });
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.prisma.insumo.update({ where: { id }, data: { activo: false } });
  }
}
