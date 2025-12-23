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
      // 🔴 CORREÇÃO CRÍTICA: Usar UPSERT para garantir que o ID fornecido seja usado
      // Isso permite que o Electron mantenha consistência de IDs com o servidor
      if (id) {
        const result = await this.prisma.supplier.upsert({
          where: { id },
          update: {
            ...data,
            code,
            ...(branchId && { branchId }),
          },
          create: {
            id, // Usar o ID fornecido pelo cliente
            code,
            ...data,
            ...(branchId && { branchId }),
          },
          include: {
            branch: true,
          },
        });
        console.log(`✅ Supplier upserted com ID: ${id}`);
        return result;
      }
      
      // Verificar duplicidade por código (apenas quando não tem ID)
      const existingByCode = await this.prisma.supplier.findFirst({
        where: { code },
      });
      if (existingByCode) {
        throw new ConflictException(`Fornecedor com código ${code} já existe`);
      }
      
      return await this.prisma.supplier.create({
        data: {
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

  async findAll(branchId?: string, active?: boolean) {
    return this.prisma.supplier.findMany({
      where: {
        ...(branchId && { branchId }),
        ...(active !== undefined && { isActive: active }),
      },
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

  async delete(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    // Verificar se há produtos ou compras associadas
    const productsCount = await this.prisma.product.count({
      where: { supplierId: id },
    });
    
    if (productsCount > 0) {
      // Desassociar produtos do fornecedor antes de deletar
      await this.prisma.product.updateMany({
        where: { supplierId: id },
        data: { supplierId: null },
      });
    }

    return this.prisma.supplier.delete({
      where: { id },
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

