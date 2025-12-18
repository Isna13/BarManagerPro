import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto, UpdateTableDto } from './dto';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateTableDto) {
    // Verificar se já existe mesa com mesmo número na mesma filial
    const existing = await this.prisma.table.findFirst({
      where: {
        branchId: createDto.branchId,
        number: createDto.number,
      },
    });

    if (existing) {
      // Se já existe, retornar a existente (idempotência para sync)
      console.log(`Mesa ${createDto.number} já existe na filial ${createDto.branchId}, retornando existente`);
      return existing;
    }

    // Se o ID foi fornecido (sync do desktop), usar ele
    const data: any = {
      branchId: createDto.branchId,
      number: createDto.number,
      seats: createDto.seats || 4,
      area: createDto.area,
      qrCode: createDto.qrCode,
      isActive: createDto.isActive ?? true,
    };

    if (createDto.id) {
      data.id = createDto.id;
    }

    return this.prisma.table.create({
      data,
    });
  }

  async findAll(branchId?: string) {
    const where: any = { isActive: true };
    
    if (branchId) {
      where.branchId = branchId;
    }

    const tables = await this.prisma.table.findMany({
      where,
      orderBy: { number: 'asc' },
    });

    // Incluir sessão ativa para cada mesa
    const result = [];
    for (const table of tables) {
      const activeSession = await this.prisma.tableSession.findFirst({
        where: { tableId: table.id, status: 'open' },
      });

      result.push({
        ...table,
        status: activeSession ? 'occupied' : 'available',
        currentSession: activeSession,
      });
    }

    return result;
  }

  async findOne(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return table;
  }

  async update(id: string, updateDto: UpdateTableDto) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return this.prisma.table.update({
      where: { id },
      data: updateDto,
    });
  }

  /**
   * Lista todas as sessões de mesa
   * Usado para sincronização Electron ↔ Railway ↔ Mobile
   */
  async findAllSessions(branchId?: string, status?: string, updatedAfter?: string) {
    const where: any = {};
    
    if (branchId) {
      where.branchId = branchId;
    }
    
    if (status) {
      where.status = status;
    }
    
    // Suporte para sincronização delta
    if (updatedAfter) {
      where.updatedAt = { gte: new Date(updatedAfter) };
    }
    
    return this.prisma.tableSession.findMany({
      where,
      include: {
        table: true,
        customers: {
          include: {
            customer: true,
            orders: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 100, // Limitar para evitar payload muito grande
    });
  }

  async remove(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    // Verificar se há vendas ativas nesta mesa
    const activeSales = await this.prisma.sale.findFirst({
      where: {
        tableId: id,
        status: { not: 'closed' },
      },
    });

    if (activeSales) {
      throw new BadRequestException('Não é possível remover mesa com vendas ativas');
    }

    // Soft delete - apenas desativar
    return this.prisma.table.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getTableStatus(id: string) {
    const table = await this.findOne(id);

    // Buscar sessão ativa na mesa
    const activeSession = await this.prisma.tableSession.findFirst({
      where: {
        tableId: id,
        status: 'open',
      },
      include: {
        customers: {
          include: {
            orders: true,
          },
        },
      },
    });

    return {
      ...table,
      status: activeSession ? 'occupied' : 'available',
      currentSession: activeSession,
    };
  }

  // ==================== OVERVIEW ====================

  async getTablesOverview(branchId: string) {
    const tables = await this.prisma.table.findMany({
      where: { branchId, isActive: true },
      orderBy: { number: 'asc' },
    });

    const result = [];
    for (const table of tables) {
      const activeSession = await this.prisma.tableSession.findFirst({
        where: { tableId: table.id, status: 'open' },
        include: {
          customers: {
            include: {
              orders: {
                where: { status: { not: 'cancelled' } },
              },
            },
          },
        },
      });

      result.push({
        ...table,
        status: activeSession ? 'occupied' : 'available',
        currentSession: activeSession,
      });
    }

    return result;
  }

  // ==================== SESSÕES ====================

  async openSession(
    tableId: string,
    branchId: string,
    openedBy: string,
    sessionId?: string,
  ) {
    // Verificar se a mesa existe
    const table = await this.findOne(tableId);

    // Se o ID foi fornecido e a sessão já existe, retornar (idempotência para sync)
    if (sessionId) {
      const existingById = await this.prisma.tableSession.findUnique({
        where: { id: sessionId },
      });
      if (existingById) {
        return existingById;
      }
    }

    // Verificar se já tem sessão aberta
    const existingSession = await this.prisma.tableSession.findFirst({
      where: { tableId, status: 'open' },
    });

    if (existingSession) {
      // Idempotência: para sync/offline, se já existe sessão aberta nesta mesa,
      // retornar a sessão existente em vez de falhar.
      return existingSession;
    }

    const sessionNumber = `S${Date.now()}`;
    
    const data: any = {
      tableId,
      branchId,
      sessionNumber,
      openedBy,
      status: 'open',
      openedAt: new Date(),
    };

    if (sessionId) {
      data.id = sessionId;
    }

    const session = await this.prisma.tableSession.create({ data });

    // Registrar ação
    await this.logAction(session.id, 'OPEN_SESSION', openedBy, 'Sessão aberta');

    return session;
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        customers: {
          include: {
            orders: {
              where: { status: { not: 'cancelled' } },
              include: { product: true },
            },
            payments: true,
          },
        },
        payments: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }

    return session;
  }

  async closeSession(sessionId: string, closedBy: string) {
    const session = await this.getSession(sessionId);

    // Verificar se todo o valor foi pago
    if (session.paidAmount < session.totalAmount) {
      throw new BadRequestException('Há valores pendentes de pagamento');
    }

    const updated = await this.prisma.tableSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedBy,
        closedAt: new Date(),
      },
    });

    // Registrar ação
    await this.logAction(sessionId, 'CLOSE_SESSION', closedBy, 'Sessão fechada');

    return updated;
  }

  async transferSession(sessionId: string, toTableId: string, transferredBy: string) {
    const session = await this.getSession(sessionId);
    const toTable = await this.findOne(toTableId);

    // Verificar se mesa destino tem sessão aberta
    const existingSession = await this.prisma.tableSession.findFirst({
      where: { tableId: toTableId, status: 'open' },
    });

    if (existingSession) {
      throw new BadRequestException('Mesa destino já possui sessão aberta');
    }

    const updated = await this.prisma.tableSession.update({
      where: { id: sessionId },
      data: { tableId: toTableId },
    });

    // Registrar ação
    await this.logAction(sessionId, 'TRANSFER_TABLE', transferredBy, 
      `Mesa transferida de ${session.table.number} para ${toTable.number}`);

    return updated;
  }

  async transferCustomers(sessionId: string, customerIds: string[], toTableId: string, transferredBy: string) {
    const session = await this.getSession(sessionId);
    
    // Verificar ou criar sessão na mesa destino
    let targetSession = await this.prisma.tableSession.findFirst({
      where: { tableId: toTableId, status: 'open' },
    });

    if (!targetSession) {
      targetSession = await this.openSession(toTableId, session.branchId, transferredBy);
    }

    // Transferir clientes e seus pedidos
    for (const customerId of customerIds) {
      const customer = await this.prisma.tableCustomer.findUnique({
        where: { id: customerId },
        include: { orders: true },
      });

      if (customer) {
        // Atualizar sessão do cliente
        await this.prisma.tableCustomer.update({
          where: { id: customerId },
          data: { sessionId: targetSession.id },
        });

        // Atualizar sessão dos pedidos
        await this.prisma.tableOrder.updateMany({
          where: { tableCustomerId: customerId },
          data: { sessionId: targetSession.id },
        });

        // Atualizar totais das sessões
        await this.recalculateSessionTotals(sessionId);
        await this.recalculateSessionTotals(targetSession.id);
      }
    }

    // Registrar ação
    await this.logAction(sessionId, 'TRANSFER_CUSTOMERS', transferredBy, 
      `${customerIds.length} cliente(s) transferido(s)`);

    return targetSession;
  }

  async mergeSessions(sessionIds: string[], targetTableId: string, mergedBy: string) {
    // Verificar ou criar sessão na mesa destino
    let targetSession = await this.prisma.tableSession.findFirst({
      where: { tableId: targetTableId, status: 'open' },
    });

    const firstSession = await this.getSession(sessionIds[0]);

    if (!targetSession) {
      targetSession = await this.openSession(targetTableId, firstSession.branchId, mergedBy);
    }

    for (const sessionId of sessionIds) {
      if (sessionId === targetSession.id) continue;

      const session = await this.getSession(sessionId);
      
      // Mover todos os clientes para a sessão destino
      await this.prisma.tableCustomer.updateMany({
        where: { sessionId },
        data: { sessionId: targetSession.id },
      });

      // Mover todos os pedidos
      await this.prisma.tableOrder.updateMany({
        where: { sessionId },
        data: { sessionId: targetSession.id },
      });

      // Mover pagamentos
      await this.prisma.tablePayment.updateMany({
        where: { sessionId },
        data: { sessionId: targetSession.id },
      });

      // Fechar sessão original
      await this.prisma.tableSession.update({
        where: { id: sessionId },
        data: { status: 'merged', closedAt: new Date(), closedBy: mergedBy },
      });
    }

    // Recalcular totais
    await this.recalculateSessionTotals(targetSession.id);

    // Registrar ação
    await this.logAction(targetSession.id, 'MERGE_TABLES', mergedBy, 
      `${sessionIds.length} mesa(s) unida(s)`);

    return this.getSession(targetSession.id);
  }

  async splitSession(sessionId: string, distributions: { customerId: string; targetTableId: string }[], splitBy: string) {
    const session = await this.getSession(sessionId);

    for (const dist of distributions) {
      // Verificar ou criar sessão na mesa destino
      let targetSession = await this.prisma.tableSession.findFirst({
        where: { tableId: dist.targetTableId, status: 'open' },
      });

      if (!targetSession) {
        targetSession = await this.openSession(dist.targetTableId, session.branchId, splitBy);
      }

      // Mover cliente
      await this.prisma.tableCustomer.update({
        where: { id: dist.customerId },
        data: { sessionId: targetSession.id },
      });

      // Mover pedidos do cliente
      await this.prisma.tableOrder.updateMany({
        where: { tableCustomerId: dist.customerId },
        data: { sessionId: targetSession.id },
      });

      await this.recalculateSessionTotals(targetSession.id);
    }

    // Recalcular totais da sessão original
    await this.recalculateSessionTotals(sessionId);

    // Registrar ação
    await this.logAction(sessionId, 'SPLIT_TABLE', splitBy, 
      `Mesa dividida em ${distributions.length} destinos`);

    return this.getSession(sessionId);
  }

  async getSessionHistory(sessionId: string) {
    return this.prisma.tableAction.findMany({
      where: { sessionId },
      orderBy: { performedAt: 'desc' },
    });
  }

  // ==================== CLIENTES ====================

  async addCustomer(
    sessionId: string,
    customerName: string,
    customerId: string | undefined,
    addedBy: string,
    tableCustomerId?: string,
  ) {
    const session = await this.getSession(sessionId);

    // Se o ID foi fornecido e já existe, retornar (idempotência para sync)
    if (tableCustomerId) {
      const existingById = await this.prisma.tableCustomer.findUnique({
        where: { id: tableCustomerId },
      });
      if (existingById) {
        return existingById;
      }
    }

    const data: any = {
      sessionId,
      customerName,
      customerId,
      orderSequence: session.customers.length + 1,
    };

    if (tableCustomerId) {
      data.id = tableCustomerId;
    }

    const customer = await this.prisma.tableCustomer.create({ data });

    // Registrar ação
    await this.logAction(sessionId, 'ADD_CUSTOMER', addedBy, `Cliente "${customerName}" adicionado`);

    return customer;
  }

  // ==================== PEDIDOS ====================

  async addOrder(
    sessionId: string, 
    tableCustomerId: string, 
    productId: string, 
    qtyUnits: number, 
    isMuntu: boolean, 
    orderedBy: string,
    orderId?: string,
  ) {
    // Idempotência: se o ID foi fornecido e já existe, retornar
    if (orderId) {
      const existingById = await this.prisma.tableOrder.findUnique({
        where: { id: orderId },
        include: { product: true },
      });
      if (existingById) {
        return existingById;
      }
    }

    // Validar sessão / cliente para evitar erro 500 por constraint
    await this.getSession(sessionId);
    const tableCustomer = await this.prisma.tableCustomer.findUnique({
      where: { id: tableCustomerId },
    });
    if (!tableCustomer) {
      throw new NotFoundException('Cliente da mesa não encontrado');
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    let unitPrice = product.priceUnit;
    let total = unitPrice * qtyUnits;

    // Calcular preço Muntu se aplicável
    if (isMuntu && product.isMuntuEligible && product.muntuQuantity && product.muntuPrice) {
      const sets = Math.floor(qtyUnits / product.muntuQuantity);
      const remainder = qtyUnits % product.muntuQuantity;
      total = (sets * product.muntuPrice) + (remainder * product.priceUnit);
    }

    const orderData: any = {
      sessionId,
      tableCustomerId,
      productId,
      qtyUnits,
      isMuntu,
      unitPrice,
      unitCost: product.costUnit,
      subtotal: total,
      total,
      orderedBy,
      orderedAt: new Date(),
    };

    if (orderId) {
      orderData.id = orderId;
    }

    const order = await this.prisma.tableOrder.create({
      data: orderData,
      include: { product: true },
    });

    // Atualizar total do cliente
    await this.recalculateCustomerTotals(tableCustomerId);

    // Atualizar total da sessão
    await this.recalculateSessionTotals(sessionId);

    // Registrar ação
    await this.logAction(sessionId, 'ADD_ORDER', orderedBy, 
      `Pedido: ${qtyUnits}x ${product.name}`);

    // Baixar estoque
    await this.adjustStock(productId, -qtyUnits, 'Pedido de mesa');

    return order;
  }

  async cancelOrder(orderId: string, cancelledBy: string) {
    const order = await this.prisma.tableOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (order.status === 'paid') {
      throw new BadRequestException('Não é possível cancelar pedido já pago');
    }

    const updated = await this.prisma.tableOrder.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        cancelledBy,
        cancelledAt: new Date(),
      },
    });

    // Recalcular totais
    await this.recalculateCustomerTotals(order.tableCustomerId);
    await this.recalculateSessionTotals(order.sessionId);

    // Estornar estoque
    await this.adjustStock(order.productId, order.qtyUnits, 'Cancelamento de pedido');

    // Registrar ação
    await this.logAction(order.sessionId, 'CANCEL_ORDER', cancelledBy, 
      `Pedido cancelado: ${order.qtyUnits}x ${order.product.name}`);

    return updated;
  }

  async transferOrder(
    orderId: string, 
    fromCustomerId: string, 
    toCustomerId: string, 
    qtyUnits: number, 
    transferredBy: string
  ) {
    const order = await this.prisma.tableOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (qtyUnits >= order.qtyUnits) {
      // Transferir pedido inteiro
      await this.prisma.tableOrder.update({
        where: { id: orderId },
        data: { tableCustomerId: toCustomerId },
      });
    } else {
      // Dividir pedido
      await this.prisma.tableOrder.update({
        where: { id: orderId },
        data: { 
          qtyUnits: order.qtyUnits - qtyUnits,
          subtotal: order.unitPrice * (order.qtyUnits - qtyUnits),
          total: order.unitPrice * (order.qtyUnits - qtyUnits),
        },
      });

      // Criar novo pedido para o destino
      await this.prisma.tableOrder.create({
        data: {
          sessionId: order.sessionId,
          tableCustomerId: toCustomerId,
          productId: order.productId,
          qtyUnits,
          isMuntu: order.isMuntu,
          unitPrice: order.unitPrice,
          unitCost: order.unitCost,
          subtotal: order.unitPrice * qtyUnits,
          total: order.unitPrice * qtyUnits,
          orderedBy: transferredBy,
          orderedAt: new Date(),
        },
      });
    }

    // Recalcular totais
    await this.recalculateCustomerTotals(fromCustomerId);
    await this.recalculateCustomerTotals(toCustomerId);
    await this.recalculateSessionTotals(order.sessionId);

    // Registrar ação
    await this.logAction(order.sessionId, 'TRANSFER_ORDER', transferredBy, 
      `${qtyUnits}x ${order.product.name} transferido`);

    return { success: true };
  }

  // ==================== PAGAMENTOS ====================

  async processPayment(
    sessionId: string, 
    tableCustomerId: string | null, 
    method: string, 
    amount: number, 
    processedBy: string,
    isSessionPayment: boolean
  ) {
    const payment = await this.prisma.tablePayment.create({
      data: {
        sessionId,
        tableCustomerId,
        method,
        amount,
        processedBy,
        processedAt: new Date(),
      },
    });

    if (isSessionPayment) {
      // Pagamento da sessão inteira
      await this.prisma.tableSession.update({
        where: { id: sessionId },
        data: { paidAmount: { increment: amount } },
      });
    } else if (tableCustomerId) {
      // Pagamento de cliente específico
      const customer = await this.prisma.tableCustomer.findUnique({
        where: { id: tableCustomerId },
      });

      if (customer) {
        const newPaid = customer.paidAmount + amount;
        await this.prisma.tableCustomer.update({
          where: { id: tableCustomerId },
          data: { 
            paidAmount: newPaid,
            paymentStatus: newPaid >= customer.total ? 'paid' : 'partial',
          },
        });

        // Se pagou tudo, marcar pedidos como pagos
        if (newPaid >= customer.total) {
          await this.prisma.tableOrder.updateMany({
            where: { tableCustomerId, status: 'pending' },
            data: { status: 'paid' },
          });
        }
      }

      // Atualizar total pago da sessão
      await this.prisma.tableSession.update({
        where: { id: sessionId },
        data: { paidAmount: { increment: amount } },
      });
    }

    // Registrar ação
    await this.logAction(sessionId, 'PAYMENT', processedBy, 
      `Pagamento ${method}: ${amount / 100} FCFA`);

    return payment;
  }

  async clearPaidOrders(sessionId: string, tableCustomerId: string, clearedBy: string) {
    // Apenas marca os pedidos pagos como "cleared" (histórico)
    await this.prisma.tableOrder.updateMany({
      where: { 
        sessionId, 
        tableCustomerId, 
        status: 'paid' 
      },
      data: { status: 'cleared' },
    });

    // Registrar ação
    await this.logAction(sessionId, 'CLEAR_ORDERS', clearedBy, 'Pedidos pagos limpos');

    return { success: true };
  }

  // ==================== HELPERS ====================

  private async recalculateCustomerTotals(customerId: string) {
    const orders = await this.prisma.tableOrder.findMany({
      where: { tableCustomerId: customerId, status: { not: 'cancelled' } },
    });

    const subtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const total = orders.reduce((sum, o) => sum + o.total, 0);

    await this.prisma.tableCustomer.update({
      where: { id: customerId },
      data: { subtotal, total },
    });
  }

  private async recalculateSessionTotals(sessionId: string) {
    const customers = await this.prisma.tableCustomer.findMany({
      where: { sessionId },
    });

    const totalAmount = customers.reduce((sum, c) => sum + c.total, 0);
    const paidAmount = customers.reduce((sum, c) => sum + c.paidAmount, 0);

    await this.prisma.tableSession.update({
      where: { id: sessionId },
      data: { totalAmount, paidAmount },
    });
  }

  private async logAction(sessionId: string, actionType: string, performedBy: string, description: string) {
    await this.prisma.tableAction.create({
      data: {
        sessionId,
        actionType,
        performedBy,
        description,
        performedAt: new Date(),
      },
    });
  }

  private async adjustStock(productId: string, adjustment: number, reason: string) {
    try {
      // Usar InventoryItem em vez de Inventory (tabela correta para estoque)
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: { productId },
      });

      if (inventoryItem) {
        const quantityBefore = inventoryItem.qtyUnits;
        const quantityAfter = quantityBefore + adjustment;
        
        await this.prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { qtyUnits: { increment: adjustment } },
        });

        await this.prisma.stockMovement.create({
          data: {
            productId,
            branchId: inventoryItem.branchId,
            movementType: adjustment > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(adjustment),
            quantityBefore,
            quantityAfter,
            reason,
            responsible: 'system',
          },
        });
      }
    } catch (e) {
      console.error('Erro ao ajustar estoque:', e);
    }
  }
}
