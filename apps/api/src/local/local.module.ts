import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LocalController } from './local.controller';

@Module({
  imports: [EventsModule],
  controllers: [LocalController],
})
export class LocalModule {}
