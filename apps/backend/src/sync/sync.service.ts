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
      // Categorias
      this.prisma.category.findMany({
        where: { branchId, updatedAt: { gte: since } },
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
}
