import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateCustomerDto) {
    // Se um ID foi fornecido (sincronização do desktop), verificar se já existe
    if (createDto.id) {
      const existing = await this.prisma.customer.findUnique({
        where: { id: createDto.id },
      });
      if (existing) {
        console.log('⚠️ Cliente já existe com este ID, retornando existente:', existing.id);
        return existing;
      }
    }

    // Verificar se já existe cliente com mesmo telefone ou email
    if (createDto.phone) {
      const existingByPhone = await this.prisma.customer.findFirst({
        where: { 
          phone: createDto.phone,
          ...(createDto.branchId && { branchId: createDto.branchId }),
        },
      });
      if (existingByPhone) {
        // Se existe por telefone mas não temos ID, retornar o existente
        // Isso acontece quando o cliente foi criado sem ID anteriormente
        console.log('⚠️ Cliente já existe com este telefone, retornando existente:', existingByPhone.id);
        return existingByPhone;
      }
    }

    const { name, branchId, id, ...rest } = createDto;
    return this.prisma.customer.create({
      data: {
        ...(id && { id }), // Usar id fornecido se disponível (para sincronização)
        ...rest,
        code: `CUST-${Date.now()}`,
        fullName: name || createDto.fullName || 'Cliente',
        currentDebt: 0,
        ...(branchId && { branch: { connect: { id: branchId } } }),
      },
    });
  }

  async findAll(branchId?: string, search?: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        ...(branchId && { branchId }),
        ...(search && {
          OR: [
            { fullName: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }),
      },
      include: {
        debts: {
          where: { status: { not: 'paid' } },
        },
        sales: {
          where: { status: 'closed' },
          select: { total: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    // Calcular campos derivados para cada cliente
    return customers.map(customer => {
      const totalPurchases = customer.sales.reduce((sum, sale) => sum + sale.total, 0);
      const currentDebt = customer.debts.reduce((sum, debt) => sum + debt.balance, 0);

      return {
        id: customer.id,
        code: customer.code,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        loyaltyPoints: customer.loyaltyPoints,
        creditLimit: customer.creditLimit,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        branchId: customer.branchId,
        totalPurchases,
        currentDebt,
      };
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
        sales: {
          where: { status: 'closed' },
          select: { total: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const totalPurchases = customer.sales.reduce((sum, sale) => sum + sale.total, 0);
    const currentDebt = customer.debts.reduce((sum, debt) => sum + debt.balance, 0);

    return {
      ...customer,
      totalPurchases,
      currentDebt,
    };
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



