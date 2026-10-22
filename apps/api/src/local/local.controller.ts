import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { tenantEfectivo } from '../common/tenant.util';
import { METODOS_PAGO_DEFAULT } from '../common/metodos';

@Controller('local')
export class LocalController {
  constructor(private prisma: PrismaService) {}

  private tenantId(req: any): string {
    const id = tenantEfectivo(req.user);
    if (!id) throw new BadRequestException('Sin local asignado');
    return id;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Post('abrir')
  async abrir(@Req() req: any) {
    return this.prisma.tenant.update({
      where: { id: this.tenantId(req) },
      data: { abierto: true },
    });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Post('cerrar')
  async cerrar(@Req() req: any) {
    return this.prisma.tenant.update({
      where: { id: this.tenantId(req) },
      data: { abierto: false },
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('estado')
  async estado(@Req() req: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: this.tenantId(req) },
    });
    return { abierto: tenant?.abierto ?? false };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Get('metodos-pago')
  async getMetodosPago(@Req() req: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: this.tenantId(req) },
    });
    return {
      metodosPago: Array.isArray(tenant?.metodosPago)
        ? (tenant.metodosPago as string[])
        : METODOS_PAGO_DEFAULT,
    };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Patch('metodos-pago')
  async setMetodosPago(
    @Req() req: any,
    @Body() body: { metodosPago: string[] },
  ) {
    if (!Array.isArray(body.metodosPago)) {
      throw new BadRequestException('metodosPago debe ser un arreglo');
    }
    const tenant = await this.prisma.tenant.update({
      where: { id: this.tenantId(req) },
      data: { metodosPago: body.metodosPago },
    });
    return { metodosPago: tenant.metodosPago };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Get('config')
  async getConfig(@Req() req: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: this.tenantId(req) },
      select: {
        nombre: true,
        logoUrl: true,
        mensajeBienvenida: true,
        direccion: true,
      },
    });
    return tenant;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Patch('config')
  async setConfig(
    @Req() req: any,
    @Body()
    body: {
      nombre?: string;
      mensajeBienvenida?: string;
      direccion?: string;
    },
  ) {
    return this.prisma.tenant.update({
      where: { id: this.tenantId(req) },
      data: {
        nombre: body.nombre,
        mensajeBienvenida: body.mensajeBienvenida,
        direccion: body.direccion,
      },
      select: {
        nombre: true,
        logoUrl: true,
        mensajeBienvenida: true,
        direccion: true,
      },
    });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MASTER)
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const unique = `logo-${Date.now()}${extname(file.originalname)}`;
          cb(null, unique);
        },
      }),
    }),
  )
  async subirLogo(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Archivo no recibido');
    const logoUrl = `/uploads/${file.filename}`;
    await this.prisma.tenant.update({
      where: { id: this.tenantId(req) },
      data: { logoUrl },
    });
    return { logoUrl };
  }
}
