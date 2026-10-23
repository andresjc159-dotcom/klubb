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

@Controller('puntos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class PuntosController {
  constructor(private prisma: PrismaService) {}

  private async miTenant(req: any): Promise<string> {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    return tenantId;
  }

  @Get()
  async get(@Req() req: any) {
    const tenantId = await this.miTenant(req);
    return this.prisma.configPuntos.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
      include: { niveles: { orderBy: { orden: 'asc' } } },
    });
  }

  @Patch()
  async update(
    @Req() req: any,
    @Body()
    body: {
      habilitado?: boolean;
      modo?: any;
      montoBase?: number;
      puntosBase?: number;
    },
  ) {
    const tenantId = await this.miTenant(req);
    return this.prisma.configPuntos.upsert({
      where: { tenantId },
      update: {
        habilitado: body.habilitado,
        modo: body.modo,
        montoBase: body.montoBase != null ? Number(body.montoBase) : undefined,
        puntosBase: body.puntosBase != null ? Number(body.puntosBase) : undefined,
      },
      create: {
        tenantId,
        habilitado: body.habilitado ?? false,
        modo: body.modo ?? 'CONSUMO',
        montoBase: body.montoBase != null ? Number(body.montoBase) : 1000,
        puntosBase: body.puntosBase != null ? Number(body.puntosBase) : 1,
      },
    });
  }

  @Post('niveles')
  async crearNivel(
    @Req() req: any,
    @Body()
    body: { nombre: string; puntosRequeridos: number; orden?: number },
  ) {
    const tenantId = await this.miTenant(req);
    if (!body.nombre) throw new BadRequestException('El nombre es requerido');
    return this.prisma.nivelPuntos.create({
      data: {
        tenantId,
        nombre: body.nombre,
        puntosRequeridos: Number(body.puntosRequeridos ?? 0),
        orden: Number(body.orden ?? 0),
      },
    });
  }

  @Patch('niveles/:id')
  async editarNivel(
    @Param('id') id: string,
    @Body()
    body: { nombre?: string; puntosRequeridos?: number; orden?: number },
  ) {
    return this.prisma.nivelPuntos.update({
      where: { id },
      data: {
        nombre: body.nombre,
        puntosRequeridos:
          body.puntosRequeridos != null ? Number(body.puntosRequeridos) : undefined,
        orden: body.orden != null ? Number(body.orden) : undefined,
      },
    });
  }

  @Delete('niveles/:id')
  async eliminarNivel(@Param('id') id: string) {
    return this.prisma.nivelPuntos.delete({ where: { id } });
  }
}
