import { Module } from '@nestjs/common';
import { InsumosController } from './insumos.controller';

@Module({
  controllers: [InsumosController],
})
export class InsumosModule {}
