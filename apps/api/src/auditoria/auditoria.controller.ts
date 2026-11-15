import {
  Controller,
  Get,
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

@Controller('auditoria')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MASTER, Role.SUPER)
export class AuditoriaController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    const tenantId = tenantEfectivo(req.user);
    const where = req.user?.role === Role.SUPER ? {} : tenantId ? { tenantId } : { id: '' };
    const take = Math.min(Number(limit) || 200, 500);
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
