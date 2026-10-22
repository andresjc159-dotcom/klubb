import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PublicModule } from './public/public.module';
import { CajaModule } from './caja/caja.module';
import { StaffModule } from './staff/staff.module';
import { LocalModule } from './local/local.module';
import { CancionesModule } from './canciones/canciones.module';
import { LocalesModule } from './locales/locales.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { InsumosModule } from './insumos/insumos.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EventsModule,
    CatalogoModule,
    PedidosModule,
    PublicModule,
    CajaModule,
    StaffModule,
    LocalModule,
    CancionesModule,
    LocalesModule,
    UsuariosModule,
    InsumosModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
