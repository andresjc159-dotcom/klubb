import { Module } from '@nestjs/common';
import { NominaController } from './nomina.controller';

@Module({
  controllers: [NominaController],
})
export class NominaModule {}
