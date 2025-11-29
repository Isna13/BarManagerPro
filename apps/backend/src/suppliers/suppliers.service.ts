import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateSupplierDto) {
    const { branchId, ...data } = createDto;
    return this.prisma.supplier.create({
      data: {
        ...data,
        ...(branchId && { branch: { connect: { id: branchId } } }),
      },
      include: {
        branch: true,
      },
    });
  }

  async findAll(branchId?: string) {
    return this.prisma.supplier.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        branch: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return supplier;
  }

  async update(id: string, updateDto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return this.prisma.supplier.update({
      where: { id },
      data: updateDto,
      include: {
        branch: true,
      },
    });
  }

  async getPurchases(id: string) {
    return this.prisma.purchase.findMany({
      where: { supplierId: id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
