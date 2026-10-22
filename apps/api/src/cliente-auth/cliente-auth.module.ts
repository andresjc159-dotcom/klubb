import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ClienteAuthService } from './cliente-auth.service';
import { ClienteStrategy } from './cliente.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('CLIENT_JWT_SECRET') || 'klubb-cliente-dev-secret',
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  providers: [ClienteAuthService, ClienteStrategy],
  exports: [ClienteAuthService],
})
export class ClienteAuthModule {}
