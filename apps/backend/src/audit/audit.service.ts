import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAuditDto: CreateAuditDto) {
    return this.prisma.auditLog.create({
      data: {
        userId: createAuditDto.userId,
        action: createAuditDto.action,
        entity: createAuditDto.entity,
        entityId: createAuditDto.entityId,
        details: createAuditDto.details,
        ipAddress: createAuditDto.ipAddress,
      },
      include: {
        user: { select: { email: true } },
      },
    });
  }

  async findAll(query: any) {
    const where: any = {};

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to last 100 records
    });
  }

  async getUserAudit(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getEntityAudit(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAuditStats(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [totalLogs, byAction, byEntity, topUsers] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['entity'],
        where,
        _count: { entity: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalLogs,
      byAction: byAction.map(a => ({ action: a.action, count: a._count.action })),
      byEntity: byEntity.map(e => ({ entity: e.entity, count: e._count.entity })),
      topUsers: topUsers.map(u => ({ userId: u.userId, count: u._count.userId })),
    };
  }

  // Helper method to log actions from other services
  async logAction(
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
    details?: string,
  ) {
    return this.create({
      userId,
      action: action as any,
      entity: entity as any,
      entityId,
      details,
    });
  }
}
