import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto, UpdateTableDto } from './dto';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateTableDto) {
    // Verificar se já existe mesa com mesmo número na mesma filial
    const existing = await this.prisma.table.findFirst({
      where: {
        branchId: createDto.branchId,
        number: createDto.number,
      },
    });

    if (existing) {
      // Se já existe, retornar a existente (idempotência para sync)
      console.log(`Mesa ${createDto.number} já existe na filial ${createDto.branchId}, retornando existente`);
      return existing;
    }

    // Se o ID foi fornecido (sync do desktop), usar ele
    const data: any = {
      branchId: createDto.branchId,
      number: createDto.number,
      seats: createDto.seats || 4,
      area: createDto.area,
      qrCode: createDto.qrCode,
      isActive: createDto.isActive ?? true,
    };

    if (createDto.id) {
      data.id = createDto.id;
    }

    return this.prisma.table.create({
      data,
    });
  }

  async findAll(branchId?: string) {
    const where: any = { isActive: true };
    
    if (branchId) {
      where.branchId = branchId;
    }

    return this.prisma.table.findMany({
      where,
      orderBy: { number: 'asc' },
    });
  }

  async findOne(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return table;
  }

  async update(id: string, updateDto: UpdateTableDto) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    return this.prisma.table.update({
      where: { id },
      data: updateDto,
    });
  }

  async remove(id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Mesa não encontrada');
    }

    // Verificar se há vendas ativas nesta mesa
    const activeSales = await this.prisma.sale.findFirst({
      where: {
        tableId: id,
        status: { not: 'closed' },
      },
    });

    if (activeSales) {
      throw new BadRequestException('Não é possível remover mesa com vendas ativas');
    }

    // Soft delete - apenas desativar
    return this.prisma.table.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getTableStatus(id: string) {
    const table = await this.findOne(id);

    // Buscar venda ativa na mesa
    const activeSale = await this.prisma.sale.findFirst({
      where: {
        tableId: id,
        status: { in: ['open', 'pending'] },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    return {
      ...table,
      status: activeSale ? 'occupied' : 'available',
      currentSale: activeSale,
    };
  }
}
