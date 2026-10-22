import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';

@Module({
  controllers: [CajaController],
})
export class CajaModule {}
