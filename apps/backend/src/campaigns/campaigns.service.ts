import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, CampaignStatus } from './dto/create-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCampaignDto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: createCampaignDto.name,
        description: createCampaignDto.description,
        type: createCampaignDto.type,
        status: 'DRAFT',
        startDate: new Date(createCampaignDto.startDate),
        endDate: new Date(createCampaignDto.endDate),
        discountPercent: createCampaignDto.discountPercentage,
        branchId: createCampaignDto.branchId,
        targetProducts: createCampaignDto.targetProducts,
      },
      include: {
        branch: { select: { name: true, code: true } },
      },
    });
  }

  async findAll(query: CampaignQueryDto) {
    const where: any = {};

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) where.startDate.gte = new Date(query.startDate);
      if (query.endDate) where.endDate = { lte: new Date(query.endDate) };
    }

    return this.prisma.campaign.findMany({
      where,
      include: {
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveCampaigns() {
    const now = new Date();
    return this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        branch: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(id: string, updateCampaignDto: CreateCampaignDto) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: updateCampaignDto.name,
        description: updateCampaignDto.description,
        type: updateCampaignDto.type,
        startDate: new Date(updateCampaignDto.startDate),
        endDate: new Date(updateCampaignDto.endDate),
        discountPercent: updateCampaignDto.discountPercentage,
        branchId: updateCampaignDto.branchId,
        targetProducts: updateCampaignDto.targetProducts,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const validStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: status as CampaignStatus },
    });
  }

  async remove(id: string) {
    return this.prisma.campaign.delete({ where: { id } });
  }

  async getCampaignPerformance(id: string) {
    const campaign = await this.findOne(id);

    // Get sales during campaign period
    const sales = await this.prisma.sale.findMany({
      where: {
        branchId: campaign.branch?.id,
        createdAt: {
          gte: campaign.startDate,
          lte: campaign.endDate,
        },
      },
      include: {
        customer: { select: { id: true, fullName: true } },
      },
    });

    // Calculate metrics
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const uniqueCustomers = new Set(sales.map((s) => s.customerId).filter(Boolean)).size;

    // Calculate discount impact
    const totalDiscount = sales.reduce((sum, sale) => sum + sale.discountTotal, 0);

    // Get target products performance if applicable
    let productPerformance = [];
    // TODO: Re-implement with proper SaleItem relations
    /* if (campaign.targetProducts) {
      const targetIds = JSON.parse(campaign.targetProducts);
      const productSales = sales.flatMap((s) =>
        s.items.filter((item) => targetIds.includes(item.productId)),
      );

      const grouped = productSales.reduce((acc, item) => {
        if (!acc[item.productId]) {
          acc[item.productId] = { quantity: 0, revenue: 0 };
        }
        acc[item.productId].quantity += item.qtyUnits;
        acc[item.productId].revenue += item.subtotal;
        return acc;
      }, {} as Record<string, any>);

      productPerformance = Object.entries(grouped).map(([productId, data]) => ({
        productId,
        ...data,
      }));
    } */

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      },
      metrics: {
        totalSales,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgSaleValue: Math.round(avgSaleValue * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        uniqueCustomers,
      },
      productPerformance,
    };
  }

  async applyCampaign(campaignId: string, saleId: string) {
    const campaign = await this.findOne(campaignId);
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // Validate campaign is active
    const now = new Date();
    if (
      campaign.status !== 'ACTIVE' ||
      campaign.startDate > now ||
      campaign.endDate < now
    ) {
      throw new BadRequestException('Campaign is not active');
    }

    // Calculate discount
    let discount = 0;
    if (campaign.discountPercent) {
      discount = (sale.total * Number(campaign.discountPercent)) / 100;
    }

    // Apply discount to sale
    const updatedSale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        discountTotal: discount,
        total: sale.total - discount,
      },
    });

    return {
      sale: updatedSale,
      appliedDiscount: discount,
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
    };
  }

  // Automated campaign status updates
  @Cron(CronExpression.EVERY_HOUR)
  async updateCampaignStatuses() {
    const now = new Date();

    // Activate campaigns that should start
    await this.prisma.campaign.updateMany({
      where: {
        status: 'DRAFT',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      data: { status: 'ACTIVE' },
    });

    // Complete campaigns that have ended
    await this.prisma.campaign.updateMany({
      where: {
        status: { in: ['ACTIVE', 'PAUSED'] },
        endDate: { lt: now },
      },
      data: { status: 'COMPLETED' },
    });
  }
}
