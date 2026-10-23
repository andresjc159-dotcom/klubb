import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { tenantEfectivo } from '../common/tenant.util';

@Controller('encuestas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class EncuestasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const encuestas = await this.prisma.encuesta.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        pedido: {
          select: { codigo: true, mesa: { select: { nombre: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const promedio = encuestas.length
      ? Math.round((encuestas.reduce((s, e) => s + e.estrellas, 0) / encuestas.length) * 10) / 10
      : 0;
    return { promedio, total: encuestas.length, encuestas };
  }
}
