import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenCashBoxDto, CloseCashBoxDto, AddTransactionDto } from './dto';

@Injectable()
export class CashBoxService {
  constructor(private prisma: PrismaService) {}

  async openCashBox(openDto: OpenCashBoxDto, userId: string) {
    // Verificar se já existe caixa aberto na filial
    const existingOpen = await this.prisma.cashBox.findFirst({
      where: {
        branchId: openDto.branchId,
        status: 'open',
      },
    });

    if (existingOpen) {
      throw new BadRequestException('Já existe um caixa aberto nesta filial');
    }

    return this.prisma.cashBox.create({
      data: {
        boxNumber: `BOX-${Date.now()}`,
        branch: { connect: { id: openDto.branchId } },
        openedByUser: { connect: { id: userId } },
        openingCash: openDto.openingAmount,
        status: 'open',
        notes: openDto.notes,
      },
      include: {
        openedByUser: true,
        branch: true,
      },
    });
  }

  async closeCashBox(id: string, closeDto: CloseCashBoxDto) {
    const cashBox = await this.prisma.cashBox.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!cashBox) {
      throw new NotFoundException('Caixa não encontrado');
    }

    if (cashBox.status !== 'open') {
      throw new BadRequestException('Caixa já foi fechado');
    }

    // Calcular valor esperado baseado em vendas
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId: cashBox.branchId,
        status: 'closed',
        closedAt: {
          gte: cashBox.openedAt,
        },
      },
      include: {
        payments: true,
      },
    });

    // Somar apenas pagamentos em dinheiro
    const cashPayments = sales.reduce((sum, sale) => {
      const cashAmount = sale.payments
        .filter(p => p.method === 'cash' && p.status === 'completed')
        .reduce((s, p) => s + p.amount, 0);
      return sum + cashAmount;
    }, 0);

    const expectedAmount = cashBox.openingCash + cashPayments;
    const difference = closeDto.closingAmount - expectedAmount;

    return this.prisma.cashBox.update({
      where: { id },
      data: {
        closingCash: closeDto.closingAmount,
        difference,
        status: 'closed',
        closedAt: new Date(),
        notes: closeDto.notes,
      },
      include: {
        openedByUser: true,
        branch: true,
      },
    });
  }

  async addTransaction(id: string, transactionDto: AddTransactionDto) {
    const cashBox = await this.prisma.cashBox.findUnique({
      where: { id },
    });

    if (!cashBox) {
      throw new NotFoundException('Caixa não encontrado');
    }

    if (cashBox.status !== 'open') {
      throw new BadRequestException('Caixa está fechado');
    }

    // Atualizar saldo do caixa
    const amountChange = transactionDto.type === 'in' 
      ? transactionDto.amount 
      : -transactionDto.amount;

    await this.prisma.cashBox.update({
      where: { id },
      data: {
        openingCash: { increment: amountChange },
      },
    });

    return {
      message: 'Transação registrada com sucesso',
      type: transactionDto.type,
      amount: transactionDto.amount,
      reason: transactionDto.reason,
    };
  }

  async getCurrentCashBox(branchId: string) {
    const cashBox = await this.prisma.cashBox.findFirst({
      where: {
        branchId,
        status: 'open',
      },
      include: {
        openedByUser: true,
        branch: true,
      },
    });

    if (!cashBox) {
      return null;
    }

    // Buscar vendas do período
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId,
        openedAt: { gte: cashBox.openedAt },
      },
      include: {
        payments: true,
      },
    });

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const cashPayments = sales.reduce((sum, sale) => {
      const cashAmount = sale.payments
        .filter(p => p.method === 'cash')
        .reduce((s, p) => s + p.amount, 0);
      return sum + cashAmount;
    }, 0);

    return {
      ...cashBox,
      stats: {
        totalSales,
        cashPayments,
        currentAmount: cashBox.openingCash + cashPayments,
        salesCount: sales.length,
      },
    };
  }

  async getHistory(branchId: string, limit = 30) {
    return this.prisma.cashBox.findMany({
      where: { branchId },
      include: {
        openedByUser: true,
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string) {
    const cashBox = await this.prisma.cashBox.findUnique({
      where: { id },
      include: {
        openedByUser: true,
        branch: true,
      },
    });

    if (!cashBox) {
      throw new NotFoundException('Caixa não encontrado');
    }

    return cashBox;
  }

  async getCurrentCashBoxForUser(userId: string) {
    const cashBox = await this.prisma.cashBox.findFirst({
      where: {
        openedBy: userId,
        status: 'open',
      },
      include: {
        openedByUser: true,
        branch: true,
      },
    });

    if (!cashBox) {
      return null;
    }

    // Buscar vendas do período
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId: cashBox.branchId,
        openedAt: { gte: cashBox.openedAt },
      },
      include: {
        payments: true,
      },
    });

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const cashPayments = sales.reduce((sum, sale) => {
      const cashAmount = sale.payments
        .filter(p => p.method === 'cash')
        .reduce((s, p) => s + p.amount, 0);
      return sum + cashAmount;
    }, 0);

    return {
      ...cashBox,
      stats: {
        totalSales,
        cashPayments,
        currentAmount: cashBox.openingCash + cashPayments,
        salesCount: sales.length,
      },
    };
  }

  async getHistoryAll(limit = 30) {
    return this.prisma.cashBox.findMany({
      include: {
        openedByUser: true,
        branch: true,
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  }

  async getMovements(cashBoxId?: string, limit = 50) {
    // Se não tiver cashBoxId, pegar do caixa mais recente
    let targetCashBox: { id: string; openedAt: Date; branchId: string } | null = null;
    
    if (cashBoxId) {
      targetCashBox = await this.prisma.cashBox.findUnique({
        where: { id: cashBoxId },
        select: { id: true, openedAt: true, branchId: true },
      });
    } else {
      targetCashBox = await this.prisma.cashBox.findFirst({
        where: { status: 'open' },
        orderBy: { openedAt: 'desc' },
        select: { id: true, openedAt: true, branchId: true },
      });
    }

    if (!targetCashBox) {
      return [];
    }

    // Buscar pagamentos das vendas durante o período do caixa
    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: targetCashBox.openedAt },
        sale: { branchId: targetCashBox.branchId },
      },
      include: {
        sale: {
          select: {
            saleNumber: true,
            customer: { select: { fullName: true } },
            cashier: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Mapear para o formato esperado pelo mobile
    return payments.map(payment => ({
      id: payment.id,
      cashBoxId: targetCashBox!.id,
      movementType: payment.method === 'cash' ? 'cash_in' : payment.method,
      amount: payment.amount,
      description: `Venda ${payment.sale?.saleNumber || ''}${
        payment.sale?.customer?.fullName ? ` - ${payment.sale.customer.fullName}` : ''
      }`,
      referenceType: 'sale',
      referenceId: payment.saleId,
      userId: null,
      userName: payment.sale?.cashier?.fullName || null,
      createdAt: payment.createdAt,
    }));
  }
}



