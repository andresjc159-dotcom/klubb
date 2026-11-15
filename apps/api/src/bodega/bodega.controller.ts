import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

@Controller('bodega')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class BodegaController {
  constructor(private prisma: PrismaService) {}

  @Get('documentos')
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.documentoBodega.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { items: { include: { producto: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('documentos')
  async crear(
    @Req() req: any,
    @Body()
    body: {
      tipo: 'INGRESO' | 'SALIDA';
      factura?: string;
      motivo?: string;
      items: Array<{ productoId: string; cantidad: number }>;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.tipo || !body.items?.length) {
      throw new BadRequestException('Tipo y productos son requeridos');
    }
    if (body.tipo === 'INGRESO' && !body.factura?.trim()) {
      throw new BadRequestException('La factura es requerida para un ingreso');
    }
    if (body.tipo === 'SALIDA' && !body.motivo?.trim()) {
      throw new BadRequestException('El motivo es requerido para una salida');
    }

    const count = await this.prisma.documentoBodega.count({
      where: { tenantId, tipo: body.tipo },
    });
    const numero = `${body.tipo === 'INGRESO' ? 'ING' : 'SAL'}-${String(count + 1).padStart(4, '0')}`;

    const doc = await this.prisma.documentoBodega.create({
      data: {
        tenantId,
        tipo: body.tipo,
        numero,
        factura: body.factura,
        motivo: body.motivo,
        items: {
          create: body.items.map((i) => ({
            productoId: i.productoId,
            cantidad: Number(i.cantidad),
          })),
        },
      },
      include: { items: { include: { producto: true } } },
    });

    const signo = body.tipo === 'INGRESO' ? 1 : -1;
    for (const item of body.items) {
      const cant = Number(item.cantidad);
      await this.prisma.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: signo * cant } },
      });
      await this.prisma.movimientoInventario.create({
        data: {
          tenantId,
          productoId: item.productoId,
          tipo: body.tipo === 'INGRESO' ? 'COMPRA' : 'MERMA',
          cantidad: signo * cant,
        },
      });
    }

    return doc;
  }
}
