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

  // ============================================
  // ACK Explícito Bidirecional
  // ============================================

  /**
   * Cliente confirma que recebeu e processou itens do servidor
   * Isso permite ao servidor marcar itens como "synced" e evitar reenvio
   */
  @Post('ack')
  acknowledgeSync(
    @Body() body: { 
      entityIds: string[]; 
      deviceId: string;
      syncTimestamp: string;
    },
    @Request() req,
  ) {
    return this.syncService.acknowledgeSync(body.entityIds, body.deviceId, body.syncTimestamp, req.user.userId);
  }

  /**
   * Cliente envia heartbeat com status do dispositivo
   * Permite monitorar dispositivos ativos e detectar problemas
   */
  @Post('heartbeat')
  heartbeat(
    @Body() body: {
      deviceId: string;
      pendingItems: number;
      failedItems: number;
      dlqItems: number;
      lastSync: string;
    },
    @Request() req,
  ) {
    return this.syncService.recordHeartbeat(body, req.user.branchId);
  }

  /**
   * Retorna status de sincronização detalhado para um dispositivo
   */
  @Get('device-status/:deviceId')
  getDeviceStatus(@Param('deviceId') deviceId: string, @Request() req) {
    return this.syncService.getDeviceStatus(deviceId, req.user.branchId);
  }

  // ============================================
  // Dashboard de Monitoramento
  // ============================================

  /**
   * Retorna estatísticas completas de sincronização para o dashboard
   * Inclui: dispositivos ativos, itens pendentes, falhas, DLQ, tendências
   */
  @Get('dashboard')
  getDashboardStats(@Request() req) {
    return this.syncService.getDashboardStats(req.user.branchId);
  }

  /**
   * Retorna histórico de sincronização recente
   */
  @Get('dashboard/history')
  getSyncHistory(
    @Query('limit') limit: string,
    @Query('entityType') entityType: string,
    @Request() req,
  ) {
    return this.syncService.getSyncHistory(
      req.user.branchId,
      parseInt(limit) || 50,
      entityType,
    );
  }

  /**
   * Retorna alertas de sincronização ativos
   */
  @Get('dashboard/alerts')
  getSyncAlerts(@Request() req) {
    return this.syncService.getSyncAlerts(req.user.branchId);
  }
}
