import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateCategoryDto) {
    const { parentId, id, ...data } = createDto;
    return this.prisma.category.create({
      data: {
        ...(id && { id }), // Usar id fornecido se disponível (para sincronização)
        ...data,
        sortOrder: createDto.sortOrder || 0,
        isActive: createDto.isActive ?? true,
        ...(parentId && { parent: { connect: { id: parentId } } }),
      },
    });
  }

  async findAll(parentId?: string, active?: boolean) {
    return this.prisma.category.findMany({
      where: {
        ...(parentId !== undefined && { parentId }),
        ...(active !== undefined && { isActive: active }),
      },
      include: {
        children: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        products: {
          take: 10,
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    return category;
  }

  async update(id: string, updateDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    const { parentId, ...data } = updateDto;
    return this.prisma.category.update({
      where: { id },
      data: {
        ...data,
        ...(parentId !== undefined && {
          parent: parentId ? { connect: { id: parentId } } : { disconnect: true },
        }),
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { products: true, children: true },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    // Se tiver produtos ou subcategorias, apenas desativar
    if (category.products.length > 0 || category.children.length > 0) {
      return this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Caso contrário, deletar
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
