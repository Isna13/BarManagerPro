import { Module } from '@nestjs/common';
import { CashBoxController } from './cash-box.controller';
import { CashBoxService } from './cash-box.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CashBoxController],
  providers: [CashBoxService],
  exports: [CashBoxService],
})
export class CashBoxModule {}
