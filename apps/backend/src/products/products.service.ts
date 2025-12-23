import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

// Campos válidos do modelo Product no Prisma (excluindo relações)
const VALID_PRODUCT_FIELDS = [
  'name', 'description', 'sku', 'barcode', 'nameKriol', 'nameFr',
  'priceUnit', 'priceBox', 'costUnit', 'costBox', 'unitsPerBox',
  'boxEnabled', 'trackInventory', 'lowStockAlert', 'isMuntuEligible',
  'muntuQuantity', 'muntuPrice', 'maxDiscountMuntu', 'minMarginPercent',
  'taxRate', 'isActive', 'doseEnabled', 'dosesPerBottle', 'synced', 'lastSync'
];

// Função para limpar campos inválidos do payload
function sanitizeProductData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (VALID_PRODUCT_FIELDS.includes(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(createDto: CreateProductDto) {
    try {
      // Verificar se categoria existe (se fornecida)
      if (createDto.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: createDto.categoryId },
        });

        if (!category) {
          throw new NotFoundException('Categoria não encontrada');
        }
      }

      // Verificar se fornecedor existe (se fornecido)
      if (createDto.supplierId) {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: createDto.supplierId },
        });

        if (!supplier) {
          throw new NotFoundException('Fornecedor não encontrado');
        }
      }

      const { categoryId, supplierId, id, ...rawProductData } = createDto;
      
      // 🔴 CORREÇÃO: Sanitizar dados para remover campos inválidos
      const productData = sanitizeProductData(rawProductData);

      // Se tem ID, usar upsert para sincronização
      if (id) {
        const product = await this.prisma.product.upsert({
          where: { id },
          create: {
            id,
            name: createDto.name, // Campo obrigatório
            ...productData,
            sku: createDto.sku || `SKU-${Date.now()}`,
            costUnit: createDto.costUnit || 0,
            unitsPerBox: createDto.unitsPerBox || 1,
            priceUnit: createDto.priceUnit || 0,
            category: categoryId ? { connect: { id: categoryId } } : undefined,
            supplier: supplierId ? { connect: { id: supplierId } } : undefined,
          },
          update: {
            ...productData,
            category: categoryId ? { connect: { id: categoryId } } : undefined,
            supplier: supplierId ? { connect: { id: supplierId } } : undefined,
          },
          include: {
            category: true,
            supplier: true,
          },
        });
        return product;
      }

      // Verificar se já existe produto com mesmo SKU (apenas para novos produtos)
      if (createDto.sku) {
        const existing = await this.prisma.product.findUnique({
          where: { sku: createDto.sku },
        });
        if (existing) {
          throw new BadRequestException('Já existe produto com este SKU');
        }
      }

      const product = await this.prisma.product.create({
        data: {
          name: createDto.name, // Campo obrigatório
          ...productData,
          sku: createDto.sku || `SKU-${Date.now()}`,
          costUnit: createDto.costUnit || 0,
          unitsPerBox: createDto.unitsPerBox || 1,
          priceUnit: createDto.priceUnit || 0,
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          supplier: supplierId ? { connect: { id: supplierId } } : undefined,
        },
        include: {
          category: true,
          supplier: true,
        },
      });

      // Registrar histórico de preço inicial
      if (createDto.priceUnit) {
        await this.prisma.productPriceHistory.create({
          data: {
            product: { connect: { id: product.id } },
            priceUnit: createDto.priceUnit,
            priceBox: createDto.priceBox || 0,
            costUnit: createDto.costUnit || 0,
            costBox: createDto.costBox || 0,
            reason: 'Preço inicial do produto',
          },
        });
      }

      return product;
    } catch (error) {
      // 🔴 CORREÇÃO: Tratamento de erro com mensagem detalhada
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Erro ao criar produto:', error);
      throw new InternalServerErrorException(
        `Erro ao criar produto: ${error.message || 'Erro desconhecido'}`
      );
    }
  }

  async findAll(categoryId?: string, search?: string, active?: boolean) {
    return this.prisma.product.findMany({
      where: {
        ...(categoryId && { categoryId }),
        ...(active !== undefined && { isActive: active }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { barcode: { contains: search } },
          ],
        }),
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        priceHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return product;
  }

  async update(id: string, updateDto: UpdateProductDto) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundException('Produto não encontrado');
      }

      // Verificar se categoria existe (se fornecida)
      if (updateDto.categoryId) {
        const category = await this.prisma.category.findUnique({
          where: { id: updateDto.categoryId },
        });
        if (!category) {
          throw new NotFoundException('Categoria não encontrada');
        }
      }

      // Verificar se fornecedor existe (se fornecido)
      if (updateDto.supplierId) {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: updateDto.supplierId },
        });
        if (!supplier) {
          throw new NotFoundException('Fornecedor não encontrado');
        }
      }

      // Separar campos relacionais do resto e sanitizar
      const { categoryId, supplierId, ...rawProductData } = updateDto;
      const productData = sanitizeProductData(rawProductData);

      // Se preço mudou, registrar no histórico
      const priceChanged = 
        (updateDto.priceUnit && updateDto.priceUnit !== product.priceUnit) ||
        (updateDto.priceBox && updateDto.priceBox !== product.priceBox);

      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...productData,
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          supplier: supplierId ? { connect: { id: supplierId } } : undefined,
        },
        include: {
          category: true,
          supplier: true,
        },
      });

      if (priceChanged) {
        await this.prisma.productPriceHistory.create({
          data: {
            product: { connect: { id } },
            priceUnit: updateDto.priceUnit || product.priceUnit,
            priceBox: updateDto.priceBox || product.priceBox || 0,
            costUnit: updateDto.costUnit || product.costUnit,
            costBox: updateDto.costBox || product.costBox || 0,
            reason: 'Atualização de preço',
          },
        });
      }

      return updated;
    } catch (error) {
      // 🔴 CORREÇÃO: Tratamento de erro com mensagem detalhada
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Erro ao atualizar produto:', error);
      throw new InternalServerErrorException(
        `Erro ao atualizar produto: ${error.message || 'Erro desconhecido'}`
      );
    }
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Soft delete
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getPriceHistory(id: string) {
    return this.prisma.productPriceHistory.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
