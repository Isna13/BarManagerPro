import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        priority: createNotificationDto.priority || 'MEDIUM',
        userId: createNotificationDto.userId,
        branchId: createNotificationDto.branchId,
        metadata: createNotificationDto.metadata,
      },
      include: {
        user: { select: { name: true, email: true } },
        branch: { select: { name: true, code: true } },
      },
    });

    // TODO: Emit via WebSocket
    // this.webSocketGateway.emitNotification(notification);

    return notification;
  }

  async findAll(query: NotificationQueryDto, userId: string) {
    const where: any = {
      OR: [{ userId }, { userId: null }],
    };

    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.isRead !== undefined) where.isRead = query.isRead;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    return this.prisma.notification.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        branch: { select: { name: true, code: true } },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        OR: [{ userId }, { userId: null }],
        isRead: false,
      },
    });

    return { count };
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        OR: [{ userId }, { userId: null }],
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async remove(id: string) {
    return this.prisma.notification.delete({ where: { id } });
  }

  async removeAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { OR: [{ userId }, { userId: null }] },
    });
  }

  // Automated notifications
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkLowStock() {
    const lowStockItems = await this.prisma.inventory.findMany({
      where: {
        quantity: { lte: this.prisma.inventory.fields.lowStockThreshold },
      },
      include: {
        product: { select: { name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    for (const item of lowStockItems) {
      await this.create({
        title: 'Estoque Baixo',
        message: `${item.product.name} está com estoque baixo (${item.quantity} unidades)`,
        type: 'LOW_STOCK',
        priority: 'HIGH',
        branchId: item.branchId,
        metadata: JSON.stringify({ inventoryId: item.id, productId: item.productId }),
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkOverdueDebts() {
    const overdueDebts = await this.prisma.debt.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { lt: new Date() },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    const grouped = overdueDebts.reduce((acc, debt) => {
      if (!acc[debt.branchId]) acc[debt.branchId] = [];
      acc[debt.branchId].push(debt);
      return acc;
    }, {} as Record<string, typeof overdueDebts>);

    for (const [branchId, debts] of Object.entries(grouped)) {
      const totalAmount = debts.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0);
      await this.create({
        title: 'Dívidas Vencidas',
        message: `${debts.length} dívida(s) vencida(s) totalizando ${totalAmount.toFixed(2)} Kz`,
        type: 'OVERDUE_DEBT',
        priority: 'URGENT',
        branchId,
        metadata: JSON.stringify({ debtIds: debts.map((d) => d.id) }),
      });
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async sendDailySummary() {
    const branches = await this.prisma.branch.findMany({ where: { isActive: true } });

    for (const branch of branches) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sales = await this.prisma.sale.count({
        where: { branchId: branch.id, createdAt: { gte: today } },
      });

      const revenue = await this.prisma.sale.aggregate({
        where: { branchId: branch.id, createdAt: { gte: today } },
        _sum: { totalAmount: true },
      });

      await this.create({
        title: 'Resumo Diário',
        message: `${sales} venda(s) realizadas hoje, total: ${(revenue._sum.totalAmount || 0).toFixed(2)} Kz`,
        type: 'DAILY_SUMMARY',
        priority: 'LOW',
        branchId: branch.id,
      });
    }
  }
}
