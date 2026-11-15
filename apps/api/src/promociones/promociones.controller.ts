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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { tenantEfectivo, exigirPlanPro } from '../common/tenant.util';

@Controller('promociones')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class PromocionesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    if (tenantId) await exigirPlanPro(this.prisma, tenantId);
    return this.prisma.promocion.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        productos: true,
        items: { include: { producto: true } },
      },
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
      tipo?: string;
      descuento?: number;
      precio?: number;
      imagenUrl?: string;
      estacion?: string;
      activa?: boolean;
      horaInicio?: string;
      horaFin?: string;
      productoIds?: string[];
      items?: Array<{ productoId: string; cantidad: number }>;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    await exigirPlanPro(this.prisma, tenantId);
    if (!body.nombre) throw new BadRequestException('El nombre es requerido');
    const tipo = body.tipo || 'DESCUENTO';

    if (tipo === 'COMBO') {
      if (!body.precio) throw new BadRequestException('El precio del combo es requerido');
      if (!body.items?.length) {
        throw new BadRequestException('Agrega al menos un producto al combo');
      }
      return this.prisma.promocion.create({
        data: {
          tenantId,
          nombre: body.nombre,
          descripcion: body.descripcion,
          tipo,
          precio: Number(body.precio),
          imagenUrl: body.imagenUrl,
          estacion: body.estacion || 'BARRA',
          activa: body.activa ?? false,
          horaInicio: body.horaInicio ? new Date(body.horaInicio) : undefined,
          horaFin: body.horaFin ? new Date(body.horaFin) : undefined,
          items: {
            create: body.items.map((i) => ({
              productoId: i.productoId,
              cantidad: Number(i.cantidad),
            })),
          },
        },
        include: { items: { include: { producto: true } } },
      });
    }

    if (tipo === 'PRECIO_FIJO') {
      if (!body.precio) throw new BadRequestException('El precio de oferta es requerido');
      if (!body.productoIds?.length) {
        throw new BadRequestException('Selecciona un producto para la oferta');
      }
    }

    return this.prisma.promocion.create({
      data: {
        tenantId,
        nombre: body.nombre,
        descripcion: body.descripcion,
        tipo,
        descuento: Number(body.descuento ?? 0),
        precio: body.precio != null ? Number(body.precio) : undefined,
        imagenUrl: body.imagenUrl,
        estacion: body.estacion || 'BARRA',
        activa: body.activa ?? false,
        horaInicio: body.horaInicio ? new Date(body.horaInicio) : undefined,
        horaFin: body.horaFin ? new Date(body.horaFin) : undefined,
        productos:
          body.productoIds && body.productoIds.length
            ? { connect: body.productoIds.map((id) => ({ id })) }
            : undefined,
      },
      include: { productos: true, items: { include: { producto: true } } },
    });
  }

  @Patch(':id')
  async editar(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      descripcion?: string;
      tipo?: string;
      descuento?: number;
      precio?: number;
      imagenUrl?: string;
      estacion?: string;
      activa?: boolean;
      horaInicio?: string;
      horaFin?: string;
      productoIds?: string[];
      items?: Array<{ productoId: string; cantidad: number }>;
    },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (tenantId) await exigirPlanPro(this.prisma, tenantId);

    if (body.items) {
      await this.prisma.promocionItem.deleteMany({ where: { promocionId: id } });
      if (body.items.length) {
        await this.prisma.promocionItem.createMany({
          data: body.items.map((i) => ({
            promocionId: id,
            productoId: i.productoId,
            cantidad: Number(i.cantidad),
          })),
        });
      }
    }

    return this.prisma.promocion.update({
      where: { id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        tipo: body.tipo,
        descuento: body.descuento != null ? Number(body.descuento) : undefined,
        precio: body.precio != null ? Number(body.precio) : undefined,
        imagenUrl: body.imagenUrl,
        estacion: body.estacion,
        activa: body.activa,
        horaInicio: body.horaInicio ? new Date(body.horaInicio) : undefined,
        horaFin: body.horaFin ? new Date(body.horaFin) : undefined,
        productos: body.productoIds
          ? { set: body.productoIds.map((pid) => ({ id: pid })) }
          : undefined,
      },
      include: { productos: true, items: { include: { producto: true } } },
    });
  }

  @Delete(':id')
  async eliminar(@Req() req: any, @Param('id') id: string) {
    const tenantId = tenantEfectivo(req.user);
    if (tenantId) await exigirPlanPro(this.prisma, tenantId);
    return this.prisma.promocion.delete({ where: { id } });
  }

  @Post(':id/foto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const unique = `promo-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async subirFoto(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Archivo no recibido');
    const imagenUrl = `/uploads/${file.filename}`;
    await this.prisma.promocion.update({ where: { id }, data: { imagenUrl } });
    return { imagenUrl };
  }
}
