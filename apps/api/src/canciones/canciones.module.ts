import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { CancionesController } from './canciones.controller';

@Module({
  imports: [EventsModule],
  controllers: [CancionesController],
})
export class CancionesModule {}
