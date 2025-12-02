import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto, AddPurchaseItemDto } from './dto';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePurchaseDto, userId: string) {
    const purchaseNumber = `PUR-${Date.now()}`;
    return this.prisma.purchase.create({
      data: {
        purchaseNumber,
        branchId: createDto.branchId,
        supplierId: createDto.supplierId,
        createdBy: userId,
        status: 'pending',
        total: 0,
        notes: createDto.notes,
      },
      include: {
        supplier: true,
        branch: true,
        createdByUser: true,
      },
    });
  }

  async addItem(purchaseId: string, itemDto: AddPurchaseItemDto) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException('Compra não encontrada');
    }

    if (purchase.status !== 'pending') {
      throw new BadRequestException('Compra já foi finalizada');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: itemDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Converter caixas para unidades
    const totalUnits = (itemDto.qtyBoxes || 0) * product.unitsPerBox + (itemDto.qtyUnits || 0);
    const totalCost = itemDto.unitCost * totalUnits;

    const purchaseItem = await this.prisma.purchaseItem.create({
      data: {
        purchase: { connect: { id: purchaseId } },
        product: { connect: { id: itemDto.productId } },
        qtyUnits: totalUnits,
        qtyBoxes: itemDto.qtyBoxes || 0,
        unitCost: itemDto.unitCost,
        subtotal: totalCost,
        total: totalCost,
      },
      include: {
        product: true,
      },
    });

    // Atualizar total da compra
    await this.updatePurchaseTotal(purchaseId);

    return purchaseItem;
  }

  async completePurchase(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!purchase) {
      throw new NotFoundException('Compra não encontrada');
    }

    if (purchase.status !== 'pending') {
      throw new BadRequestException('Compra já foi finalizada');
    }

    if (purchase.items.length === 0) {
      throw new BadRequestException('Compra não possui itens');
    }

    // Atualizar estoque para cada item
    for (const item of purchase.items) {
      await this.addToInventory(item.productId, purchase.branchId, item.qtyUnits, id);
    }

    return this.prisma.purchase.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
        branch: true,
        createdByUser: true,
      },
    });
  }

  async findAll(branchId?: string, status?: string) {
    return this.prisma.purchase.findMany({
      where: {
        ...(branchId && { branchId }),
        ...(status && { status }),
      },
      include: {
        supplier: true,
        branch: true,
        createdByUser: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
        branch: true,
        createdByUser: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Compra não encontrada');
    }

    return purchase;
  }

  private async updatePurchaseTotal(purchaseId: string) {
    const items = await this.prisma.purchaseItem.findMany({
      where: { purchaseId },
    });

    const total = items.reduce((sum, item) => sum + item.total, 0);

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { totalCost: total },
    });
  }

  private async addToInventory(productId: string, branchId: string, qtyUnits: number, purchaseId: string) {
    let inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId },
    });

    if (!inventoryItem) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      inventoryItem = await this.prisma.inventoryItem.create({
        data: {
          productId,
          branchId,
          qtyUnits,
          minStock: 0,
        },
      });
    } else {
      await this.prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          qtyUnits: { increment: qtyUnits },
        },
      });
    }

    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: inventoryItem.id,
        type: 'purchase',
        qtyUnits,
        reason: `Compra recebida`,
        referenceType: 'purchase',
        referenceId: purchaseId,
      },
    });
  }
}
