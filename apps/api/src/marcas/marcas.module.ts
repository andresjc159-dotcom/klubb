import { Module } from '@nestjs/common';
import { MarcasController } from './marcas.controller';

@Module({
  controllers: [MarcasController],
})
export class MarcasModule {}
