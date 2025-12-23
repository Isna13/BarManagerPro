import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, AddSaleItemDto, ProcessPaymentDto } from './dto';
import { normalizePaymentMethod, tryNormalizePaymentMethod, isValidPaymentMethod } from '../shared/payment-methods';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(createSaleDto: CreateSaleDto, userId: string) {
    try {
      console.log('📝 Criando venda:', JSON.stringify(createSaleDto));
      console.log('   userId:', userId);
      
      // Se um ID foi fornecido (sincronização do desktop), verificar se já existe
      if (createSaleDto.id) {
        const existing = await this.prisma.sale.findUnique({
          where: { id: createSaleDto.id },
          include: {
            items: { include: { product: true } },
            table: true,
            customer: true,
            cashier: true,
          },
        });
        if (existing) {
          console.log('⚠️ Venda já existe, retornando existente:', existing.id);
          return existing;
        }
      }
      
      // Gerar número sequencial da venda
      const lastSale = await this.prisma.sale.findFirst({
        where: { branchId: createSaleDto.branchId },
        orderBy: { createdAt: 'desc' },
      });

      const saleNumber = this.generateSaleNumber(lastSale?.saleNumber);
      console.log('   saleNumber gerado:', saleNumber);

      // Construir data object apenas com campos válidos
      const saleData: any = {
        saleNumber: createSaleDto.saleNumber || saleNumber,
        branchId: createSaleDto.branchId,
        type: createSaleDto.type || 'counter',
        cashierId: userId,
        status: createSaleDto.status || 'open',
      };

      // Usar ID fornecido (para sincronização) ou deixar o Prisma gerar
      if (createSaleDto.id) {
        saleData.id = createSaleDto.id;
      }

      // Adicionar campos opcionais apenas se existirem
      if (createSaleDto.tableId) {
        saleData.tableId = createSaleDto.tableId;
      }
      if (createSaleDto.customerId) {
        saleData.customerId = createSaleDto.customerId;
      }
      // Nome do cliente para vendas sem cadastro (ex: vendas de mesa)
      if (createSaleDto.customerName) {
        saleData.customerName = createSaleDto.customerName;
      }
      // Valores (para sincronização de vendas já completas)
      if (createSaleDto.subtotal !== undefined) {
        saleData.subtotal = createSaleDto.subtotal;
      }
      if (createSaleDto.total !== undefined) {
        saleData.total = createSaleDto.total;
      }
      if (createSaleDto.discountTotal !== undefined) {
        saleData.discountTotal = createSaleDto.discountTotal;
      }
      if (createSaleDto.notes) {
        saleData.notes = createSaleDto.notes;
      }
      // Salvar método de pagamento se fornecido (importante para vendas sincronizadas)
      if (createSaleDto.paymentMethod) {
        try {
          const normalizedMethod = normalizePaymentMethod(createSaleDto.paymentMethod);
          saleData.paymentMethod = normalizedMethod;
          console.log(`   paymentMethod normalizado: ${createSaleDto.paymentMethod} -> ${normalizedMethod}`);
        } catch (e) {
          console.warn(`   ⚠️ Método de pagamento inválido ignorado: ${createSaleDto.paymentMethod}`);
        }
      }
      // Se status é paid ou closed, definir closedAt
      if (createSaleDto.status === 'paid' || createSaleDto.status === 'closed') {
        saleData.closedAt = new Date();
      }

      console.log('   saleData:', JSON.stringify(saleData));

      const result = await this.prisma.sale.create({
        data: saleData,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          table: true,
          customer: true,
          cashier: true,
        },
      });
      
      console.log('✅ Venda criada:', result.id);

      // 🔴 CORREÇÃO CRÍTICA: Criar dívida automaticamente para vendas VALE sincronizadas
      // Esta lógica garante que vendas VALE do Mobile/Desktop gerem dívidas no Railway
      if (saleData.paymentMethod === 'VALE' && saleData.customerId && result.total > 0) {
        try {
          // Verificar se já existe dívida para esta venda (evitar duplicação)
          const existingDebt = await this.prisma.debt.findFirst({
            where: { saleId: result.id },
          });

          if (!existingDebt) {
            const debt = await this.prisma.debt.create({
              data: {
                debtNumber: `DEBT-${Date.now()}`,
                customer: { connect: { id: saleData.customerId } },
                sale: { connect: { id: result.id } },
                branch: { connect: { id: saleData.branchId } },
                createdByUser: { connect: { id: userId } },
                originalAmount: result.total,
                amount: result.total,
                paidAmount: 0,
                balance: result.total,
                status: 'pending',
              },
            });
            console.log(`✅ Dívida criada automaticamente: ${debt.id} para venda VALE ${result.id}`);

            // Atualizar dívida total do cliente
            await this.prisma.customer.update({
              where: { id: saleData.customerId },
              data: {
                currentDebt: {
                  increment: result.total,
                },
              },
            });
            console.log(`   ✅ currentDebt do cliente atualizado (+${result.total})`);
          } else {
            console.log(`   ⚠️ Dívida já existe para venda ${result.id}: ${existingDebt.id}`);
          }
        } catch (debtError: any) {
          console.error(`   ❌ Erro ao criar dívida para venda VALE: ${debtError.message}`);
          // Não falhar a venda por erro na dívida, apenas logar
        }
      }

      return result;
    } catch (error: any) {
      console.error('❌ Erro ao criar venda:', error.message);
      console.error('   Stack:', error.stack);
      console.error('   Code:', error.code);
      console.error('   Meta:', error.meta);
      
      // 🔴 CORREÇÃO: Retornar erro adequado para cada tipo de problema
      if (error.code === 'P2002') {
        // Unique constraint violation
        const target = (error.meta?.target as string[])?.join(', ') || 'campo';
        throw new ConflictException(`Venda duplicada: ${target} já existe`);
      }
      if (error.code === 'P2025') {
        // Record not found (foreign key violation)
        throw new BadRequestException(`Referência inválida: ${error.meta?.cause || 'registro relacionado não encontrado'}`);
      }
      if (error.code === 'P2003') {
        // Foreign key constraint failed
        throw new BadRequestException(`Referência inválida: ${error.meta?.field_name || 'chave estrangeira inválida'}`);
      }
      
      throw new InternalServerErrorException(`Erro ao criar venda: ${error.message}`);
    }
  }

  async addItem(saleId: string, addItemDto: AddSaleItemDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    // Para vendas já pagas/fechadas (sincronizadas do desktop), verificar se o item já existe
    // Se a venda está fechada e já tem itens, significa que já foi sincronizada
    if (sale.status !== 'open') {
      // Verificar se o item já existe na venda (evitar duplicação)
      const existingItem = sale.items.find(
        item => item.productId === addItemDto.productId && item.qtyUnits === addItemDto.qtyUnits
      );
      if (existingItem) {
        console.log(`⚠️ Item já existe na venda ${saleId}, pulando...`);
        return existingItem;
      }
      // Se não existe, permitir adicionar (sincronização do desktop)
      console.log(`📝 Adicionando item à venda já fechada ${saleId} (sync do desktop)`);
    }

    const product = await this.prisma.product.findUnique({
      where: { id: addItemDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Calcular preços
    const isMuntu = addItemDto.isMuntu || false;
    const qtyUnits = addItemDto.qtyUnits;
    
    // Se Muntu, usar preço da caixa convertido; senão preço unitário
    const unitPrice = isMuntu && product.priceBox
      ? Math.floor(product.priceBox / product.unitsPerBox)
      : product.priceUnit;

    // Economia Muntu
    const muntuSavings = isMuntu
      ? (product.priceUnit - unitPrice) * qtyUnits
      : 0;

    const subtotal = qtyUnits * unitPrice;
    const tax = Math.floor(subtotal * (Number(product.taxRate) / 100));
    const total = subtotal + tax;

    const saleItem = await this.prisma.saleItem.create({
      data: {
        sale: { connect: { id: saleId } },
        product: { connect: { id: product.id } },
        qtyUnits,
        isMuntu,
        unitPrice,
        unitCost: product.costUnit || 0,
        subtotal,
        tax,
        taxAmount: tax,
        total,
        muntuSavings,
      },
      include: {
        product: true,
      },
    });

    // Atualizar totais da venda
    await this.updateSaleTotals(saleId);

    // Deduzir estoque APENAS para vendas abertas (não para vendas sincronizadas do desktop)
    // Vendas já pagas/fechadas vindas do desktop já tiveram o estoque deduzido localmente
    if (product.trackInventory && sale.status === 'open') {
      await this.deductInventory(product.id, sale.branchId, qtyUnits, saleId);
    }

    return saleItem;
  }

  async removeItem(saleItemId: string) {
    const item = await this.prisma.saleItem.findUnique({
      where: { id: saleItemId },
      include: { sale: true, product: true },
    });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    if (item.sale.status !== 'open') {
      throw new BadRequestException('Não é possível remover item de venda fechada');
    }

    // Repor estoque
    if (item.product.trackInventory) {
      await this.restoreInventory(
        item.productId,
        item.sale.branchId,
        item.qtyUnits,
        item.saleId
      );
    }

    await this.prisma.saleItem.delete({
      where: { id: saleItemId },
    });

    await this.updateSaleTotals(item.saleId);
  }

  async processPayment(saleId: string, paymentDto: ProcessPaymentDto, userId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, payments: true },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    // Validar e normalizar método de pagamento - NUNCA assumir padrão
    let normalizedMethod: string;
    try {
      normalizedMethod = normalizePaymentMethod(paymentDto.method);
      console.log(`✅ Método de pagamento recebido: ${paymentDto.method} -> normalizado: ${normalizedMethod}`);
    } catch (e) {
      console.error(`❌ Método de pagamento inválido: ${paymentDto.method}`);
      throw new BadRequestException(`Método de pagamento inválido: ${paymentDto.method}`);
    }

    // Para vendas já fechadas (sincronizadas do desktop), verificar se pagamento já existe
    if (sale.status !== 'open') {
      // Verificar se já existe um pagamento com o mesmo valor (evitar duplicação)
      const existingPayment = sale.payments.find(
        p => p.amount === paymentDto.amount && p.method === normalizedMethod
      );
      if (existingPayment) {
        console.log(`⚠️ Pagamento já existe na venda ${saleId}, pulando...`);
        return existingPayment;
      }
      // Se não existe, permitir adicionar (sincronização do desktop)
      console.log(`📝 Adicionando pagamento à venda já fechada ${saleId} (sync do desktop)`);
    }

    // Se for fiado (VALE), requer cliente para criar a dívida
    // MAS para sincronização de vendas antigas, apenas logar aviso e continuar
    if (normalizedMethod === 'VALE' && !sale.customerId) {
      console.warn(`⚠️ VALE sem cliente cadastrado na venda ${saleId}. Venda será registrada mas dívida não será criada.`);
      // NÃO bloquear - permitir o pagamento para fins de sincronização
      // A dívida não será criada, mas pelo menos o método de pagamento ficará correto
    }

    // Criar pagamento com método normalizado
    const payment = await this.prisma.payment.create({
      data: {
        saleId,
        method: normalizedMethod, // Sempre normalizado
        provider: paymentDto.provider,
        amount: paymentDto.amount,
        referenceNumber: paymentDto.referenceNumber,
        status: 'completed',
      },
    });

    console.log(`💰 Pagamento criado: id=${payment.id}, method=${normalizedMethod}, amount=${paymentDto.amount}`);

    // Se fiado (VALE) E tem cliente, criar dívida
    // 🔒 VERIFICAÇÃO DE IDEMPOTÊNCIA: Evitar duplicação de dívidas
    if (normalizedMethod === 'VALE' && sale.customerId) {
      // Verificar se já existe dívida para esta venda
      const existingDebt = await this.prisma.debt.findFirst({
        where: { saleId: sale.id },
      });

      if (existingDebt) {
        console.log(`   ⚠️ Dívida já existe para venda ${sale.id}: ${existingDebt.id} - PULANDO criação`);
      } else {
        await this.prisma.debt.create({
          data: {
            debtNumber: `DEBT-${Date.now()}`,
            customer: { connect: { id: sale.customerId } },
            sale: { connect: { id: sale.id } }, // 🔗 Vincular à venda para rastreabilidade
            createdByUser: { connect: { id: userId } },
            originalAmount: sale.total,
            paidAmount: 0,
            balance: sale.total,
            amount: sale.total,
            status: 'pending',
          },
        });
        console.log(`   ✅ Dívida criada para venda VALE ${sale.id}`);

        // Atualizar dívida total do cliente
        await this.prisma.customer.update({
          where: { id: sale.customerId },
          data: {
            currentDebt: {
              increment: sale.total,
            },
          },
        });
      }
    }

    // Verificar se venda está totalmente paga
    const totalPaid = await this.prisma.payment.aggregate({
      where: { saleId },
      _sum: { amount: true },
    });

    if (totalPaid._sum.amount >= sale.total) {
      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          status: 'closed',
          closedAt: new Date(),
        },
      });
    }

    return payment;
  }

  async closeSale(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (totalPaid < sale.total) {
      throw new BadRequestException('Venda não está totalmente paga');
    }

    return this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });
  }

  private async updateSaleTotals(saleId: string) {
    const items = await this.prisma.saleItem.findMany({
      where: { saleId },
    });

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxTotal = items.reduce((sum, item) => sum + item.tax, 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);
    const muntuSavings = items.reduce((sum, item) => sum + item.muntuSavings, 0);

    await this.prisma.sale.update({
      where: { id: saleId },
      data: { subtotal, taxTotal, total, muntuSavings },
    });
  }

  private async deductInventory(
    productId: string,
    branchId: string,
    qtyUnits: number,
    saleId: string
  ) {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId },
    });

    if (inventoryItem) {
      await this.prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          qtyUnits: { decrement: qtyUnits },
        },
      });

      await this.prisma.inventoryMovement.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: 'sale',
          qtyUnits: -qtyUnits,
          referenceType: 'sale',
          referenceId: saleId,
        },
      });
    }
  }

  private async restoreInventory(
    productId: string,
    branchId: string,
    qtyUnits: number,
    saleId: string
  ) {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId },
    });

    if (inventoryItem) {
      await this.prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          qtyUnits: { increment: qtyUnits },
        },
      });

      await this.prisma.inventoryMovement.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: 'adjustment',
          qtyUnits,
          reason: 'Item removido da venda',
          referenceType: 'sale',
          referenceId: saleId,
        },
      });
    }
  }

  private generateSaleNumber(lastNumber?: string): string {
    if (!lastNumber) {
      return `SALE-${String(Date.now()).slice(-6)}`;
    }
    
    // Suportar formatos: SALE-XXXXXX, SALE-000001, VND-YYYY-XXXXX
    try {
      if (lastNumber.startsWith('VND-')) {
        const parts = lastNumber.split('-');
        const num = parseInt(parts[2]) + 1;
        return `VND-${new Date().getFullYear()}-${num.toString().padStart(5, '0')}`;
      } else if (lastNumber.startsWith('SALE-')) {
        // Extrair número do final
        const numMatch = lastNumber.match(/\d+$/);
        if (numMatch) {
          const num = parseInt(numMatch[0]) + 1;
          return `SALE-${num.toString().padStart(6, '0')}`;
        }
      }
    } catch (e) {
      console.error('Erro ao gerar número de venda:', e);
    }
    
    // Fallback
    return `SALE-${String(Date.now()).slice(-6)}`;
  }



  async findAll(
    branchId?: string,
    status?: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      customerId?: string;
      limit?: number;
    }
  ) {
    const where: Record<string, unknown> = {};

    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (options?.customerId) where.customerId = options.customerId;

    // Filtro de data
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options?.startDate) {
        (where.createdAt as Record<string, unknown>).gte = options.startDate;
      }
      if (options?.endDate) {
        (where.createdAt as Record<string, unknown>).lte = options.endDate;
      }
    }

    // Se tem filtro de data, não limitar (ou usar limite alto)
    // Se não tem filtro, limitar para evitar sobrecarga
    const hasDateFilter = options?.startDate || options?.endDate;
    const takeLimit = options?.limit || (hasDateFilter ? 1000 : 100);

    return this.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        table: true,
        customer: true,
        cashier: true,
      },
      orderBy: { createdAt: 'desc' },
      take: takeLimit,
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        table: true,
        customer: true,
        cashier: true,
        branch: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    return sale;
  }
}
