import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Verificar por email OU username
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('User with this email already exists');
    }

    // Verificar username se fornecido
    if (createUserDto.username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: createUserDto.username },
      });
      if (existingUsername) {
        throw new ConflictException('User with this username already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Converter allowedTabs array para JSON string se fornecido
    const allowedTabsJson = createUserDto.allowedTabs 
      ? JSON.stringify(createUserDto.allowedTabs) 
      : null;

    // Obter branchId default se não fornecido
    let branchId = createUserDto.branchId;
    if (!branchId) {
      const defaultBranch = await this.prisma.branch.findFirst({
        where: { isActive: true },
        orderBy: { isMain: 'desc' },
      });
      branchId = defaultBranch?.id || null;
    }

    return this.prisma.user.create({
      data: {
        id: createUserDto.id, // Usar ID do Electron se fornecido
        username: createUserDto.username,
        email: createUserDto.email,
        password: hashedPassword,
        fullName: createUserDto.fullName || createUserDto.username || createUserDto.email.split('@')[0],
        role: createUserDto.role || 'cashier',
        roleName: createUserDto.role || 'cashier',
        branchId: branchId,
        phone: createUserDto.phone,
        allowedTabs: allowedTabsJson,
        isActive: createUserDto.isActive ?? true,
        synced: true,
        lastSync: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        branchId: true,
        phone: true,
        allowedTabs: true,
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
        username: true,
        email: true,
        fullName: true,
        role: true,
        branchId: true,
        phone: true,
        allowedTabs: true,
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
        username: true,
        email: true,
        fullName: true,
        role: true,
        branchId: true,
        phone: true,
        allowedTabs: true,
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

    if (updateUserDto.username) data.username = updateUserDto.username;
    if (updateUserDto.email) data.email = updateUserDto.email;
    if (updateUserDto.fullName) data.fullName = updateUserDto.fullName;
    if (updateUserDto.role) {
      data.role = updateUserDto.role;
      data.roleName = updateUserDto.role;
    }
    if (updateUserDto.branchId) data.branchId = updateUserDto.branchId;
    if (updateUserDto.phone !== undefined) data.phone = updateUserDto.phone;
    if (updateUserDto.allowedTabs !== undefined) {
      data.allowedTabs = updateUserDto.allowedTabs 
        ? JSON.stringify(updateUserDto.allowedTabs) 
        : null;
    }
    if (updateUserDto.isActive !== undefined) data.isActive = updateUserDto.isActive;
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Marcar como sincronizado
    data.synced = true;
    data.lastSync = new Date();

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        branchId: true,
        phone: true,
        allowedTabs: true,
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
    const [total, active, users] = await Promise.all([
      this.prisma.user.count({ where: { branchId } }),
      this.prisma.user.count({ where: { branchId, isActive: true } }),
      this.prisma.user.findMany({ where: { branchId }, select: { roleName: true } }),
    ]);

    // Manual grouping by roleName
    const roleCounts = users.reduce((acc, user) => {
      const role = user.roleName || 'unknown';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      active,
      inactive: total - active,
      byRole: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
    };
  }
}
