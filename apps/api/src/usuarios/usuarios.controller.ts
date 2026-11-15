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
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { tenantEfectivo } from '../common/tenant.util';

@Controller('usuarios')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class UsuariosController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    const usuarios = await this.prisma.user.findMany({
      where: tenantId ? { tenantId } : {},
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        fotoUrl: true,
        role: true,
        activo: true,
        tenantId: true,
        base: true,
      },
      orderBy: { nombre: 'asc' },
    });
    return usuarios;
  }

  @Post()
  async crear(
    @Req() req: any,
    @Body()
    body: {
      nombre: string;
      email: string;
      telefono?: string;
      password: string;
      role: Role;
      tenantId?: string;
      base?: number;
    },
  ) {
    if (!body.nombre || !body.email || !body.password || !body.role) {
      throw new BadRequestException('Nombre, email, contraseña y rol son requeridos');
    }
    const esMaster = req.user.role === Role.MASTER;
    if (!esMaster && body.role === Role.MASTER) {
      throw new BadRequestException('Solo el master puede crear usuarios master');
    }
    const exists = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (exists) {
      throw new BadRequestException('El email ya está registrado');
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    // El admin solo crea usuarios para su propio local; el master elige el local.
    const tenantId = esMaster ? body.tenantId ?? null : tenantEfectivo(req.user) ?? null;
    return this.prisma.user.create({
      data: {
        nombre: body.nombre,
        email: body.email,
        telefono: body.telefono,
        passwordHash,
        role: body.role,
        tenantId,
        base: body.base ?? 0,
      },
      select: { id: true, nombre: true, email: true, role: true, tenantId: true, activo: true, base: true },
    });
  }

  @Patch(':id')
  async editar(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      email?: string;
      telefono?: string;
      password?: string;
      role?: Role;
      tenantId?: string | null;
      activo?: boolean;
      base?: number;
    },
  ) {
    const esMaster = req.user.role === Role.MASTER;
    const objetivo = await this.prisma.user.findUnique({ where: { id } });
    if (!objetivo) throw new BadRequestException('Usuario no encontrado');

    if (!esMaster) {
      const miTenant = tenantEfectivo(req.user);
      if (objetivo.tenantId !== miTenant) {
        throw new BadRequestException('No puedes editar usuarios de otro local');
      }
      if (body.tenantId !== undefined && body.tenantId !== miTenant) {
        throw new BadRequestException('No puedes mover un usuario a otro local');
      }
      if (body.role === Role.MASTER) {
        throw new BadRequestException('Solo el master puede asignar el rol master');
      }
    }

    const data: any = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.email !== undefined) data.email = body.email;
    if (body.telefono !== undefined) data.telefono = body.telefono;
    if (body.role !== undefined) data.role = body.role;
    if (body.tenantId !== undefined) data.tenantId = body.tenantId;
    if (body.activo !== undefined) data.activo = body.activo;
    if (body.base !== undefined) data.base = Number(body.base);
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, nombre: true, email: true, role: true, tenantId: true, activo: true, base: true },
    });
  }

  @Delete(':id')
  async desactivar(@Req() req: any, @Param('id') id: string) {
    const esMaster = req.user.role === Role.MASTER;
    if (!esMaster) {
      const objetivo = await this.prisma.user.findUnique({ where: { id } });
      if (!objetivo) throw new BadRequestException('Usuario no encontrado');
      if (objetivo.tenantId !== tenantEfectivo(req.user)) {
        throw new BadRequestException('No puedes desactivar usuarios de otro local');
      }
    }
    return this.prisma.user.update({
      where: { id },
      data: { activo: false },
    });
  }

  @Post(':id/foto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const unique = `user-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async subirFoto(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Archivo no recibido');
    const fotoUrl = `/uploads/${file.filename}`;
    await this.prisma.user.update({ where: { id }, data: { fotoUrl } });
    return { fotoUrl };
  }
}
