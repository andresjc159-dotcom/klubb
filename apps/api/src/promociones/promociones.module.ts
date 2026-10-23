import { Module } from '@nestjs/common';
import { PromocionesController } from './promociones.controller';

@Module({
  controllers: [PromocionesController],
})
export class PromocionesModule {}
