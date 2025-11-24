import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncService } from './sync.service';
import { CreateSyncItemDto } from './dto/create-sync-item.dto';
import { BulkSyncDto } from './dto/bulk-sync.dto';
import { SyncQueryDto } from './dto/sync-query.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  createSyncItem(@Body() createSyncItemDto: CreateSyncItemDto) {
    return this.syncService.createSyncItem(createSyncItemDto);
  }

  @Post('bulk')
  bulkSync(@Body() bulkSyncDto: BulkSyncDto, @Request() req) {
    return this.syncService.bulkSync(bulkSyncDto, req.user.userId);
  }

  @Get('pending')
  getPendingItems(@Query() query: SyncQueryDto) {
    return this.syncService.getPendingItems(query);
  }

  @Get('conflicts')
  getConflicts(@Query() query: SyncQueryDto) {
    return this.syncService.getConflicts(query);
  }

  @Post('resolve/:id')
  resolveConflict(
    @Param('id') id: string,
    @Body() resolution: { action: 'keep_local' | 'keep_remote' | 'merge' },
  ) {
    return this.syncService.resolveConflict(id, resolution.action);
  }

  @Get('status')
  getSyncStatus(@Request() req) {
    return this.syncService.getSyncStatus(req.user.branchId);
  }

  @Delete(':id')
  deleteSyncItem(@Param('id') id: string) {
    return this.syncService.deleteSyncItem(id);
  }

  @Post('push-delta')
  pushDelta(@Body() body: { lastSync: string; items: any[] }, @Request() req) {
    return this.syncService.pushDelta(body.lastSync, body.items, req.user.branchId);
  }

  @Get('pull-delta')
  pullDelta(@Query('lastSync') lastSync: string, @Request() req) {
    return this.syncService.pullDelta(lastSync, req.user.branchId);
  }
}
