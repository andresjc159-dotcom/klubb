import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LocalesController } from './locales.controller';

@Module({
  imports: [AuthModule],
  controllers: [LocalesController],
})
export class LocalesModule {}
