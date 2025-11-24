import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateProductDto) {
    // Verificar se categoria existe
    const category = await this.prisma.category.findUnique({
      where: { id: createDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    // Verificar se já existe produto com mesmo SKU
    if (createDto.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { sku: createDto.sku },
      });
      if (existing) {
        throw new BadRequestException('Já existe produto com este SKU');
      }
    }

    const product = await this.prisma.product.create({
      data: createDto,
      include: {
        category: true,
      },
    });

    // Registrar histórico de preço inicial
    if (createDto.priceUnit) {
      await this.prisma.productPriceHistory.create({
        data: {
          productId: product.id,
          priceUnit: createDto.priceUnit,
          priceBox: createDto.priceBox,
          reason: 'Preço inicial do produto',
        },
      });
    }

    return product;
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
          orderBy: { changedAt: 'desc' },
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
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Se preço mudou, registrar no histórico
    const priceChanged = 
      (updateDto.priceUnit && updateDto.priceUnit !== product.priceUnit) ||
      (updateDto.priceBox && updateDto.priceBox !== product.priceBox);

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateDto,
      include: {
        category: true,
      },
    });

    if (priceChanged) {
      await this.prisma.productPriceHistory.create({
        data: {
          productId: id,
          priceUnit: updateDto.priceUnit || product.priceUnit,
          priceBox: updateDto.priceBox || product.priceBox,
          reason: 'Atualização de preço',
        },
      });
    }

    return updated;
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
      orderBy: { changedAt: 'desc' },
    });
  }
}
