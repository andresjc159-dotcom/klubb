import { Module } from '@nestjs/common';
import { PuntosController } from './puntos.controller';

@Module({
  controllers: [PuntosController],
})
export class PuntosModule {}
