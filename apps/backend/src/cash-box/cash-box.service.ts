import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenCashBoxDto, CloseCashBoxDto, AddTransactionDto } from './dto';

@Injectable()
export class CashBoxService {
  constructor(private prisma: PrismaService) {}

  async openCashBox(openDto: OpenCashBoxDto, userId: string) {
    // Se um ID foi fornecido (sincronização do Electron), verificar se já existe
    if (openDto.id) {
      const existing = await this.prisma.cashBox.findUnique({
        where: { id: openDto.id },
      });
      if (existing) {
        // Já existe, retornar o existente (idempotência para sincronização)
        return this.prisma.cashBox.findUnique({
          where: { id: openDto.id },
          include: {
            openedByUser: true,
            branch: true,
          },
        });
      }
    }

    // Verificar se já existe caixa aberto na filial
    const existingOpen = await this.prisma.cashBox.findFirst({
      where: {
        branchId: openDto.branchId,
        status: 'open',
      },
    });

    if (existingOpen) {
      // Se já existe um caixa aberto e estamos sincronizando, retornar o existente
      if (openDto.id) {
        return existingOpen;
      }
      throw new BadRequestException('Já existe um caixa aberto nesta filial');
    }

    return this.prisma.cashBox.create({
      data: {
        ...(openDto.id && { id: openDto.id }), // Usar ID do Electron se fornecido
        boxNumber: openDto.boxNumber || `BOX-${Date.now()}`,
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

    // Somar apenas pagamentos em dinheiro (case-insensitive)
    const cashPayments = sales.reduce((sum, sale) => {
      const cashAmount = sale.payments
        .filter(p => (p.method || '').toLowerCase() === 'cash' && p.status === 'completed')
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

  // Forçar fechamento de um caixa específico (para correção de dados)
  async forceCloseCashBox(id: string) {
    const cashBox = await this.prisma.cashBox.findUnique({
      where: { id },
    });

    if (!cashBox) {
      throw new NotFoundException('Caixa não encontrado');
    }

    return this.prisma.cashBox.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: cashBox.closedAt || new Date(),
        closingCash: cashBox.closingCash || cashBox.openingCash,
      },
      include: {
        openedByUser: true,
        branch: true,
      },
    });
  }

  // Corrigir todos os caixas que estão fechados mas sem closedAt
  async fixClosedAtForClosedBoxes() {
    const result = await this.prisma.cashBox.updateMany({
      where: {
        status: 'closed',
        closedAt: null,
      },
      data: {
        closedAt: new Date(),
      },
    });

    return { 
      message: `${result.count} caixas corrigidos`,
      count: result.count 
    };
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

    // CRÍTICO: Buscar apenas pagamentos de mesas (TablePayment) que NÃO têm Payment vinculado
    // Se paymentId != null, significa que já existe um Payment contabilizado na Sale
    // Isso evita duplicação: Sale.total + TablePayment.amount
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null, // ⚠️ APENAS pagamentos de mesa SEM Payment vinculado
      },
    });

    // Combinar totais de vendas diretas + pagamentos de mesas (sem duplicação)
    const directTotalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const tableTotalSales = tablePayments.reduce((sum, tp) => sum + tp.amount, 0);
    const totalSales = directTotalSales + tableTotalSales;
    
    // Calcular pagamentos por método (case-insensitive) - CONSISTÊNCIA com getCurrentCashBoxForUser
    let cashPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => (p.method || '').toLowerCase() === 'cash')
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    let mobileMoneyPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => {
          const method = (p.method || '').toLowerCase();
          return method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile';
        })
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    let cardPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => {
          const method = (p.method || '').toLowerCase();
          return method === 'card' || method === 'mixed';
        })
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    let debtPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => {
          const method = (p.method || '').toLowerCase();
          return method === 'debt' || method === 'vale';
        })
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    // CRÍTICO: Adicionar pagamentos de mesas aos totais por método
    for (const tp of tablePayments) {
      const method = (tp.method || '').toLowerCase();
      if (method === 'cash') {
        cashPayments += tp.amount;
      } else if (method === 'vale' || method === 'debt') {
        debtPayments += tp.amount;
      } else if (method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile') {
        mobileMoneyPayments += tp.amount;
      } else if (method === 'card' || method === 'mixed') {
        cardPayments += tp.amount;
      }
    }

    return {
      ...cashBox,
      stats: {
        totalSales,
        cashPayments,
        mobileMoneyPayments,
        cardPayments,
        debtPayments,
        totalCashOut: 0, // Saídas de caixa (não implementado ainda)
        currentAmount: cashBox.openingCash + cashPayments,
        // CORREÇÃO: Não somar tablePayments.length pois vendas de mesa já criam Sale
        // Antes: sales.length + tablePayments.length (DUPLICAVA!)
        salesCount: sales.length,
      },
    };
  }

  async getHistory(branchId: string, limit = 30) {
    const cashBoxes = await this.prisma.cashBox.findMany({
      where: { branchId },
      include: {
        openedByUser: true,
        branch: true,
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });

    // Para cada caixa, calcular estatísticas
    const enrichedCashBoxes = await Promise.all(
      cashBoxes.map(async (cashBox) => {
        const salesQuery: any = {
          branchId: cashBox.branchId,
          openedAt: { gte: cashBox.openedAt },
        };
        
        // Query para TablePayments - APENAS os que NÃO têm Payment vinculado (evita duplicação)
        const tablePaymentsQuery: any = {
          processedAt: { gte: cashBox.openedAt },
          session: { branchId: cashBox.branchId },
          paymentId: null, // ⚠️ CRÍTICO: Evita contar TablePayment que já tem Payment
        };
        
        if (cashBox.closedAt) {
          salesQuery.openedAt = {
            gte: cashBox.openedAt,
            lte: cashBox.closedAt,
          };
          tablePaymentsQuery.processedAt = {
            gte: cashBox.openedAt,
            lte: cashBox.closedAt,
          };
        }

        const sales = await this.prisma.sale.findMany({
          where: salesQuery,
          include: { payments: true },
        });

        // CRÍTICO: Buscar também pagamentos de mesas (TablePayment)
        const tablePayments = await this.prisma.tablePayment.findMany({
          where: tablePaymentsQuery,
        });

        // Combinar totais de vendas diretas + pagamentos de mesas
        const directTotalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const tableTotalSales = tablePayments.reduce((sum, tp) => sum + tp.amount, 0);
        const totalSales = directTotalSales + tableTotalSales;
        
        // Calcular pagamentos por método (case-insensitive) - CONSISTÊNCIA com getCurrentCashBoxForUser
        let cashPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => (p.method || '').toLowerCase() === 'cash')
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        let mobileMoneyPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => {
              const method = (p.method || '').toLowerCase();
              return method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile';
            })
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        let cardPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => {
              const method = (p.method || '').toLowerCase();
              return method === 'card' || method === 'mixed';
            })
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        let debtPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => {
              const method = (p.method || '').toLowerCase();
              return method === 'debt' || method === 'vale';
            })
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        // CRÍTICO: Adicionar pagamentos de mesas aos totais por método
        for (const tp of tablePayments) {
          const method = (tp.method || '').toLowerCase();
          if (method === 'cash') {
            cashPayments += tp.amount;
          } else if (method === 'vale' || method === 'debt') {
            debtPayments += tp.amount;
          } else if (method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile') {
            mobileMoneyPayments += tp.amount;
          } else if (method === 'card' || method === 'mixed') {
            cardPayments += tp.amount;
          }
        }

        return {
          ...cashBox,
          stats: {
            totalSales,
            cashPayments,
            mobileMoneyPayments,
            cardPayments,
            debtPayments,
            totalCashOut: 0, // Saídas de caixa (não implementado ainda)
            currentAmount: cashBox.openingCash + cashPayments,
            salesCount: sales.length,
          },
        };
      })
    );

    return enrichedCashBoxes;
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
    // Primeiro, tentar encontrar o caixa aberto pelo usuário
    let cashBox = await this.prisma.cashBox.findFirst({
      where: {
        openedBy: userId,
        status: 'open',
      },
      include: {
        openedByUser: true,
        branch: true,
      },
    });

    // Se não encontrou, buscar qualquer caixa aberto (para visualização)
    if (!cashBox) {
      cashBox = await this.prisma.cashBox.findFirst({
        where: {
          status: 'open',
        },
        include: {
          openedByUser: true,
          branch: true,
        },
        orderBy: { openedAt: 'desc' }, // Mais recente primeiro
      });
    }

    if (!cashBox) {
      return null;
    }

    // Buscar vendas do período (vendas diretas)
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId: cashBox.branchId,
        openedAt: { gte: cashBox.openedAt },
      },
      include: {
        payments: true,
      },
    });

    // CRÍTICO: Buscar apenas pagamentos de mesas (TablePayment) que NÃO têm Payment vinculado
    // Se paymentId != null, significa que já existe um Payment contabilizado na Sale
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null, // ⚠️ CRÍTICO: Evita contar TablePayment que já tem Payment
      },
    });

    // Totais de vendas diretas
    const directTotalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    
    // Totais de mesas (TablePayment)
    const tableTotalSales = tablePayments.reduce((sum, tp) => sum + tp.amount, 0);
    
    // Total geral
    const totalSales = directTotalSales + tableTotalSales;
    
    // Calcular pagamentos por método - VENDAS DIRETAS
    let cashPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => (p.method || '').toLowerCase() === 'cash')
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    let mobileMoneyPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => {
          const method = (p.method || '').toLowerCase();
          return method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile';
        })
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    let cardPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => {
          const method = (p.method || '').toLowerCase();
          return method === 'card' || method === 'mixed';
        })
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);

    let debtPayments = sales.reduce((sum, sale) => {
      const amount = sale.payments
        .filter(p => {
          const method = (p.method || '').toLowerCase();
          return method === 'debt' || method === 'vale';
        })
        .reduce((s, p) => s + p.amount, 0);
      return sum + amount;
    }, 0);
    
    // CRÍTICO: Adicionar pagamentos de mesas aos totais por método
    for (const tp of tablePayments) {
      const method = (tp.method || '').toLowerCase();
      if (method === 'cash') {
        cashPayments += tp.amount;
      } else if (method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile') {
        mobileMoneyPayments += tp.amount;
      } else if (method === 'card' || method === 'mixed') {
        cardPayments += tp.amount;
      } else if (method === 'debt' || method === 'vale') {
        debtPayments += tp.amount;
      }
    }

    return {
      ...cashBox,
      stats: {
        totalSales,
        cashPayments,
        mobileMoneyPayments,
        cardPayments,
        debtPayments,
        totalCashOut: 0, // Saídas de caixa (não implementado ainda, mas necessário para consistência)
        currentAmount: cashBox.openingCash + cashPayments,
        salesCount: sales.length,
      },
    };
  }

  async getHistoryAll(limit = 30) {
    const cashBoxes = await this.prisma.cashBox.findMany({
      where: {
        status: 'closed', // Apenas caixas fechados no histórico
      },
      include: {
        openedByUser: true,
        branch: true,
      },
      orderBy: { closedAt: 'desc' }, // Ordenar por fechamento
      take: limit,
    });

    // Para cada caixa, calcular estatísticas
    const enrichedCashBoxes = await Promise.all(
      cashBoxes.map(async (cashBox) => {
        // Buscar vendas do período desse caixa
        const salesQuery: any = {
          branchId: cashBox.branchId,
          openedAt: { gte: cashBox.openedAt },
        };
        
        // Query para TablePayments - APENAS os que NÃO têm Payment vinculado (evita duplicação)
        const tablePaymentsQuery: any = {
          processedAt: { gte: cashBox.openedAt },
          session: { branchId: cashBox.branchId },
          paymentId: null, // ⚠️ CRÍTICO: Evita contar TablePayment que já tem Payment
        };
        
        // Se o caixa está fechado, limitar até a data de fechamento
        if (cashBox.closedAt) {
          salesQuery.openedAt = {
            gte: cashBox.openedAt,
            lte: cashBox.closedAt,
          };
          tablePaymentsQuery.processedAt = {
            gte: cashBox.openedAt,
            lte: cashBox.closedAt,
          };
        }

        const sales = await this.prisma.sale.findMany({
          where: salesQuery,
          include: { payments: true },
        });

        // CRÍTICO: Buscar também pagamentos de mesas (TablePayment)
        const tablePayments = await this.prisma.tablePayment.findMany({
          where: tablePaymentsQuery,
        });

        // Combinar totais de vendas diretas + pagamentos de mesas
        const directTotalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const tableTotalSales = tablePayments.reduce((sum, tp) => sum + tp.amount, 0);
        const totalSales = directTotalSales + tableTotalSales;
        
        // Calcular pagamentos por método (case-insensitive)
        let cashPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => (p.method || '').toLowerCase() === 'cash')
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        let mobileMoneyPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => {
              const method = (p.method || '').toLowerCase();
              return method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile';
            })
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        let cardPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => {
              const method = (p.method || '').toLowerCase();
              return method === 'card' || method === 'mixed';
            })
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        let debtPayments = sales.reduce((sum, sale) => {
          const amount = sale.payments
            .filter(p => {
              const method = (p.method || '').toLowerCase();
              return method === 'debt' || method === 'vale';
            })
            .reduce((s, p) => s + p.amount, 0);
          return sum + amount;
        }, 0);

        // CRÍTICO: Adicionar pagamentos de mesas aos totais por método
        for (const tp of tablePayments) {
          const method = (tp.method || '').toLowerCase();
          if (method === 'cash') {
            cashPayments += tp.amount;
          } else if (method === 'vale' || method === 'debt') {
            debtPayments += tp.amount;
          } else if (method === 'orange' || method === 'orange_money' || method === 'teletaku' || method === 'mobile') {
            mobileMoneyPayments += tp.amount;
          } else if (method === 'card' || method === 'mixed') {
            cardPayments += tp.amount;
          }
        }

        return {
          ...cashBox,
          stats: {
            totalSales,
            cashPayments,
            mobileMoneyPayments,
            cardPayments,
            debtPayments,
            totalCashOut: 0, // Saídas de caixa (não implementado ainda)
            currentAmount: cashBox.openingCash + cashPayments,
            salesCount: sales.length,
          },
        };
      })
    );

    return enrichedCashBoxes;
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

    // 1. Buscar pagamentos das vendas de BALCÃO (PDV) durante o período do caixa
    // CRÍTICO: Excluir pagamentos VALE pois já são representados pelos Debts
    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: targetCashBox.openedAt },
        sale: { branchId: targetCashBox.branchId },
        NOT: {
          method: { in: ['VALE', 'vale', 'Vale'] },
        },
      },
      include: {
        sale: {
          select: {
            saleNumber: true,
            type: true,
            customer: { select: { fullName: true } },
            cashier: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 2. 🔴 CORREÇÃO CRÍTICA: Buscar pagamentos de MESA (TablePayment)
    // Vendas de mesa usam TablePayment ao invés de Payment
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        createdAt: { gte: targetCashBox.openedAt },
        session: {
          table: { branchId: targetCashBox.branchId },
        },
      },
      include: {
        session: {
          select: {
            table: { select: { number: true } },
          },
        },
        tableCustomer: {
          select: {
            customerName: true,
            customer: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 3. Buscar dívidas (vendas com Vale) criadas durante o período do caixa
    const debts = await this.prisma.debt.findMany({
      where: {
        createdAt: { gte: targetCashBox.openedAt },
        OR: [
          { branchId: targetCashBox.branchId },
          { sale: { branchId: targetCashBox.branchId } },
        ],
      },
      include: {
        sale: {
          select: {
            saleNumber: true,
            cashier: { select: { fullName: true } },
          },
        },
        customer: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Mapear pagamentos de balcão (PDV)
    const paymentMovements = payments.map(payment => {
      const method = (payment.method || '').toLowerCase();
      const isCashPayment = method === 'cash';
      
      return {
        id: payment.id,
        cashBoxId: targetCashBox!.id,
        movementType: isCashPayment ? 'cash_in' : method,
        amount: payment.amount,
        description: `Venda ${payment.sale?.saleNumber || ''}${
          payment.sale?.customer?.fullName ? ` - ${payment.sale.customer.fullName}` : ''
        }`,
        referenceType: 'sale',
        referenceId: payment.saleId,
        userId: null,
        userName: payment.sale?.cashier?.fullName || null,
        createdAt: payment.createdAt,
        saleType: payment.sale?.type || 'counter',
      };
    });

    // 🔴 CORREÇÃO: Mapear pagamentos de MESA
    const tablePaymentMovements = tablePayments.map(tp => {
      const method = (tp.method || '').toLowerCase();
      const isCashPayment = method === 'cash';
      const customerName = tp.tableCustomer?.customer?.fullName || tp.tableCustomer?.customerName || 'Cliente';
      const tableNumber = tp.session?.table?.number || '?';
      
      return {
        id: tp.id,
        cashBoxId: targetCashBox!.id,
        movementType: isCashPayment ? 'cash_in' : method,
        amount: tp.amount,
        description: `Mesa ${tableNumber} - ${customerName}`,
        referenceType: 'table_payment',
        referenceId: tp.sessionId,
        userId: null,
        userName: null,
        createdAt: tp.createdAt,
        saleType: 'table',
      };
    });

    // Mapear dívidas (Vale)
    const debtMovements = debts.map(debt => ({
      id: debt.id,
      cashBoxId: targetCashBox!.id,
      movementType: 'vale',
      amount: debt.originalAmount,
      description: `Venda ${debt.sale?.saleNumber || ''}${
        debt.customer?.fullName ? ` - ${debt.customer.fullName}` : ''
      }`,
      referenceType: 'debt',
      referenceId: debt.saleId,
      userId: null,
      userName: debt.sale?.cashier?.fullName || null,
      createdAt: debt.createdAt,
      saleType: 'counter',
    }));

    // 🔴 CORREÇÃO: Combinar TODOS os tipos de movimentação
    const allMovements = [...paymentMovements, ...tablePaymentMovements, ...debtMovements]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    console.log(`[CashBox] getMovements: ${paymentMovements.length} PDV, ${tablePaymentMovements.length} Mesas, ${debtMovements.length} Vale = ${allMovements.length} total`);

    return allMovements;
  }
}



