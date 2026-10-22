import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ClienteAuthModule } from '../cliente-auth/cliente-auth.module';
import { PublicController } from './public.controller';

@Module({
  imports: [EventsModule, ClienteAuthModule],
  controllers: [PublicController],
})
export class PublicModule {}
