import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller';

@Module({
  controllers: [ComprasController],
})
export class ComprasModule {}
