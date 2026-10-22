import { Module } from '@nestjs/common';
import { LocalController } from './local.controller';

@Module({
  controllers: [LocalController],
})
export class LocalModule {}
