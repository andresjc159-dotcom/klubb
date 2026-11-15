import { Module } from '@nestjs/common';
import { BodegaController } from './bodega.controller';

@Module({
  controllers: [BodegaController],
})
export class BodegaModule {}
