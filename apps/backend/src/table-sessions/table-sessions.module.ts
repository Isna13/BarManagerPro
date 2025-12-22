import { Module } from '@nestjs/common';
import { TableSessionsController } from './table-sessions.controller';
import { TablesService } from '../tables/tables.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TableSessionsController],
  providers: [TablesService],
})
export class TableSessionsModule {}
