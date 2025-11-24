import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QrMenuController } from './qr-menu.controller';
import { QrMenuService } from './qr-menu.service';

@Module({
  imports: [PrismaModule],
  controllers: [QrMenuController],
  providers: [QrMenuService],
  exports: [QrMenuService],
})
export class QrMenuModule {}
