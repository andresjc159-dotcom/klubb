import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PedidosController } from './pedidos.controller';

@Module({
  imports: [EventsModule],
  controllers: [PedidosController],
})
export class PedidosModule {}
