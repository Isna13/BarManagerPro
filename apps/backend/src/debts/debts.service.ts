import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtDto, PayDebtDto } from './dto';

@Injectable()
export class DebtsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateDebtDto, userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: createDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // Verificar limite de crédito
    if (customer.creditLimit && customer.creditLimit > 0) {
      const futureDebt = customer.currentDebt + createDto.amount;
      if (futureDebt > customer.creditLimit) {
        throw new BadRequestException(
          `Limite de crédito excedido. Disponível: ${customer.creditLimit - customer.currentDebt} FCFA`
        );
      }
    }

    const debt = await this.prisma.debt.create({
      data: {
        debtNumber: `DEBT-${Date.now()}`,
        customer: { connect: { id: createDto.customerId } },
        createdByUser: { connect: { id: userId } },
        originalAmount: createDto.amount,
        amount: createDto.amount,
        balance: createDto.amount,
        dueDate: createDto.dueDate,
        notes: createDto.notes,
        status: 'pending',
      },
      include: {
        customer: true,
        createdByUser: true,
      },
    });

    // Atualizar dívida total do cliente
    await this.prisma.customer.update({
      where: { id: createDto.customerId },
      data: {
        currentDebt: { increment: createDto.amount },
      },
    });

    return debt;
  }

  async payDebt(id: string, payDto: PayDebtDto) {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    if (debt.status === 'paid') {
      throw new BadRequestException('Dívida já foi quitada');
    }

    if (payDto.amount > debt.balance) {
      throw new BadRequestException('Valor de pagamento maior que o saldo devedor');
    }

    // Registrar pagamento
    await this.prisma.payment.create({
      data: {
        debtId: id,
        method: payDto.method,
        amount: payDto.amount,
        referenceNumber: payDto.reference,
        notes: payDto.notes,
        status: 'completed',
      },
    });

    // Atualizar dívida
    const newBalance = debt.balance - payDto.amount;
    const newPaid = debt.paid + payDto.amount;
    const newStatus = newBalance === 0 ? 'paid' : newBalance < debt.amount ? 'partial' : 'pending';

    await this.prisma.debt.update({
      where: { id },
      data: {
        paid: newPaid,
        paidAmount: newPaid, // Manter sincronizado com 'paid' para compatibilidade mobile
        balance: newBalance,
        status: newStatus,
      },
    });

    // Atualizar dívida total do cliente
    await this.prisma.customer.update({
      where: { id: debt.customerId },
      data: {
        currentDebt: { decrement: payDto.amount },
      },
    });

    return this.findOne(id);
  }

  async findAll(status?: string) {
    return this.prisma.debt.findMany({
      where: status ? { status } : undefined,
      include: {
        customer: true,
        createdByUser: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCustomer(customerId: string) {
    return this.prisma.debt.findMany({
      where: { customerId },
      include: {
        payments: true,
        createdByUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOverdue() {
    return this.prisma.debt.findMany({
      where: {
        status: { in: ['pending', 'partial'] },
        dueDate: {
          lt: new Date(),
        },
      },
      include: {
        customer: true,
        createdByUser: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(id: string) {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: {
        customer: true,
        createdByUser: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    return debt;
  }

  async getSummary() {
    const [totalPending, totalOverdue, overdueCount] = await Promise.all([
      this.prisma.debt.aggregate({
        where: {
          status: { in: ['pending', 'partial'] },
        },
        _sum: {
          balance: true,
        },
      }),
      this.prisma.debt.aggregate({
        where: {
          status: { in: ['pending', 'partial'] },
          dueDate: { lt: new Date() },
        },
        _sum: {
          balance: true,
        },
      }),
      this.prisma.debt.count({
        where: {
          status: { in: ['pending', 'partial'] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      totalPending: totalPending._sum.balance || 0,
      totalOverdue: totalOverdue._sum.balance || 0,
      overdueCount,
    };
  }
}
