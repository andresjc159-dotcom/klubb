import { Module } from '@nestjs/common';
import { ContabilidadController } from './contabilidad.controller';

@Module({
  controllers: [ContabilidadController],
})
export class ContabilidadModule {}
