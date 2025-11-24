import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddStockDto, TransferStockDto, AdjustStockDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    return this.prisma.inventoryItem.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        product: true,
        branch: true,
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: true,
        branch: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado');
    }

    return item;
  }

  async findByProduct(productId: string, branchId?: string) {
    return this.prisma.inventoryItem.findMany({
      where: {
        productId,
        ...(branchId && { branchId }),
      },
      include: {
        branch: true,
        product: true,
      },
    });
  }

  async addStock(addStockDto: AddStockDto) {
    const { productId, branchId, qtyBoxes, qtyUnits, reason } = addStockDto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Converter caixas para unidades
    const totalUnits = (qtyBoxes || 0) * product.unitsPerBox + (qtyUnits || 0);

    // Buscar ou criar item de estoque
    let inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId },
    });

    if (!inventoryItem) {
      inventoryItem = await this.prisma.inventoryItem.create({
        data: {
          productId,
          branchId,
          qtyUnits: totalUnits,
          minStock: product.minStock || 0,
        },
      });
    } else {
      inventoryItem = await this.prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          qtyUnits: { increment: totalUnits },
        },
      });
    }

    // Registrar movimento
    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: inventoryItem.id,
        type: 'purchase',
        qtyUnits: totalUnits,
        reason: reason || `Entrada de estoque: ${qtyBoxes || 0} cx + ${qtyUnits || 0} un`,
      },
    });

    return this.findOne(inventoryItem.id);
  }

  async transferStock(transferDto: TransferStockDto) {
    const { productId, fromBranchId, toBranchId, qtyBoxes, qtyUnits, notes } = transferDto;

    if (fromBranchId === toBranchId) {
      throw new BadRequestException('Filial de origem e destino devem ser diferentes');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const totalUnits = (qtyBoxes || 0) * product.unitsPerBox + (qtyUnits || 0);

    // Verificar estoque origem
    const fromItem = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId: fromBranchId },
    });

    if (!fromItem || fromItem.qtyUnits < totalUnits) {
      throw new BadRequestException('Estoque insuficiente na filial de origem');
    }

    // Criar transferência
    const transfer = await this.prisma.inventoryTransfer.create({
      data: {
        productId,
        fromBranchId,
        toBranchId,
        qtyUnits: totalUnits,
        status: 'completed',
        notes,
      },
    });

    // Deduzir da origem
    await this.prisma.inventoryItem.update({
      where: { id: fromItem.id },
      data: { qtyUnits: { decrement: totalUnits } },
    });

    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: fromItem.id,
        type: 'transfer_out',
        qtyUnits: -totalUnits,
        reason: `Transferência para outra filial`,
        referenceType: 'transfer',
        referenceId: transfer.id,
      },
    });

    // Adicionar no destino
    let toItem = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId: toBranchId },
    });

    if (!toItem) {
      toItem = await this.prisma.inventoryItem.create({
        data: {
          productId,
          branchId: toBranchId,
          qtyUnits: totalUnits,
          minStock: product.minStock || 0,
        },
      });
    } else {
      toItem = await this.prisma.inventoryItem.update({
        where: { id: toItem.id },
        data: { qtyUnits: { increment: totalUnits } },
      });
    }

    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: toItem.id,
        type: 'transfer_in',
        qtyUnits: totalUnits,
        reason: `Transferência de outra filial`,
        referenceType: 'transfer',
        referenceId: transfer.id,
      },
    });

    return transfer;
  }

  async adjustStock(adjustDto: AdjustStockDto) {
    const { inventoryItemId, qtyUnits, reason } = adjustDto;

    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado');
    }

    const difference = qtyUnits - item.qtyUnits;

    await this.prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { qtyUnits },
    });

    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId,
        type: 'adjustment',
        qtyUnits: difference,
        reason: reason || 'Ajuste de estoque',
      },
    });

    return this.findOne(inventoryItemId);
  }

  async getMovements(inventoryItemId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { inventoryItemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getLowStock(branchId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        branchId,
        qtyUnits: {
          lte: this.prisma.inventoryItem.fields.minStock,
        },
      },
      include: {
        product: true,
      },
    });

    return items.filter(item => item.qtyUnits <= item.minStock);
  }
}
