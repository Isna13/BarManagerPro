import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, AddSaleItemDto, ProcessPaymentDto } from './dto';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(createSaleDto: CreateSaleDto, userId: string) {
    // Gerar número sequencial da venda
    const lastSale = await this.prisma.sale.findFirst({
      where: { branchId: createSaleDto.branchId },
      orderBy: { createdAt: 'desc' },
    });

    const saleNumber = this.generateSaleNumber(lastSale?.saleNumber);

    return this.prisma.sale.create({
      data: {
        saleNumber,
        branchId: createSaleDto.branchId,
        type: createSaleDto.type || 'counter',
        tableId: createSaleDto.tableId,
        customerId: createSaleDto.customerId,
        userId: userId,
        status: 'open',
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        table: true,
        customer: true,
        user: true,
      },
    });
  }

  async addItem(saleId: string, addItemDto: AddSaleItemDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    if (sale.status !== 'open') {
      throw new BadRequestException('Venda já foi fechada');
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
        saleId,
        productId: product.id,
        qtyUnits,
        isMuntu,
        unitPrice,
        subtotal,
        tax,
        total,
        muntuSavings,
      },
      include: {
        product: true,
      },
    });

    // Atualizar totais da venda
    await this.updateSaleTotals(saleId);

    // Deduzir estoque (se trackInventory)
    if (product.trackInventory) {
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

    if (sale.status !== 'open') {
      throw new BadRequestException('Venda já foi processada');
    }

    // Se for fiado, requer cliente
    if (paymentDto.method === 'debt' && !sale.customerId) {
      throw new BadRequestException('Cliente é obrigatório para venda fiada');
    }

    // Criar pagamento
    const payment = await this.prisma.payment.create({
      data: {
        saleId,
        method: paymentDto.method,
        provider: paymentDto.provider,
        amount: paymentDto.amount,
        reference: paymentDto.referenceNumber,
        status: 'completed',
      },
    });

    // Se fiado, criar dívida
    if (paymentDto.method === 'debt') {
      await this.prisma.debt.create({
        data: {
          customerId: sale.customerId,
          userId: userId,
          amount: sale.total,
          balance: sale.total,
          status: 'pending',
        },
      });

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
      return `VND-${new Date().getFullYear()}-00001`;
    }
    
    const parts = lastNumber.split('-');
    const num = parseInt(parts[2]) + 1;
    return `VND-${new Date().getFullYear()}-${num.toString().padStart(5, '0')}`;
  }



  async findAll(branchId?: string, status?: string) {
    return this.prisma.sale.findMany({
      where: {
        ...(branchId && { branchId }),
        ...(status && { status }),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        table: true,
        customer: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
        user: true,
        branch: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    return sale;
  }
}
