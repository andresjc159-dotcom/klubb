import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { tenantEfectivo } from '../common/tenant.util';

@Controller('nomina')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER)
export class NominaController {
  constructor(private prisma: PrismaService) {}

  // ---------- Turnos ----------
  @Get('turnos')
  async turnos(@Req() req: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.turno.findMany({
      where: {
        tenantId,
        ...(desde && hasta ? { fecha: { gte: desde, lte: hasta } } : {}),
      },
      include: { user: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  @Post('turnos')
  async crearTurno(
    @Req() req: any,
    @Body() body: { userId: string; fecha: string; horaInicio: string; horaFin: string; tipo: string; valor?: number },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.userId || !body.fecha || !body.horaInicio || !body.horaFin) {
      throw new BadRequestException('Empleado, fecha y horas son requeridos');
    }
    return this.prisma.turno.create({
      data: {
        tenantId,
        userId: body.userId,
        fecha: body.fecha,
        horaInicio: body.horaInicio,
        horaFin: body.horaFin,
        tipo: body.tipo || 'NOCHE',
        valor: Number(body.valor ?? 0),
      },
      include: { user: { select: { id: true, nombre: true } } },
    });
  }

  @Delete('turnos/:id')
  async eliminarTurno(@Param('id') id: string) {
    return this.prisma.turno.delete({ where: { id } });
  }

  // ---------- Asistencia ----------
  @Get('asistencia')
  async asistencia(@Req() req: any, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.asistencia.findMany({
      where: {
        tenantId,
        ...(desde && hasta ? { fecha: { gte: desde, lte: hasta } } : {}),
      },
      include: { user: { select: { id: true, nombre: true } } },
      orderBy: { fecha: 'desc' },
    });
  }

  @Roles(Role.ADMIN, Role.MASTER, Role.MESERO)
  @Post('asistencia/entrada')
  async marcarEntrada(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    const fecha = new Date().toISOString().slice(0, 10);
    return this.prisma.asistencia.upsert({
      where: { tenantId_userId_fecha: { tenantId, userId: req.user.userId, fecha } },
      update: {},
      create: { tenantId, userId: req.user.userId, fecha, entradaEn: new Date() },
    });
  }

  @Roles(Role.ADMIN, Role.MASTER, Role.MESERO)
  @Post('asistencia/salida')
  async marcarSalida(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    const fecha = new Date().toISOString().slice(0, 10);
    const asistencia = await this.prisma.asistencia.findUnique({
      where: { tenantId_userId_fecha: { tenantId, userId: req.user.userId, fecha } },
    });
    if (!asistencia) throw new BadRequestException('No has marcado la entrada');
    const salidaEn = new Date();
    const horas = asistencia.entradaEn
      ? Math.round(((salidaEn.getTime() - asistencia.entradaEn.getTime()) / 3600000) * 10) / 10
      : 0;
    return this.prisma.asistencia.update({
      where: { id: asistencia.id },
      data: { salidaEn, horas },
    });
  }

  // ---------- Conceptos ----------
  @Get('conceptos')
  async conceptos(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.conceptoNomina.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post('conceptos')
  async crearConcepto(
    @Req() req: any,
    @Body() body: { nombre: string; tipo: string; calculo: string; valor: number },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.nombre?.trim()) throw new BadRequestException('El nombre es requerido');
    return this.prisma.conceptoNomina.create({
      data: {
        tenantId,
        nombre: body.nombre.trim(),
        tipo: body.tipo === 'DEDUCCION' ? 'DEDUCCION' : 'INGRESO',
        calculo: body.calculo || 'FIJO',
        valor: Number(body.valor ?? 0),
      },
    });
  }

  @Patch('conceptos/:id')
  async editarConcepto(
    @Param('id') id: string,
    @Body() body: { nombre?: string; tipo?: string; calculo?: string; valor?: number; activo?: boolean },
  ) {
    return this.prisma.conceptoNomina.update({
      where: { id },
      data: {
        nombre: body.nombre,
        tipo: body.tipo,
        calculo: body.calculo,
        valor: body.valor != null ? Number(body.valor) : undefined,
        activo: body.activo,
      },
    });
  }

  @Delete('conceptos/:id')
  async eliminarConcepto(@Param('id') id: string) {
    return this.prisma.conceptoNomina.delete({ where: { id } });
  }

  // ---------- Configuración de prestaciones ----------
  @Get('config')
  async getConfig(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    return this.prisma.configNomina.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  @Patch('config')
  async setConfig(@Req() req: any, @Body() body: any) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    const data: any = {};
    const keys = [
      'prima',
      'cesantias',
      'interesesCesantias',
      'vacaciones',
      'recargoNocturno',
      'recargoDominical',
      'horaExtraDiurna',
      'horaExtraNocturna',
      'aporteSalud',
      'aportePension',
      'aporteArl',
      'aporteCaja',
    ];
    for (const k of keys) {
      if (body[k] !== undefined) data[k] = Number(body[k]);
    }
    return this.prisma.configNomina.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });
  }

  // ---------- Nómina ----------
  @Get('nominas')
  async nominas(@Req() req: any) {
    const tenantId = tenantEfectivo(req.user);
    return this.prisma.nomina.findMany({
      where: { tenantId },
      include: { items: { include: { user: { select: { id: true, nombre: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('nominas')
  async generarNomina(
    @Req() req: any,
    @Body() body: { fechaInicio: string; fechaFin: string },
  ) {
    const tenantId = tenantEfectivo(req.user);
    if (!tenantId) throw new BadRequestException('Sin local asignado');
    if (!body.fechaInicio || !body.fechaFin) {
      throw new BadRequestException('Fechas requeridas');
    }
    const inicio = new Date(`${body.fechaInicio}T00:00:00.000Z`);
    const fin = new Date(`${body.fechaFin}T23:59:59.999Z`);
    const periodo = body.fechaInicio.slice(0, 7);

    const usuarios = await this.prisma.user.findMany({
      where: { tenantId, activo: true, role: { not: Role.MASTER } },
      orderBy: { nombre: 'asc' },
    });
    const conceptos = await this.prisma.conceptoNomina.findMany({
      where: { tenantId, activo: true },
    });
    const config = await this.prisma.configNomina.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });

    const items = await Promise.all(
      usuarios.map(async (u) => {
        const propinas = await this.prisma.pedido.aggregate({
          where: { tenantId, meseroId: u.id, estado: { not: 'CANCELADO' }, createdAt: { gte: inicio, lte: fin } },
          _sum: { propina: true },
        });
        const ventas = await this.prisma.pedido.aggregate({
          where: { tenantId, meseroId: u.id, estado: { not: 'CANCELADO' }, createdAt: { gte: inicio, lte: fin } },
          _sum: { total: true },
        });
        const turnos = await this.prisma.turno.aggregate({
          where: { tenantId, userId: u.id, fecha: { gte: body.fechaInicio, lte: body.fechaFin } },
          _sum: { valor: true },
        });
        const totalVentas = ventas._sum.total ?? 0;
        const propinaTotal = propinas._sum.propina ?? 0;
        const valorTurnos = turnos._sum.valor ?? 0;

        let comisiones = 0;
        let otrosIngresos = 0;
        let deducciones = 0;
        for (const c of conceptos) {
          let monto = 0;
          if (c.calculo === 'PORCENTAJE_VENTAS') {
            monto = Math.round((totalVentas * c.valor) / 100);
          } else if (c.calculo === 'PORCENTAJE_BASE') {
            monto = Math.round((u.base * c.valor) / 100);
          } else {
            monto = Math.round(c.valor);
          }
          if (c.tipo === 'DEDUCCION') deducciones += monto;
          else if (c.calculo === 'PORCENTAJE_VENTAS') comisiones += monto;
          else otrosIngresos += monto;
        }

        const base = u.base;
        const prima = (base * config.prima) / 100;
        const cesantias = (base * config.cesantias) / 100;
        const intereses = (cesantias * config.interesesCesantias) / 100;
        const vacaciones = (base * config.vacaciones) / 100;
        const provisiones = Math.round(prima + cesantias + intereses + vacaciones);
        const aportes = Math.round(
          (base * (config.aporteSalud + config.aportePension + config.aporteArl + config.aporteCaja)) / 100,
        );
        const neto = base + valorTurnos + propinaTotal + comisiones + otrosIngresos - deducciones;
        return {
          userId: u.id,
          base,
          valorTurnos,
          propinas: propinaTotal,
          comisiones,
          otrosIngresos,
          deducciones,
          provisiones,
          aportes,
          neto,
        };
      }),
    );

    const nomina = await this.prisma.nomina.create({
      data: {
        tenantId,
        periodo,
        fechaInicio: inicio,
        fechaFin: fin,
        items: { create: items },
      },
      include: { items: { include: { user: { select: { id: true, nombre: true } } } } },
    });
    return nomina;
  }

  @Get('nominas/:id')
  async detalleNomina(@Param('id') id: string) {
    return this.prisma.nomina.findUnique({
      where: { id },
      include: { items: { include: { user: { select: { id: true, nombre: true } } } } },
    });
  }
}
