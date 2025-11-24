import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SalesGateway } from './sales.gateway';

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesGateway],
  exports: [SalesService],
})
export class SalesModule {}
