import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateSupplierDto) {
    const { branchId, id, code: providedCode, ...data } = createDto;
    const code = providedCode || `SUP-${Date.now()}`;
    
    try {
      // 🔴 CORREÇÃO: Verificar duplicidade por ID ou código (idempotência)
      if (id) {
        const existingById = await this.prisma.supplier.findUnique({
          where: { id },
          include: { branch: true },
        });
        if (existingById) {
          console.log(`⚠️ Fornecedor já existe por ID, retornando existente: ${id}`);
          return existingById;
        }
      }
      
      // Verificar duplicidade por código
      const existingByCode = await this.prisma.supplier.findFirst({
        where: { code },
      });
      if (existingByCode) {
        throw new ConflictException(`Fornecedor com código ${code} já existe`);
      }
      
      return await this.prisma.supplier.create({
        data: {
          ...(id && { id }), // Usar id fornecido se disponível (para sincronização)
          code,
          ...data,
          ...(branchId && { branchId }),
        },
        include: {
          branch: true,
        },
      });
    } catch (error: any) {
      if (error instanceof ConflictException) throw error;
      
      // 🔴 CORREÇÃO: Tratar erros do Prisma adequadamente
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[])?.join(', ') || 'campo';
        throw new ConflictException(`Fornecedor duplicado: ${target} já existe`);
      }
      
      console.error('❌ Erro ao criar fornecedor:', error.message);
      throw new InternalServerErrorException(`Erro ao criar fornecedor: ${error.message}`);
    }
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

