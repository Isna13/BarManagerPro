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

    // Calcular valor esperado baseado em vendas (PDV/Balcão)
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

    // Somar pagamentos em dinheiro de vendas diretas (PDV)
    let cashPayments = sales.reduce((sum, sale) => {
      const cashAmount = sale.payments
        .filter(p => (p.method || '').toLowerCase() === 'cash' && p.status === 'completed')
        .reduce((s, p) => s + p.amount, 0);
      return sum + cashAmount;
    }, 0);

    // 🔴 CORREÇÃO CRÍTICA: Incluir pagamentos de MESA em dinheiro
    // Buscar TablePayments com method='CASH' e paymentId=null (evita duplicação)
    const tablePaymentsCash = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null, // ⚠️ CRÍTICO: Evita duplicação
        method: { in: ['CASH', 'cash', 'Cash'] },
        status: 'completed',
      },
    });

    // Somar pagamentos de mesa em dinheiro
    const tableCashPayments = tablePaymentsCash.reduce((sum, tp) => sum + tp.amount, 0);
    cashPayments += tableCashPayments;

    console.log(`[CashBox] closeCashBox: PDV cash=${cashPayments - tableCashPayments}, Mesa cash=${tableCashPayments}, Total cash=${cashPayments}`);

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
    // Excluir VALE pois será buscado separadamente (Vale não conta como venda, é crédito)
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null, // ⚠️ APENAS pagamentos de mesa SEM Payment vinculado
        NOT: {
          method: { in: ['VALE', 'vale', 'Vale'] },
        },
      },
    });

    // Buscar VALE de mesas separadamente para contabilizar em debtPayments
    const tableValePayments = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null,
        method: { in: ['VALE', 'vale', 'Vale'] },
      },
    });
    const tableValeTotal = tableValePayments.reduce((sum, tp) => sum + tp.amount, 0);

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

    // Adicionar Vale de mesas ao debtPayments
    debtPayments += tableValeTotal;

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
        // CORREÇÃO: Excluir VALE pois já está contabilizado na Sale com paymentMethod='VALE'
        const tablePaymentsQuery: any = {
          processedAt: { gte: cashBox.openedAt },
          session: { branchId: cashBox.branchId },
          paymentId: null, // ⚠️ CRÍTICO: Evita contar TablePayment que já tem Payment
          NOT: {
            method: { in: ['VALE', 'vale', 'Vale'] },
          },
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

        // Buscar VALE de mesas separadamente para contabilizar em debtPayments
        // (VALE não cria Sale quando é de mesa, então precisa ser buscado separadamente)
        const tableValeQuery1 = {
          processedAt: tablePaymentsQuery.processedAt,
          session: tablePaymentsQuery.session,
          paymentId: null,
          method: { in: ['VALE', 'vale', 'Vale'] },
        };
        const tableValePayments1 = await this.prisma.tablePayment.findMany({
          where: tableValeQuery1,
        });
        const tableValeTotal1 = tableValePayments1.reduce((sum, tp) => sum + tp.amount, 0);

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

        // Adicionar VALE de mesas ao debtPayments
        debtPayments += tableValeTotal1;

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
    // CORREÇÃO: Excluir VALE pois já está contabilizado na Sale com paymentMethod='VALE'
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null, // ⚠️ CRÍTICO: Evita contar TablePayment que já tem Payment
        NOT: {
          method: { in: ['VALE', 'vale', 'Vale'] },
        },
      },
    });

    // Buscar VALE de mesas separadamente para contabilizar em debtPayments
    // (VALE não cria Sale quando é de mesa, então precisa ser buscado separadamente)
    const tableValePayments2 = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: { gte: cashBox.openedAt },
        session: { branchId: cashBox.branchId },
        paymentId: null,
        method: { in: ['VALE', 'vale', 'Vale'] },
      },
    });
    const tableValeTotal2 = tableValePayments2.reduce((sum, tp) => sum + tp.amount, 0);

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

    // Adicionar VALE de mesas ao debtPayments
    debtPayments += tableValeTotal2;

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
        // CORREÇÃO: Excluir VALE pois já está contabilizado na Sale com paymentMethod='VALE'
        const tablePaymentsQuery: any = {
          processedAt: { gte: cashBox.openedAt },
          session: { branchId: cashBox.branchId },
          paymentId: null, // ⚠️ CRÍTICO: Evita contar TablePayment que já tem Payment
          NOT: {
            method: { in: ['VALE', 'vale', 'Vale'] },
          },
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

        // Buscar VALE de mesas separadamente para contabilizar em debtPayments
        // (VALE não cria Sale quando é de mesa, então precisa ser buscado separadamente)
        const tableValeQuery3 = {
          processedAt: tablePaymentsQuery.processedAt,
          session: tablePaymentsQuery.session,
          paymentId: null,
          method: { in: ['VALE', 'vale', 'Vale'] },
        };
        const tableValePayments3 = await this.prisma.tablePayment.findMany({
          where: tableValeQuery3,
        });
        const tableValeTotal3 = tableValePayments3.reduce((sum, tp) => sum + tp.amount, 0);

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

        // Adicionar VALE de mesas ao debtPayments
        debtPayments += tableValeTotal3;

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

  /**
   * 🎯 ENDPOINT CRÍTICO: Detalhes completos do caixa (paridade com Electron)
   * Retorna todos os dados necessários para auditoria financeira:
   * - Lista de produtos vendidos com quantidade, valor, custo e lucro
   * - Totais consolidados (receita, custo, lucro bruto, margem)
   * - Dados do caixa (abertura, fechamento, diferença)
   * - Vales (crédito concedido)
   */
  async getCashBoxDetails(cashBoxId: string) {
    const cashBox = await this.prisma.cashBox.findUnique({
      where: { id: cashBoxId },
      include: {
        openedByUser: true,
        branch: true,
      },
    });

    if (!cashBox) {
      throw new NotFoundException('Caixa não encontrado');
    }

    // Definir período de análise
    const startDate = cashBox.openedAt;
    const endDate = cashBox.closedAt || new Date();

    // 1. Buscar todas as vendas do período
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId: cashBox.branchId,
        openedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        payments: true,
      },
    });

    // 2. Agrupar itens por produto (exatamente como o Electron faz)
    const productMap = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      qtySold: number;
      revenue: number;
      cost: number;
      profit: number;
    }>();

    for (const sale of sales) {
      for (const item of sale.items) {
        const key = item.productId;
        const existing = productMap.get(key) || {
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku || '',
          qtySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };

        existing.qtySold += item.qtyUnits;
        existing.revenue += item.total;
        existing.cost += item.unitCost * item.qtyUnits;
        existing.profit = existing.revenue - existing.cost;

        productMap.set(key, existing);
      }
    }

    // 3. Converter para array e calcular margens
    const salesItems = Array.from(productMap.values())
      .map(item => ({
        ...item,
        margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue); // Ordenar por receita DESC

    // 4. Calcular totais
    const totalRevenue = salesItems.reduce((sum, item) => sum + item.revenue, 0);
    const totalCOGS = salesItems.reduce((sum, item) => sum + item.cost, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // 5. Calcular totais por método de pagamento
    let cashPayments = 0;
    let mobileMoneyPayments = 0;
    let cardPayments = 0;
    let debtPayments = 0;

    for (const sale of sales) {
      for (const payment of sale.payments) {
        const method = (payment.method || '').toLowerCase();
        if (method === 'cash') {
          cashPayments += payment.amount;
        } else if (['orange', 'orange_money', 'teletaku', 'mobile'].includes(method)) {
          mobileMoneyPayments += payment.amount;
        } else if (['card', 'mixed'].includes(method)) {
          cardPayments += payment.amount;
        } else if (['vale', 'debt'].includes(method)) {
          debtPayments += payment.amount;
        }
      }
    }

    // 6. Buscar TablePayments do período (para vendas de mesa)
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        processedAt: {
          gte: startDate,
          lte: endDate,
        },
        session: { branchId: cashBox.branchId },
        paymentId: null, // Apenas os que não têm Payment vinculado
      },
    });

    for (const tp of tablePayments) {
      const method = (tp.method || '').toLowerCase();
      if (method === 'cash') {
        cashPayments += tp.amount;
      } else if (['orange', 'orange_money', 'teletaku', 'mobile'].includes(method)) {
        mobileMoneyPayments += tp.amount;
      } else if (['card', 'mixed'].includes(method)) {
        cardPayments += tp.amount;
      } else if (['vale', 'debt'].includes(method)) {
        debtPayments += tp.amount;
      }
    }

    // 7. Calcular lucro líquido (desconta vales pois são crédito)
    const netProfit = grossProfit - debtPayments;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 8. Retornar estrutura completa
    return {
      // Dados do caixa
      id: cashBox.id,
      boxNumber: cashBox.boxNumber,
      branchId: cashBox.branchId,
      status: cashBox.status,
      openedAt: cashBox.openedAt,
      closedAt: cashBox.closedAt,
      openingCash: cashBox.openingCash,
      closingCash: cashBox.closingCash,
      difference: cashBox.difference,
      notes: cashBox.notes,
      openedBy: cashBox.openedByUser?.fullName || 'Desconhecido',
      
      // Contagem de vendas
      salesCount: sales.length,
      
      // Totais por método de pagamento
      totalSales: totalRevenue,
      totalCash: cashPayments,
      totalMobileMoney: mobileMoneyPayments,
      totalCard: cardPayments,
      totalDebt: debtPayments,
      
      // 🎯 Métricas de lucro (PARIDADE COM ELECTRON)
      profitMetrics: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        profitMargin: Math.round(profitMargin * 100) / 100,
        netProfit,
        netMargin: Math.round(netMargin * 100) / 100,
        salesItems,
      },
    };
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
    // CRÍTICO: Excluir pagamentos VALE pois já são representados pelos Debts
    const tablePayments = await this.prisma.tablePayment.findMany({
      where: {
        createdAt: { gte: targetCashBox.openedAt },
        session: {
          table: { branchId: targetCashBox.branchId },
        },
        NOT: {
          method: { in: ['VALE', 'vale', 'Vale'] },
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



