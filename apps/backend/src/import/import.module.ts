import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ImportController],
})
export class ImportModule {}
