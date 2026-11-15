import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

@Controller('marcas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER)
export class MarcasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.marca.findMany({
      include: {
        masters: {
          where: { role: Role.MASTER, activo: true },
          select: { id: true, nombre: true, email: true },
        },
        _count: { select: { tenants: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  @Post()
  async crear(@Body() body: { nombre: string }) {
    if (!body.nombre?.trim()) throw new BadRequestException('El nombre es requerido');
    const base = body.nombre
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const slug = `${base || 'marca'}-${Math.random().toString(36).slice(2, 6)}`;
    return this.prisma.marca.create({
      data: { nombre: body.nombre.trim(), slug },
    });
  }

  @Patch(':id')
  async editar(@Param('id') id: string, @Body() body: { nombre?: string }) {
    return this.prisma.marca.update({
      where: { id },
      data: { nombre: body.nombre },
    });
  }

  @Delete(':id')
  async eliminar(@Param('id') id: string) {
    const tenants = await this.prisma.tenant.count({ where: { marcaId: id } });
    if (tenants > 0) {
      throw new BadRequestException('La marca tiene locales asociados');
    }
    return this.prisma.marca.delete({ where: { id } });
  }

  @Post(':id/masters')
  async crearMaster(
    @Param('id') id: string,
    @Body() body: { nombre: string; email: string; password: string },
  ) {
    if (!body.nombre?.trim() || !body.email?.trim() || !body.password) {
      throw new BadRequestException('Nombre, email y contraseña son requeridos');
    }
    const marca = await this.prisma.marca.findUnique({ where: { id } });
    if (!marca) throw new BadRequestException('Marca no encontrada');
    const existe = await this.prisma.user.findUnique({ where: { email: body.email.trim() } });
    if (existe) throw new BadRequestException('El email ya está registrado');
    const passwordHash = await bcrypt.hash(body.password, 10);
    return this.prisma.user.create({
      data: {
        nombre: body.nombre.trim(),
        email: body.email.trim(),
        passwordHash,
        role: Role.MASTER,
        marcaId: id,
      },
      select: { id: true, nombre: true, email: true, role: true },
    });
  }
}
