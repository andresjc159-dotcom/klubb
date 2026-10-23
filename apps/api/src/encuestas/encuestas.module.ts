import { Module } from '@nestjs/common';
import { EncuestasController } from './encuestas.controller';

@Module({
  controllers: [EncuestasController],
})
export class EncuestasModule {}
