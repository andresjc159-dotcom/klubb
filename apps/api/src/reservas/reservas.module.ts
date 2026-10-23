import { Module } from '@nestjs/common';
import { ReservasController } from './reservas.controller';

@Module({
  controllers: [ReservasController],
})
export class ReservasModule {}
