import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';

@Injectable()
export class QrMenuService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMenuDto: CreateMenuDto) {
    // Verify branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: createMenuDto.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return {
      id: `menu-${branch.id}`,
      name: createMenuDto.name,
      description: createMenuDto.description,
      branchId: createMenuDto.branchId,
      branch: { name: branch.name, code: branch.code },
      isActive: true,
    };
  }

  async findAll() {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    });

    return branches.map((branch) => ({
      id: `menu-${branch.id}`,
      name: `Menu ${branch.name}`,
      branchId: branch.id,
      branch: { name: branch.name, code: branch.code },
      isActive: true,
    }));
  }

  async findOne(id: string) {
    const branchId = id.replace('menu-', '');
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        products: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            sellingPrice: true,
            category: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Menu not found');
    }

    return {
      id,
      name: `Menu ${branch.name}`,
      branchId: branch.id,
      branch: {
        name: branch.name,
        code: branch.code,
        products: branch.products,
      },
    };
  }

  async getMenuByBranch(branchId: string) {
    const menu = await this.findOne(`menu-${branchId}`);
    return [menu];
  }

  async update(id: string, updateMenuDto: CreateMenuDto) {
    return {
      id,
      name: updateMenuDto.name,
      description: updateMenuDto.description,
      branchId: updateMenuDto.branchId,
      isActive: updateMenuDto.isActive ?? true,
    };
  }

  async remove(id: string) {
    return { id, isActive: false };
  }

  async generateQRCode(id: string) {
    const menu = await this.findOne(id);
    const menuUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/menu/${id}`;

    return {
      menuId: menu.id,
      menuName: menu.name,
      qrCodeUrl: menuUrl,
      qrCodeData: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='white'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' font-family='monospace' font-size='8'>${menuUrl}</text></svg>`,
    };
  }
}
