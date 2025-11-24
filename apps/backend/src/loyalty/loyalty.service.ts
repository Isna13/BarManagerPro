import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddPointsDto } from './dto/add-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { CreateRewardDto } from './dto/create-reward.dto';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async addPoints(addPointsDto: AddPointsDto) {
    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: addPointsDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Add points transaction
    const transaction = await this.prisma.loyaltyTransaction.create({
      data: {
        customerId: addPointsDto.customerId,
        points: addPointsDto.points,
        type: 'earn',
        reason: addPointsDto.reason,
        saleId: addPointsDto.saleId,
      },
    });

    // Update customer total points
    const updatedCustomer = await this.prisma.customer.update({
      where: { id: addPointsDto.customerId },
      data: {
        loyaltyPoints: { increment: addPointsDto.points },
      },
    });

    return {
      transaction,
      totalPoints: updatedCustomer.loyaltyPoints,
    };
  }

  async redeemPoints(redeemPointsDto: RedeemPointsDto) {
    // Verify customer exists and has enough points
    const customer = await this.prisma.customer.findUnique({
      where: { id: redeemPointsDto.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.loyaltyPoints < redeemPointsDto.points) {
      throw new BadRequestException('Insufficient points');
    }

    // Redeem points transaction
    const transaction = await this.prisma.loyaltyTransaction.create({
      data: {
        customerId: redeemPointsDto.customerId,
        points: -redeemPointsDto.points,
        type: 'redeem',
        reason: `Redeemed: ${redeemPointsDto.reward}`,
      },
    });

    // Update customer total points
    const updatedCustomer = await this.prisma.customer.update({
      where: { id: redeemPointsDto.customerId },
      data: {
        loyaltyPoints: { decrement: redeemPointsDto.points },
      },
    });

    return {
      transaction,
      totalPoints: updatedCustomer.loyaltyPoints,
      reward: redeemPointsDto.reward,
    };
  }

  async getCustomerPoints(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate tier based on points
    let tier = 'Bronze';
    if (customer.loyaltyPoints >= 1000) tier = 'Gold';
    else if (customer.loyaltyPoints >= 500) tier = 'Silver';

    // Get available rewards
    const availableRewards = await this.prisma.loyaltyReward.findMany({
      where: {
        isActive: true,
        pointsRequired: { lte: customer.loyaltyPoints },
      },
      orderBy: { pointsRequired: 'asc' },
    });

    return {
      customer,
      tier,
      availableRewards,
    };
  }

  async getPointsHistory(customerId: string) {
    return this.prisma.loyaltyTransaction.findMany({
      where: { customerId },
      include: {
        sale: { select: { id: true, totalAmount: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReward(createRewardDto: CreateRewardDto) {
    return this.prisma.loyaltyReward.create({
      data: {
        name: createRewardDto.name,
        description: createRewardDto.description,
        pointsRequired: createRewardDto.pointsRequired,
        value: createRewardDto.value,
        stock: createRewardDto.stock,
      },
    });
  }

  async getAllRewards(availableOnly: boolean = false) {
    const where: any = {};
    if (availableOnly) {
      where.isActive = true;
      where.OR = [{ stock: null }, { stock: { gt: 0 } }];
    }

    return this.prisma.loyaltyReward.findMany({
      where,
      orderBy: { pointsRequired: 'asc' },
    });
  }

  async getReward(id: string) {
    const reward = await this.prisma.loyaltyReward.findUnique({
      where: { id },
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    return reward;
  }

  async updateReward(id: string, updateRewardDto: CreateRewardDto) {
    return this.prisma.loyaltyReward.update({
      where: { id },
      data: {
        name: updateRewardDto.name,
        description: updateRewardDto.description,
        pointsRequired: updateRewardDto.pointsRequired,
        value: updateRewardDto.value,
        stock: updateRewardDto.stock,
      },
    });
  }

  async deleteReward(id: string) {
    return this.prisma.loyaltyReward.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getTopCustomers(limit: number = 10) {
    return this.prisma.customer.findMany({
      orderBy: { loyaltyPoints: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        _count: {
          select: { sales: true },
        },
      },
    });
  }

  async getLoyaltyOverview() {
    const [totalCustomers, activeCustomers, totalPoints, totalTransactions] =
      await Promise.all([
        this.prisma.customer.count(),
        this.prisma.customer.count({
          where: { loyaltyPoints: { gt: 0 } },
        }),
        this.prisma.customer.aggregate({
          _sum: { loyaltyPoints: true },
        }),
        this.prisma.loyaltyTransaction.count(),
      ]);

    // Calculate tier distribution
    const [bronze, silver, gold] = await Promise.all([
      this.prisma.customer.count({
        where: { loyaltyPoints: { lt: 500 } },
      }),
      this.prisma.customer.count({
        where: { loyaltyPoints: { gte: 500, lt: 1000 } },
      }),
      this.prisma.customer.count({
        where: { loyaltyPoints: { gte: 1000 } },
      }),
    ]);

    return {
      totalCustomers,
      activeCustomers,
      totalPoints: totalPoints._sum.loyaltyPoints || 0,
      totalTransactions,
      tiers: {
        bronze,
        silver,
        gold,
      },
      participationRate: totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0,
    };
  }
}
