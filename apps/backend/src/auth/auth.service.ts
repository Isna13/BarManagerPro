import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        branch: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário desativado');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, // role é string, não roleId
      branchId: user.branchId,
    };

    const token = this.jwtService.sign(payload);

    // Create session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Define permissions baseadas no role
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // Admin tem todas as permissões
      owner: ['*'], // Owner também tem todas
      manager: [
        'users:read', 'users:write',
        'products:*', 'inventory:*', 'sales:*',
        'reports:read', 'customers:*', 'suppliers:*'
      ],
      cashier: [
        'sales:create', 'sales:read',
        'products:read', 'inventory:read',
        'customers:read', 'customers:write'
      ],
      waiter: [
        'sales:create', 'sales:read',
        'products:read', 'customers:read'
      ],
    };

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role, // role é string: 'admin', 'manager', etc
        branchId: user.branchId,
        branch: user.branch,
        permissions: rolePermissions[user.role] || [],
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.fullName, // Preencher name também
        fullName: registerDto.fullName,
        phone: registerDto.phone,
        roleName: registerDto.role || 'cashier',
        branchId: registerDto.branchId,
        language: registerDto.language || 'pt',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
  }

  async logout(token: string) {
    await this.prisma.session.delete({
      where: { token },
    });
    return { message: 'Logout realizado com sucesso' };
  }

  async validateToken(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    return session.user;
  }
}
