import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { CatalogoController } from './catalogo.controller';

@Module({
  imports: [EventsModule],
  controllers: [CatalogoController],
})
export class CatalogoModule {}
