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
        branchId: openDto.branchId,
        userId,
        openingAmount: openDto.openingAmount,
        status: 'open',
        notes: openDto.notes,
      },
      include: {
        user: true,
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

    const expectedAmount = cashBox.openingAmount + cashPayments;
    const difference = closeDto.closingAmount - expectedAmount;

    return this.prisma.cashBox.update({
      where: { id },
      data: {
        closingAmount: closeDto.closingAmount,
        expectedAmount,
        difference,
        status: 'closed',
        closedAt: new Date(),
        closingNotes: closeDto.notes,
      },
      include: {
        user: true,
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
        openingAmount: { increment: amountChange },
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
        user: true,
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
        currentAmount: cashBox.openingAmount + cashPayments,
        salesCount: sales.length,
      },
    };
  }

  async getHistory(branchId: string, limit = 30) {
    return this.prisma.cashBox.findMany({
      where: { branchId },
      include: {
        user: true,
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  }

  async findOne(id: string) {
    const cashBox = await this.prisma.cashBox.findUnique({
      where: { id },
      include: {
        user: true,
        branch: true,
      },
    });

    if (!cashBox) {
      throw new NotFoundException('Caixa não encontrado');
    }

    return cashBox;
  }
}
