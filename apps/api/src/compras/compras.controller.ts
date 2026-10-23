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

@Controller('compras')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class ComprasController {
  constructor(private prisma: PrismaService) {}

  // ---------- Proveedores ----------
  @Get('proveedores')
  async proveedores(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.proveedor.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  @Post('proveedores')
  async crearProveedor(
    @Req() req: any,
    @Body() body: { nombre: string; telefono?: string },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.nombre?.trim()) throw new BadRequestException('El nombre es requerido');
    return this.prisma.proveedor.create({
      data: { tenantId, nombre: body.nombre.trim(), telefono: body.telefono },
    });
  }

  @Patch('proveedores/:id')
  async editarProveedor(
    @Param('id') id: string,
    @Body() body: { nombre?: string; telefono?: string },
  ) {
    return this.prisma.proveedor.update({
      where: { id },
      data: { nombre: body.nombre, telefono: body.telefono },
    });
  }

  @Delete('proveedores/:id')
  async eliminarProveedor(@Param('id') id: string) {
    const ordenes = await this.prisma.ordenCompra.count({ where: { proveedorId: id } });
    if (ordenes > 0) {
      throw new BadRequestException('Este proveedor tiene órdenes asociadas');
    }
    return this.prisma.proveedor.delete({ where: { id } });
  }

  // ---------- Órdenes de compra ----------
  @Get('ordenes')
  async ordenes(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.ordenCompra.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        proveedor: true,
        items: { include: { producto: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('ordenes')
  async crearOrden(
    @Req() req: any,
    @Body()
    body: {
      proveedorId: string;
      items: Array<{ productoId: string; cantidad: number }>;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.proveedorId) throw new BadRequestException('Selecciona un proveedor');
    if (!body.items?.length) throw new BadRequestException('Agrega al menos un producto');
    return this.prisma.ordenCompra.create({
      data: {
        tenantId,
        proveedorId: body.proveedorId,
        items: {
          create: body.items.map((i) => ({
            productoId: i.productoId,
            cantidad: Number(i.cantidad),
          })),
        },
      },
      include: { proveedor: true, items: { include: { producto: true } } },
    });
  }

  @Patch('ordenes/:id/recibir')
  async recibirOrden(@Param('id') id: string) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!orden) throw new BadRequestException('Orden no encontrada');
    if (orden.estado === 'recibida') {
      throw new BadRequestException('La orden ya fue recibida');
    }

    for (const item of orden.items) {
      await this.prisma.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: item.cantidad } },
      });
      await this.prisma.movimientoInventario.create({
        data: {
          tenantId: orden.tenantId,
          productoId: item.productoId,
          tipo: 'COMPRA',
          cantidad: item.cantidad,
        },
      });
    }

    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: 'recibida' },
      include: { proveedor: true, items: { include: { producto: true } } },
    });
  }

  @Delete('ordenes/:id')
  async eliminarOrden(@Param('id') id: string) {
    await this.prisma.ordenCompraItem.deleteMany({ where: { ordenId: id } });
    return this.prisma.ordenCompra.delete({ where: { id } });
  }
}
