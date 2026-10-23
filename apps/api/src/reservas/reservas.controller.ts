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

@Controller('reservas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER, Role.MESERO)
export class ReservasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    return this.prisma.reserva.findMany({
      where: { tenantId },
      orderBy: { fecha: 'asc' },
    });
  }

  @Post()
  async crear(
    @Req() req: any,
    @Body() body: { cliente: string; fecha: string; personas: number },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.cliente?.trim() || !body.fecha) {
      throw new BadRequestException('Cliente y fecha son requeridos');
    }
    return this.prisma.reserva.create({
      data: {
        tenantId,
        cliente: body.cliente.trim(),
        fecha: new Date(body.fecha),
        personas: Number(body.personas ?? 1),
      },
    });
  }

  @Patch(':id')
  async editar(
    @Param('id') id: string,
    @Body()
    body: { estado?: string; cliente?: string; fecha?: string; personas?: number },
  ) {
    return this.prisma.reserva.update({
      where: { id },
      data: {
        estado: body.estado,
        cliente: body.cliente,
        fecha: body.fecha ? new Date(body.fecha) : undefined,
        personas: body.personas != null ? Number(body.personas) : undefined,
      },
    });
  }

  @Delete(':id')
  async eliminar(@Param('id') id: string) {
    return this.prisma.reserva.delete({ where: { id } });
  }
}
