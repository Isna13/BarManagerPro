import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDebtDto, PayDebtDto, UpdateDebtDto } from './dto';

@Injectable()
export class DebtsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateDebtDto, userId: string) {
    // Se ID foi fornecido (sincronização do Electron), verificar se já existe
    if (createDto.id) {
      const existing = await this.prisma.debt.findUnique({
        where: { id: createDto.id },
        include: {
          customer: true,
          createdByUser: true,
          payments: true,
        },
      });
      if (existing) {
        console.log('⚠️ Débito já existe (por ID), retornando existente:', existing.id);
        return existing;
      }
    }

    // 🔒 IDEMPOTÊNCIA: Verificar se já existe dívida para esta venda (saleId)
    // Isso evita duplicação quando Mobile e Backend tentam criar a mesma dívida
    if (createDto.saleId) {
      const existingBySale = await this.prisma.debt.findFirst({
        where: { saleId: createDto.saleId },
        include: {
          customer: true,
          createdByUser: true,
          payments: true,
        },
      });
      if (existingBySale) {
        console.log(`⚠️ Débito já existe para venda ${createDto.saleId}, retornando: ${existingBySale.id}`);
        return existingBySale;
      }
    }

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

    // Construir dados do débito
    const debtData: any = {
      debtNumber: createDto.debtNumber || `DEBT-${Date.now()}`,
      customer: { connect: { id: createDto.customerId } },
      createdByUser: { connect: { id: userId } },
      originalAmount: createDto.amount,
      amount: createDto.amount,
      balance: createDto.amount,
      dueDate: createDto.dueDate,
      notes: createDto.notes,
      status: 'pending',
    };

    // Usar ID fornecido (sincronização do Electron) ou deixar Prisma gerar
    if (createDto.id) {
      debtData.id = createDto.id;
    }

    // Associar à venda se fornecido
    if (createDto.saleId) {
      debtData.sale = { connect: { id: createDto.saleId } };
    }

    // Associar ao branch se fornecido
    if (createDto.branchId) {
      debtData.branch = { connect: { id: createDto.branchId } };
    }

    const debt = await this.prisma.debt.create({
      data: debtData,
      include: {
        customer: true,
        createdByUser: true,
      },
    });

    console.log('✅ Débito criado:', debt.id, '- Valor:', debt.amount);

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

  async updateDebt(id: string, updateDto: UpdateDebtDto) {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!debt) {
      throw new NotFoundException('Dívida não encontrada');
    }

    // Construir dados de atualização
    const updateData: any = {};

    // Atualizar valores se fornecidos
    if (updateDto.paidAmount !== undefined) {
      updateData.paid = updateDto.paidAmount;
      updateData.paidAmount = updateDto.paidAmount;
    } else if (updateDto.paid !== undefined) {
      updateData.paid = updateDto.paid;
      updateData.paidAmount = updateDto.paid;
    }

    if (updateDto.balance !== undefined) {
      updateData.balance = updateDto.balance;
    }

    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;
    }

    if (updateDto.notes !== undefined) {
      updateData.notes = updateDto.notes;
    }

    // Calcular diferença de dívida para atualizar cliente
    const oldBalance = debt.balance;
    const newBalance = updateDto.balance !== undefined ? updateDto.balance : oldBalance;
    const balanceDiff = oldBalance - newBalance;

    // Atualizar dívida
    await this.prisma.debt.update({
      where: { id },
      data: updateData,
    });

    // Atualizar dívida total do cliente se houve mudança no saldo
    if (balanceDiff !== 0) {
      await this.prisma.customer.update({
        where: { id: debt.customerId },
        data: {
          currentDebt: { decrement: balanceDiff },
        },
      });
    }

    console.log('✅ Dívida atualizada via PATCH:', id, '- Status:', updateDto.status, '- Balance:', newBalance);

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

  async findPendingByCustomers(customerIds: string[]) {
    return this.prisma.debt.findMany({
      where: { 
        customerId: { in: customerIds },
        status: { in: ['pending', 'partial'] },
      },
      include: {
        customer: true,
        payments: true,
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
