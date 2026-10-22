import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EstadoPedido, Role } from '@prisma/client';
import { tenantEfectivo } from '../common/tenant.util';
import { PrismaService } from '../prisma/prisma.service';

@Controller('staff')
@UseGuards(AuthGuard('jwt'))
export class StaffController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const meseros = await this.prisma.user.findMany({
      where: { tenantId, role: Role.MESERO },
      select: {
        id: true,
        nombre: true,
        email: true,
        enTurno: true,
        ocupado: true,
      },
    });
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        tenantId,
        estado: { notIn: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO] },
      },
      include: { mesa: { select: { nombre: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return meseros.map((m) => ({
      ...m,
      pedidosActivos: pedidos.filter((p) => p.meseroId === m.id),
    }));
  }

  @Post('turno/iniciar')
  iniciar(@Req() req: any) {
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: { enTurno: true, ocupado: false },
    });
  }

  @Post('turno/finalizar')
  async finalizar(@Req() req: any) {
    const activos = await this.prisma.pedido.count({
      where: {
        meseroId: req.user.userId,
        estado: { notIn: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO] },
      },
    });
    if (activos > 0) {
      throw new BadRequestException(
        `No puedes finalizar el turno: tienes ${activos} pedido(s) pendientes en cola o por entregar`,
      );
    }
    const sinPago = await this.prisma.pedido.count({
      where: {
        meseroId: req.user.userId,
        pagadoEn: null,
        estado: { not: EstadoPedido.CANCELADO },
      },
    });
    if (sinPago > 0) {
      throw new BadRequestException(
        'No puedes finalizar el turno: tienes pedidos pendientes por pagar',
      );
    }
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: { enTurno: false, ocupado: false },
    });
  }

  @Patch('ocupado')
  ocupado(@Req() req: any, @Body() body: { ocupado: boolean }) {
    return this.prisma.user.update({
      where: { id: req.user.userId },
      data: { ocupado: Boolean(body.ocupado) },
    });
  }
}
