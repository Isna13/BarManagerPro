import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto, AddPurchaseItemDto, UpdatePurchaseDto } from './dto';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePurchaseDto, userId: string) {
    // Se ID foi fornecido (sincronização do Electron), verificar se já existe
    if (createDto.id) {
      const existing = await this.prisma.purchase.findUnique({
        where: { id: createDto.id },
        include: {
          supplier: true,
          branch: true,
          createdByUser: true,
          items: { include: { product: true } },
        },
      });
      if (existing) {
        console.log('⚠️ Compra já existe, retornando existente:', existing.id);
        return existing;
      }
    }

    const purchaseNumber = createDto.purchaseNumber || `PUR-${Date.now()}`;
    
    const purchaseData: any = {
      purchaseNumber,
      branchId: createDto.branchId,
      supplierId: createDto.supplierId,
      createdBy: userId,
      status: createDto.status || 'pending',
      total: createDto.total || 0,
      notes: createDto.notes,
    };

    // Usar ID fornecido se disponível
    if (createDto.id) {
      purchaseData.id = createDto.id;
    }

    return this.prisma.purchase.create({
      data: purchaseData,
      include: {
        supplier: true,
        branch: true,
        createdByUser: true,
      },
    });
  }

  async update(id: string, updateDto: UpdatePurchaseDto) {
    const existing = await this.prisma.purchase.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Compra não encontrada');
    }

    const updateData: any = {};
    
    if (updateDto.status) {
      updateData.status = updateDto.status;
      // Se marcando como completed/received, registrar data
      if (updateDto.status === 'completed' || updateDto.status === 'received') {
        updateData.completedAt = new Date();
      }
    }
    
    if (updateDto.notes !== undefined) {
      updateData.notes = updateDto.notes;
    }
    
    if (updateDto.total !== undefined) {
      updateData.total = updateDto.total;
    }

    return this.prisma.purchase.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        branch: true,
        createdByUser: true,
        items: { include: { product: true } },
      },
    });
  }

  async addItem(purchaseId: string, itemDto: AddPurchaseItemDto) {
    // 🔴 IDEMPOTÊNCIA: Se já existe um item com esse ID, retornar o existente
    // Isso evita duplicação quando o sync reenvia o mesmo item
    if (itemDto.id) {
      const existingById = await this.prisma.purchaseItem.findUnique({
        where: { id: itemDto.id },
        include: { product: true },
      });
      if (existingById) {
        console.log(`[Purchases] Item ${itemDto.id} já existe, retornando existente (idempotência)`);
        return existingById;
      }
    }

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

    // 🔴 IDEMPOTÊNCIA ADICIONAL: Verificar se já existe item para esse produto nessa compra
    // Evita duplicação mesmo sem ID
    const existingByProduct = await this.prisma.purchaseItem.findFirst({
      where: { 
        purchaseId, 
        productId: itemDto.productId 
      },
      include: { product: true },
    });
    if (existingByProduct) {
      console.log(`[Purchases] Item para produto ${itemDto.productId} já existe na compra ${purchaseId}, retornando existente`);
      return existingByProduct;
    }

    // 🔴 CORREÇÃO CRÍTICA: Cálculo de custo de compra
    // O frontend envia:
    // - qtyUnits: total de unidades (já convertido de caixas)
    // - qtyBoxes: número de caixas (pode ser 0 se já convertido)
    // - unitCost: custo por CAIXA (não por unidade!)
    // - subtotal: valor total já calculado pelo frontend
    //
    // Se subtotal vier do frontend, usar diretamente (já está correto)
    // Senão, calcular: qtyBoxes * unitCost (custo por caixa × número de caixas)
    
    const totalUnits = (itemDto.qtyBoxes || 0) * product.unitsPerBox + (itemDto.qtyUnits || 0);
    
    // Calcular número de caixas a partir de unidades se qtyBoxes não foi informado
    const qtyBoxes = itemDto.qtyBoxes || Math.ceil((itemDto.qtyUnits || 0) / product.unitsPerBox);
    
    // 🔴 CORREÇÃO: Se subtotal já veio calculado do frontend, usar ele!
    // O frontend calcula corretamente: qtyBoxes * unitCost (custo por caixa)
    // Se não veio subtotal, calcular: qtyBoxes * unitCost
    let totalCost: number;
    if (itemDto.subtotal && itemDto.subtotal > 0) {
      // Usar valor do frontend que já está correto
      totalCost = itemDto.subtotal;
    } else {
      // Fallback: calcular usando caixas × custo por caixa
      totalCost = qtyBoxes * itemDto.unitCost;
    }

    const purchaseItem = await this.prisma.purchaseItem.create({
      data: {
        id: itemDto.id, // Usar ID do frontend se fornecido
        purchase: { connect: { id: purchaseId } },
        product: { connect: { id: itemDto.productId } },
        qtyUnits: totalUnits,
        qtyBoxes: qtyBoxes,
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
