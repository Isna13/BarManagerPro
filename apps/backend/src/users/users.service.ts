import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        role: createUserDto.role,
        branchId: createUserDto.branchId,
        isActive: createUserDto.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(branchId?: string, role?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (role) where.role = role;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { name: true, code: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const data: any = {};

    if (updateUserDto.email) data.email = updateUserDto.email;
    if (updateUserDto.role) data.role = updateUserDto.role;
    if (updateUserDto.branchId) data.branchId = updateUserDto.branchId;
    if (updateUserDto.isActive !== undefined) data.isActive = updateUserDto.isActive;
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
      },
    });
  }

  async getBranchUserStats(branchId: string) {
    const [total, active, byRole] = await Promise.all([
      this.prisma.user.count({ where: { branchId } }),
      this.prisma.user.count({ where: { branchId, isActive: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { branchId },
        _count: { role: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byRole: byRole.map((r) => ({ role: r.role, count: r._count.role })),
    };
  }
}
