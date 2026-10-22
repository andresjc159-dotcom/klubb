import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface MiembroPayload {
  miembroId: string;
  sesionId: string;
  mesaId: string;
  tenantId: string;
  alias: string;
  clienteId?: string;
}

export interface ClientePayload {
  clienteId: string;
  tenantId: string;
  nombre: string;
}

@Injectable()
export class ClienteAuthService {
  constructor(private jwt: JwtService) {}

  firmarMiembro(p: MiembroPayload) {
    return this.jwt.sign({ sub: p.miembroId, tipo: 'miembro', ...p });
  }

  firmarCliente(p: ClientePayload) {
    return this.jwt.sign({ sub: p.clienteId, tipo: 'cliente', ...p });
  }

  verificar(token: string) {
    return this.jwt.verify(token);
  }
}
