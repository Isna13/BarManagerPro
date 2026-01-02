import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSyncItemDto, SyncOperation, SyncEntity } from './dto/create-sync-item.dto';
import { BulkSyncDto } from './dto/bulk-sync.dto';
import { SyncQueryDto } from './dto/sync-query.dto';

interface SyncResult {
  success: number;
  failed: number;
  conflicts: number;
  errors: Array<{ item: any; error: string }>;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async createSyncItem(createSyncItemDto: CreateSyncItemDto) {
    return this.prisma.syncQueue.create({
      data: {
        entity: createSyncItemDto.entity,
        operation: createSyncItemDto.operation,
        entityId: createSyncItemDto.entityId,
        data: createSyncItemDto.data,
        branchId: createSyncItemDto.branchId,
        deviceId: createSyncItemDto.deviceId,
        status: 'pending',
      },
    });
  }

  async bulkSync(bulkSyncDto: BulkSyncDto, userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    for (const item of bulkSyncDto.items) {
      try {
        // Check for conflicts
        const conflict = await this.detectConflict(item);
        if (conflict) {
          result.conflicts++;
          await this.createConflictRecord(item, conflict);
          continue;
        }

        // Process sync item
        await this.processSyncItem(item);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          item,
          error: error.message,
        });
      }
    }

    return result;
  }

  async getPendingItems(query: SyncQueryDto) {
    const where: any = { status: 'pending' };

    if (query.entity) where.entity = query.entity;
    if (query.operation) where.operation = query.operation;
    if (query.branchId) where.branchId = query.branchId;
    if (query.since || query.until) {
      where.createdAt = {};
      if (query.since) where.createdAt.gte = new Date(query.since);
      if (query.until) where.createdAt.lte = new Date(query.until);
    }

    return this.prisma.syncQueue.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getConflicts(query: SyncQueryDto) {
    const where: any = {};

    if (query.entity) where.entity = query.entity;
    if (query.branchId) where.branchId = query.branchId;

    return this.prisma.syncConflict.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveConflict(id: string, action: 'keep_local' | 'keep_remote' | 'merge') {
    const conflict = await this.prisma.syncConflict.findUnique({
      where: { id },
    });

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    let resolvedData: string;

    switch (action) {
      case 'keep_local':
        resolvedData = JSON.stringify(conflict.localData);
        break;
      case 'keep_remote':
        resolvedData = JSON.stringify(conflict.remoteData);
        break;
      case 'merge':
        // Simple merge strategy: merge non-conflicting fields
        const local = typeof conflict.localData === 'string' ? JSON.parse(conflict.localData) : conflict.localData;
        const remote = typeof conflict.remoteData === 'string' ? JSON.parse(conflict.remoteData) : conflict.remoteData;
        const merged = { ...local, ...remote };
        resolvedData = JSON.stringify(merged);
        break;
      default:
        throw new ConflictException('Invalid resolution action');
    }

    // Apply resolution
    await this.processSyncItem({
      entity: conflict.entity as SyncEntity,
      operation: 'update' as SyncOperation,
      entityId: conflict.entityId,
      data: resolvedData,
      branchId: conflict.branchId,
    });

    // Mark conflict as resolved
    return this.prisma.syncConflict.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolution: action,
      },
    });
  }

  async getSyncStatus(branchId: string) {
    const [pending, conflicts, lastSync] = await Promise.all([
      this.prisma.syncQueue.count({
        where: { branchId, status: 'pending' },
      }),
      this.prisma.syncConflict.count({
        where: { branchId, resolved: false },
      }),
      this.prisma.syncQueue.findFirst({
        where: { branchId, status: 'synced' },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
    ]);

    return {
      pendingItems: pending,
      conflicts,
      lastSyncAt: lastSync?.processedAt,
      status: conflicts > 0 ? 'conflicts' : pending > 0 ? 'pending' : 'synced',
    };
  }

  async deleteSyncItem(id: string) {
    return this.prisma.syncQueue.delete({ where: { id } });
  }

  // Delta sync methods
  async pushDelta(lastSync: string, items: any[], branchId: string) {
    const result: SyncResult = {
      success: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    for (const item of items) {
      try {
        await this.processSyncItem({
          ...item,
          branchId,
        });
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({ item, error: error.message });
      }
    }

    return result;
  }

  async pullDelta(lastSync: string, branchId: string) {
    const since = new Date(lastSync);

    // Get all changes since lastSync
    const [sales, customers, inventory, products, debts, payments, tables, tableSessions, users, categories, suppliers, branches] = await Promise.all([
      this.prisma.sale.findMany({
        where: { branchId, updatedAt: { gte: since } },
        include: { items: true, payments: true },
      }),
      this.prisma.customer.findMany({
        where: { branchId, updatedAt: { gte: since } },
      }),
      this.prisma.inventoryItem.findMany({
        where: { branchId, updatedAt: { gte: since } },
      }),
      this.prisma.product.findMany({
        where: { branchId, updatedAt: { gte: since } },
      }),
      this.prisma.debt.findMany({
        where: { branchId, updatedAt: { gte: since } },
      }),
      this.prisma.payment.findMany({
        where: { 
          debt: { branchId },
          createdAt: { gte: since }
        },
      }),
      // Tabelas
      this.prisma.table.findMany({
        where: { branchId, updatedAt: { gte: since } },
      }),
      // Sessões de mesas com clientes e pedidos
      this.prisma.tableSession.findMany({
        where: { branchId, updatedAt: { gte: since } },
        include: {
          customers: {
            include: {
              orders: true,
              payments: true,
            },
          },
          payments: true,
        },
      }),
      // Usuários (sem senha)
      this.prisma.user.findMany({
        where: { 
          OR: [
            { branchId },
            { branchId: null }, // Usuários globais (admin/owner)
          ],
          updatedAt: { gte: since },
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          roleName: true,
          branchId: true,
          phone: true,
          allowedTabs: true,
          isActive: true,
          synced: true,
          lastSync: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      // Categorias (não têm branchId, sincronizar todas)
      this.prisma.category.findMany({
        where: { updatedAt: { gte: since } },
      }),
      // Fornecedores
      this.prisma.supplier.findMany({
        where: { branchId, updatedAt: { gte: since } },
      }),
      // Branches
      this.prisma.branch.findMany({
        where: { updatedAt: { gte: since } },
      }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      changes: {
        sales,
        customers,
        inventory,
        products,
        debts,
        payments,
        tables,
        tableSessions,
        users,
        categories,
        suppliers,
        branches,
      },
    };
  }

  // Private helper methods
  private async detectConflict(item: CreateSyncItemDto): Promise<any | null> {
    const entityTable = this.getEntityTable(item.entity);
    if (!entityTable) return null;

    try {
      const existing = await (this.prisma as any)[entityTable].findUnique({
        where: { id: item.entityId },
      });

      if (!existing) return null;

      // Check if existing data differs from sync data
      const syncData = JSON.parse(item.data);
      const existingUpdated = existing.updatedAt;
      const syncUpdated = syncData.updatedAt ? new Date(syncData.updatedAt) : null;

      // Conflict if existing is newer than sync data
      if (syncUpdated && existingUpdated > syncUpdated) {
        return existing;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async createConflictRecord(item: CreateSyncItemDto, conflict: any) {
    return this.prisma.syncConflict.create({
      data: {
        entity: item.entity,
        entityId: item.entityId,
        localData: JSON.stringify(conflict),
        remoteData: item.data,
        branchId: item.branchId,
        deviceId: item.deviceId || 'unknown',
      },
    });
  }

  private async processSyncItem(item: CreateSyncItemDto) {
    const entityTable = this.getEntityTable(item.entity);
    if (!entityTable) {
      throw new Error(`Unknown entity: ${item.entity}`);
    }

    const data = JSON.parse(item.data);

    switch (item.operation) {
      case 'create':
        // 🔴 CORREÇÃO: Usar upsert para idempotência
        // Se o registro já existe, não atualizar (evita sobrescrever dados mais recentes)
        if (data.id) {
          return (this.prisma as any)[entityTable].upsert({
            where: { id: data.id },
            create: data,
            update: {}, // Não atualizar se já existe - manter dados existentes
          });
        }
        return (this.prisma as any)[entityTable].create({ data });
      case 'update':
        return (this.prisma as any)[entityTable].update({
          where: { id: item.entityId },
          data,
        });
      case 'delete':
        return (this.prisma as any)[entityTable].delete({
          where: { id: item.entityId },
        });
      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  private getEntityTable(entity: SyncEntity): string | null {
    const mapping: Record<SyncEntity, string> = {
      sale: 'sale',
      customer: 'customer',
      inventory: 'inventory',
      product: 'product',
      debt: 'debt',
      payment: 'payment',
      table: 'table',
      table_session: 'tableSession',
      table_customer: 'tableCustomer',
      table_order: 'tableOrder',
    };
    return mapping[entity] || null;
  }

  // ============================================
  // ACK Explícito Bidirecional
  // ============================================

  /**
   * Registra confirmação de recebimento do cliente
   * Marca itens como confirmados no registro de sincronização
   */
  async acknowledgeSync(
    entityIds: string[],
    deviceId: string,
    syncTimestamp: string,
    userId: string,
  ) {
    const timestamp = new Date();
    
    // Registrar ACK para auditoria
    const ackRecords = entityIds.map(entityId => ({
      deviceId,
      entityId,
      syncTimestamp: new Date(syncTimestamp),
      acknowledgedAt: timestamp,
      userId,
    }));

    // Atualizar sync_queue para marcar como confirmados
    const updateResult = await this.prisma.syncQueue.updateMany({
      where: {
        entityId: { in: entityIds },
        status: 'synced',
      },
      data: {
        status: 'acknowledged',
        processedAt: timestamp,
      },
    });

    console.log(`✅ ACK recebido de ${deviceId}: ${entityIds.length} itens confirmados`);

    return {
      acknowledged: updateResult.count,
      timestamp: timestamp.toISOString(),
    };
  }

  /**
   * Registra heartbeat do dispositivo para monitoramento
   */
  async recordHeartbeat(
    data: {
      deviceId: string;
      pendingItems: number;
      failedItems: number;
      dlqItems: number;
      lastSync: string;
    },
    branchId: string,
  ) {
    const timestamp = new Date();
    
    // Upsert no registro de dispositivos (usando raw query ou modelo apropriado)
    // Por simplicidade, vamos apenas logar e retornar status
    console.log(`💓 Heartbeat de ${data.deviceId}: pending=${data.pendingItems}, failed=${data.failedItems}, dlq=${data.dlqItems}`);

    // Verificar se há itens pendentes do servidor para este dispositivo
    const pendingForDevice = await this.prisma.syncQueue.count({
      where: {
        branchId,
        status: 'pending',
      },
    });

    return {
      received: true,
      timestamp: timestamp.toISOString(),
      serverPendingItems: pendingForDevice,
      message: data.failedItems > 0 || data.dlqItems > 0 
        ? 'Atenção: há itens falhados no dispositivo' 
        : 'OK',
    };
  }

  /**
   * Retorna status detalhado de um dispositivo
   */
  async getDeviceStatus(deviceId: string, branchId: string) {
    // Buscar estatísticas de sincronização deste dispositivo
    const [pendingItems, syncedItems, conflicts] = await Promise.all([
      this.prisma.syncQueue.count({
        where: { deviceId, status: 'pending' },
      }),
      this.prisma.syncQueue.count({
        where: { deviceId, status: { in: ['synced', 'acknowledged'] } },
      }),
      this.prisma.syncConflict.count({
        where: { deviceId, resolved: false },
      }),
    ]);

    return {
      deviceId,
      branchId,
      pendingItems,
      syncedItems,
      unresolvedConflicts: conflicts,
      status: conflicts > 0 ? 'has_conflicts' : pendingItems > 0 ? 'syncing' : 'synced',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // Dashboard de Monitoramento de Sync
  // ============================================

  /**
   * Retorna estatísticas completas para o dashboard de monitoramento
   */
  async getDashboardStats(branchId: string) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Buscar todas as estatísticas em paralelo
    const [
      totalPending,
      totalFailed,
      totalSynced24h,
      pendingByEntity,
      failedByEntity,
      activeDevices,
      recentConflicts,
      avgSyncTime,
    ] = await Promise.all([
      // Total pendentes
      this.prisma.syncQueue.count({
        where: { status: 'pending' },
      }),

      // Total com erro
      this.prisma.syncQueue.count({
        where: { status: 'error' },
      }),

      // Total sincronizados nas últimas 24h
      this.prisma.syncQueue.count({
        where: {
          status: { in: ['synced', 'acknowledged'] },
          processedAt: { gte: oneDayAgo },
        },
      }),

      // Pendentes por tipo de entidade
      this.prisma.syncQueue.groupBy({
        by: ['entity'],
        where: { status: 'pending' },
        _count: { id: true },
      }),

      // Falhas por tipo de entidade
      this.prisma.syncQueue.groupBy({
        by: ['entity'],
        where: { status: 'error' },
        _count: { id: true },
      }),

      // Dispositivos ativos (enviaram heartbeat na última hora)
      this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT "device_id") as count
        FROM "sync_queue"
        WHERE "created_at" >= ${oneHourAgo}
      `,

      // Conflitos recentes não resolvidos
      this.prisma.syncConflict.count({
        where: { resolved: false },
      }),

      // Tempo médio de sincronização (usando meta dos items processados)
      this.prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM ("processed_at" - "created_at"))) as avg_seconds
        FROM "sync_queue"
        WHERE status = 'synced' AND "processed_at" >= ${oneDayAgo}
      `,
    ]);

    // Converter resultados agrupados para formato amigável
    const pendingByEntityMap: Record<string, number> = {};
    for (const item of pendingByEntity) {
      pendingByEntityMap[item.entity] = item._count.id;
    }

    const failedByEntityMap: Record<string, number> = {};
    for (const item of failedByEntity) {
      failedByEntityMap[item.entity] = item._count.id;
    }

    // Calcular saúde geral do sistema
    const healthScore = this.calculateHealthScore(totalPending, totalFailed, recentConflicts);

    return {
      overview: {
        totalPending,
        totalFailed,
        totalSynced24h,
        activeDevices: Number((activeDevices as any[])[0]?.count || 0),
        unresolvedConflicts: recentConflicts,
        healthScore,
        healthStatus: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical',
      },
      breakdown: {
        pendingByEntity: pendingByEntityMap,
        failedByEntity: failedByEntityMap,
      },
      performance: {
        avgSyncTimeSeconds: Math.round((avgSyncTime as any[])[0]?.avg_seconds || 0),
      },
      timestamp: now.toISOString(),
    };
  }

  /**
   * Calcula score de saúde do sistema de sync (0-100)
   */
  private calculateHealthScore(pending: number, failed: number, conflicts: number): number {
    let score = 100;

    // Penalizar por itens pendentes (até -30 pontos)
    if (pending > 100) score -= 30;
    else if (pending > 50) score -= 20;
    else if (pending > 20) score -= 10;
    else if (pending > 5) score -= 5;

    // Penalizar por falhas (até -40 pontos)
    if (failed > 50) score -= 40;
    else if (failed > 20) score -= 30;
    else if (failed > 10) score -= 20;
    else if (failed > 0) score -= 10;

    // Penalizar por conflitos (até -30 pontos)
    if (conflicts > 20) score -= 30;
    else if (conflicts > 10) score -= 20;
    else if (conflicts > 5) score -= 15;
    else if (conflicts > 0) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Retorna histórico de sincronização recente
   */
  async getSyncHistory(branchId: string, limit: number = 50, entityType?: string) {
    const where: any = {};
    if (entityType) {
      where.entity = entityType;
    }

    const items = await this.prisma.syncQueue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        entity: true,
        entityId: true,
        operation: true,
        status: true,
        retryCount: true,
        deviceId: true,
        createdAt: true,
        processedAt: true,
      },
    });

    // Mapear para formato esperado pelo frontend
    const mappedItems = items.map(item => ({
      id: item.id,
      entityType: item.entity,
      entityId: item.entityId,
      action: item.operation,
      status: item.status,
      retryCount: item.retryCount,
      deviceId: item.deviceId,
      createdAt: item.createdAt,
      updatedAt: item.processedAt || item.createdAt,
    }));

    return {
      items: mappedItems,
      total: items.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retorna alertas de sincronização ativos
   */
  async getSyncAlerts(branchId: string) {
    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      count?: number;
      entityType?: string;
    }> = [];

    // Verificar itens com muitas tentativas de retry
    const stuckItems = await this.prisma.syncQueue.count({
      where: {
        status: 'pending',
        retryCount: { gte: 5 },
      },
    });
    if (stuckItems > 0) {
      alerts.push({
        type: 'error',
        message: `${stuckItems} item(s) estão presos com 5+ tentativas de sync`,
        count: stuckItems,
      });
    }

    // Verificar falhas recentes
    const recentFailures = await this.prisma.syncQueue.count({
      where: {
        status: 'error',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // última hora
        },
      },
    });
    if (recentFailures > 0) {
      alerts.push({
        type: 'warning',
        message: `${recentFailures} falha(s) de sync na última hora`,
        count: recentFailures,
      });
    }

    // Verificar conflitos não resolvidos
    const conflicts = await this.prisma.syncConflict.count({
      where: { resolved: false },
    });
    if (conflicts > 0) {
      alerts.push({
        type: 'warning',
        message: `${conflicts} conflito(s) não resolvido(s) aguardando ação`,
        count: conflicts,
      });
    }

    // Verificar entidades com muitos pendentes
    const heavyEntities = await this.prisma.syncQueue.groupBy({
      by: ['entity'],
      where: { status: 'pending' },
      _count: { id: true },
      having: {
        id: { _count: { gte: 50 } },
      },
    });

    for (const entity of heavyEntities) {
      alerts.push({
        type: 'info',
        message: `${entity._count.id} itens pendentes para ${entity.entity}`,
        count: entity._count.id,
        entityType: entity.entity,
      });
    }

    return {
      alerts,
      count: alerts.length,
      hasErrors: alerts.some((a) => a.type === 'error'),
      hasWarnings: alerts.some((a) => a.type === 'warning'),
      timestamp: new Date().toISOString(),
    };
  }
}
