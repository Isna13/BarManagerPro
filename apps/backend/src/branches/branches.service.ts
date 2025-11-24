import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateBranchDto) {
    // Verificar se código já existe
    const existing = await this.prisma.branch.findUnique({
      where: { code: createDto.code },
    });

    if (existing) {
      throw new BadRequestException('Código de filial já existe');
    }

    return this.prisma.branch.create({
      data: createDto,
    });
  }

  async findAll() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    return branch;
  }

  async update(id: string, updateDto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Filial não encontrada');
    }

    return this.prisma.branch.update({
      where: { id },
      data: updateDto,
    });
  }

  async getStats(id: string) {
    const branch = await this.findOne(id);

    // Total de vendas
    const salesStats = await this.prisma.sale.aggregate({
      where: {
        branchId: id,
        status: 'closed',
      },
      _sum: { total: true },
      _count: true,
    });

    // Estoque total
    const inventoryStats = await this.prisma.inventoryItem.aggregate({
      where: { branchId: id },
      _sum: { qtyUnits: true },
      _count: true,
    });

    // Clientes
    const customersCount = await this.prisma.customer.count({
      where: { branchId: id },
    });

    // Dívidas pendentes
    const debtsStats = await this.prisma.debt.aggregate({
      where: {
        customer: { branchId: id },
        status: { in: ['pending', 'partial'] },
      },
      _sum: { balance: true },
      _count: true,
    });

    return {
      branch,
      sales: {
        total: salesStats._sum.total || 0,
        count: salesStats._count,
      },
      inventory: {
        totalUnits: inventoryStats._sum.qtyUnits || 0,
        productsCount: inventoryStats._count,
      },
      customers: {
        count: customersCount,
      },
      debts: {
        totalBalance: debtsStats._sum.balance || 0,
        count: debtsStats._count,
      },
    };
  }
}
