import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddStockDto, TransferStockDto, AdjustStockDto, AdjustStockByProductDto, UpsertInventoryItemDto } from './dto';

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
          qtyUnits: qtyUnits || 0,
          minStock: 0,
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
        qtyUnits: qtyUnits || 0,
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
        
        fromBranch: { connect: { id: fromBranchId } },
        toBranch: { connect: { id: toBranchId } },
        items: [],
        requestedBy: 'system',
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
          qtyUnits: transferDto.qtyUnits,
          minStock: 0,
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
        qtyUnits: transferDto.qtyUnits,
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

  async adjustStockByProduct(adjustDto: AdjustStockByProductDto) {
    const { productId, branchId, adjustment, reason } = adjustDto;

    // Buscar ou criar item de inventário
    let item = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId },
    });

    if (!item) {
      // Criar item de inventário se não existir
      item = await this.prisma.inventoryItem.create({
        data: {
          productId,
          branchId,
          qtyUnits: Math.max(0, adjustment), // Se adjustment for negativo, começar em 0
          minStock: 0,
        },
      });
    } else {
      // Atualizar quantidade
      const newQty = Math.max(0, item.qtyUnits + adjustment);
      
      await this.prisma.inventoryItem.update({
        where: { id: item.id },
        data: { qtyUnits: newQty },
      });
    }

    // Registrar movimento
    await this.prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: adjustment >= 0 ? 'adjustment' : 'sale',
        qtyUnits: adjustment,
        reason: reason || 'Ajuste sincronizado do Electron',
      },
    });

    return this.findByProduct(productId, branchId);
  }

  async getMovements(inventoryItemId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { inventoryItemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getAllMovements(options?: {
    productId?: string;
    movementType?: string;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (options?.productId) {
      where.inventoryItem = {
        productId: options.productId,
      };
    }

    if (options?.movementType) {
      where.type = options.movementType;
    }

    return this.prisma.inventoryMovement.findMany({
      where,
      include: {
        inventoryItem: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
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

  // Método para criar ou atualizar item de inventário (sincronização)
  async upsertInventoryItem(dto: UpsertInventoryItemDto) {
    const { id, productId, branchId, ...data } = dto;

    // Verificar se o produto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Produto não encontrado: ${productId}`);
    }

    // Verificar se a filial existe
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Filial não encontrada: ${branchId}`);
    }

    // Preparar dados para upsert
    const inventoryData = {
      qtyUnits: data.qtyUnits ?? 0,
      qtyBoxes: data.qtyBoxes ?? 0,
      closedBoxes: data.closedBoxes ?? 0,
      openBoxUnits: data.openBoxUnits ?? 0,
      minStock: data.minStock ?? 10,
      batchNumber: data.batchNumber ?? null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      location: data.location ?? null,
      consumptionAvg7d: data.consumptionAvg7d ?? 0,
      consumptionAvg15d: data.consumptionAvg15d ?? 0,
      consumptionAvg30d: data.consumptionAvg30d ?? 0,
      daysUntilStockout: data.daysUntilStockout ?? null,
      suggestedReorder: data.suggestedReorder ?? 0,
      synced: true,
      lastSync: new Date(),
    };

    // Se tem ID, usar upsert
    if (id) {
      return this.prisma.inventoryItem.upsert({
        where: { id },
        create: {
          id,
          productId,
          branchId,
          ...inventoryData,
        },
        update: inventoryData,
        include: {
          product: true,
          branch: true,
        },
      });
    }

    // Se não tem ID, verificar se já existe item para esse produto/filial
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { productId, branchId },
    });

    if (existing) {
      return this.prisma.inventoryItem.update({
        where: { id: existing.id },
        data: inventoryData,
        include: {
          product: true,
          branch: true,
        },
      });
    }

    // Criar novo
    return this.prisma.inventoryItem.create({
      data: {
        productId,
        branchId,
        ...inventoryData,
      },
      include: {
        product: true,
        branch: true,
      },
    });
  }

  async deleteItem(id: string) {
    // Primeiro deletar movimentações relacionadas
    await this.prisma.inventoryMovement.deleteMany({
      where: { inventoryItemId: id },
    });

    // Deletar o item de inventário
    return this.prisma.inventoryItem.delete({
      where: { id },
    });
  }
}



