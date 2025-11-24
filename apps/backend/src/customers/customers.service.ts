import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateCustomerDto) {
    // Verificar se já existe cliente com mesmo telefone ou email
    if (createDto.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: { phone: createDto.phone, branchId: createDto.branchId },
      });
      if (existing) {
        throw new BadRequestException('Já existe cliente com este telefone');
      }
    }

    return this.prisma.customer.create({
      data: {
        ...createDto,
        currentDebt: 0,
        totalPurchases: 0,
      },
    });
  }

  async findAll(branchId?: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        ...(branchId && { branchId }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        branch: true,
        debts: {
          where: { status: { not: 'paid' } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return customer;
  }

  async update(id: string, updateDto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateDto,
    });
  }

  async getDebts(id: string) {
    return this.prisma.debt.findMany({
      where: { customerId: id },
      include: {
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPurchaseHistory(id: string) {
    return this.prisma.sale.findMany({
      where: { customerId: id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
