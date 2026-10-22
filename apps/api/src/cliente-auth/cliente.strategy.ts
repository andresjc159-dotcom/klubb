import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClienteStrategy extends PassportStrategy(Strategy, 'cliente') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('CLIENT_JWT_SECRET') || 'klubb-cliente-dev-secret',
    });
  }

  async validate(payload: any) {
    if (payload.tipo !== 'miembro' && payload.tipo !== 'cliente') {
      throw new UnauthorizedException('Token inválido');
    }
    return payload;
  }
}
