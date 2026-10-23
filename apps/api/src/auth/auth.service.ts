import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role, User } from '@prisma/client';

export interface RegisterInput {
  nombre: string;
  email: string;
  password: string;
  role: Role;
  tenantId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.verificarBarAbierto(user);
    return this.sign(user);
  }

  private async verificarBarAbierto(user: User) {
    if (user.role === Role.ADMIN || user.role === Role.MASTER) return;
    if (!user.tenantId) return;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (tenant && !tenant.abierto) {
      throw new UnauthorizedException('El local está cerrado. Espera a que el administrador lo abra.');
    }
  }

  async register(input: RegisterInput) {
    const exists = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (exists) {
      throw new ConflictException('El email ya está registrado');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nombre: input.nombre,
        email: input.email,
        passwordHash,
        role: input.role,
        tenantId: input.tenantId ?? null,
      },
    });
    return this.sign(user);
  }

  private sign(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantActivoId: user.tenantActivoId,
      nombre: user.nombre,
    };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        userId: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        tenantId: user.tenantId,
        tenantActivoId: user.tenantActivoId,
      },
    };
  }

  async signUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return this.sign(user);
  }
}
