import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EstadoCancion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Controller('canciones')
@UseGuards(AuthGuard('jwt'))
export class CancionesController {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  @Get()
  list(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.prisma.cancion.findMany({
      where: {
        tenantId,
        estado: { in: [EstadoCancion.PENDIENTE, EstadoCancion.SONANDO] },
      },
      include: { mesa: { select: { nombre: true } } },
      orderBy: [{ estado: 'desc' }, { votos: 'desc' }],
    });
  }

  @Patch(':id/estado')
  async estado(
    @Param('id') id: string,
    @Body() body: { estado: EstadoCancion },
  ) {
    const cancion = await this.prisma.cancion.update({
      where: { id },
      data: { estado: body.estado },
      include: { mesa: { select: { nombre: true } } },
    });
    this.events.emitToTenant(cancion.tenantId, 'cancion:actualizada', cancion);
    return cancion;
  }

  @Post('proponer')
  async proponer(@Req() req: any, @Body() body: { tema: string }) {
    if (!body.tema?.trim()) throw new NotFoundException('El tema es requerido');
    const cancion = await this.prisma.cancion.create({
      data: {
        tenantId: req.user.tenantId,
        tema: body.tema.trim(),
        origen: 'DJ',
      },
    });
    this.events.emitToTenant(cancion.tenantId, 'cancion:nueva', cancion);
    return cancion;
  }

  @Get('preferidos')
  preferidos(@Req() req: any) {
    return this.prisma.cancionPreferida.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('preferidos')
  async agregarPreferido(@Req() req: any, @Body() body: { tema: string }) {
    if (!body.tema?.trim()) throw new NotFoundException('El tema es requerido');
    return this.prisma.cancionPreferida.create({
      data: {
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        tema: body.tema.trim(),
      },
    });
  }

  @Delete('preferidos/:id')
  eliminarPreferido(@Param('id') id: string) {
    return this.prisma.cancionPreferida.delete({ where: { id } });
  }

  @Post('preferidos/:id/enviar')
  async enviarPreferido(@Req() req: any, @Param('id') id: string) {
    const preferida = await this.prisma.cancionPreferida.findUnique({
      where: { id },
    });
    if (!preferida) throw new NotFoundException('No encontrada');
    const cancion = await this.prisma.cancion.create({
      data: {
        tenantId: preferida.tenantId,
        tema: preferida.tema,
        origen: 'DJ',
      },
      include: { mesa: { select: { nombre: true } } },
    });
    this.events.emitToTenant(cancion.tenantId, 'cancion:nueva', cancion);
    return cancion;
  }
}
