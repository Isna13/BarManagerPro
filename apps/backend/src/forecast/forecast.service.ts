import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface DemandForecast {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailyDemand: number;
  forecastedDemand: number;
  daysUntilStockout: number;
  recommendedReorder: number;
}

interface SeasonalTrend {
  productId: string;
  productName: string;
  dayOfWeek: number;
  avgSales: number;
  trend: 'high' | 'medium' | 'low';
}

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async getDemandForecast(
    branchId: string,
    productId?: string,
    days: number = 30,
  ): Promise<DemandForecast[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get historical sales data
    const salesData = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          branchId,
          createdAt: { gte: startDate },
        },
        ...(productId && { productId }),
      },
      include: {
        product: { select: { id: true, name: true } },
        sale: { select: { createdAt: true } },
      },
    });

    // Group by product and calculate demand
    const productDemand = salesData.reduce((acc, item) => {
      const key = item.productId;
      if (!acc[key]) {
        acc[key] = {
          productId: item.productId,
          productName: item.product.name,
          totalQuantity: 0,
          sales: [],
        };
      }
      acc[key].totalQuantity += item.qtyUnits;
      acc[key].sales.push(item);
      return acc;
    }, {} as Record<string, any>);

    // Get current inventory
    const inventoryData = await this.prisma.inventoryItem.findMany({
      where: {
        branchId,
        ...(productId && { productId }),
      },
    });

    const inventoryMap = inventoryData.reduce((acc, inv) => {
      acc[inv.productId] = inv.qtyUnits;
      return acc;
    }, {} as Record<string, number>);

    // Calculate forecast
    const forecasts: DemandForecast[] = [];

    for (const [prodId, data] of Object.entries(productDemand)) {
      const avgDailyDemand = data.totalQuantity / days;
      const forecastedDemand = avgDailyDemand * days;
      const currentStock = inventoryMap[prodId] || 0;
      const daysUntilStockout = currentStock / avgDailyDemand;
      const recommendedReorder = Math.ceil(avgDailyDemand * 14); // 2 weeks supply

      forecasts.push({
        productId: prodId,
        productName: data.productName,
        currentStock,
        avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
        forecastedDemand: Math.round(forecastedDemand),
        daysUntilStockout: Math.round(daysUntilStockout),
        recommendedReorder,
      });
    }

    return forecasts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  }

  async getInventoryNeeds(branchId: string, days: number = 30) {
    const forecasts = await this.getDemandForecast(branchId, undefined, days);

    const criticalItems = forecasts.filter((f) => f.daysUntilStockout <= 7);
    const lowItems = forecasts.filter(
      (f) => f.daysUntilStockout > 7 && f.daysUntilStockout <= 14,
    );
    const normalItems = forecasts.filter((f) => f.daysUntilStockout > 14);

    return {
      summary: {
        criticalItems: criticalItems.length,
        lowStockItems: lowItems.length,
        normalItems: normalItems.length,
        totalItems: forecasts.length,
      },
      critical: criticalItems,
      lowStock: lowItems,
      normal: normalItems.slice(0, 10), // Top 10 normal items
    };
  }

  async getSeasonalTrends(
    branchId: string,
    productId?: string,
  ): Promise<SeasonalTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // 3 months

    const salesData = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          branchId,
          createdAt: { gte: startDate },
        },
        ...(productId && { productId }),
      },
      include: {
        product: { select: { id: true, name: true } },
        sale: { select: { createdAt: true } },
      },
    });

    // Group by product and day of week
    const trends: Record<string, Record<number, { total: number; count: number }>> = {};

    salesData.forEach((item) => {
      const dayOfWeek = item.sale.createdAt.getDay();
      const key = item.productId;

      if (!trends[key]) {
        trends[key] = {};
      }
      if (!trends[key][dayOfWeek]) {
        trends[key][dayOfWeek] = { total: 0, count: 0 };
      }
      trends[key][dayOfWeek].total += item.qtyUnits;
      trends[key][dayOfWeek].count += 1;
    });

    // Calculate averages and trends
    const result: SeasonalTrend[] = [];

    for (const [prodId, dayData] of Object.entries(trends)) {
      const product = salesData.find((s) => s.productId === prodId)?.product;
      if (!product) continue;

      for (const [day, data] of Object.entries(dayData)) {
        const avgSales = data.total / data.count;
        const maxAvg = Math.max(
          ...Object.values(dayData).map((d) => d.total / d.count),
        );
        const trend =
          avgSales > maxAvg * 0.7
            ? 'high'
            : avgSales > maxAvg * 0.4
            ? 'medium'
            : 'low';

        result.push({
          productId: prodId,
          productName: product.name,
          dayOfWeek: parseInt(day),
          avgSales: Math.round(avgSales * 100) / 100,
          trend: trend as 'high' | 'medium' | 'low',
        });
      }
    }

    return result.sort((a, b) => {
      if (a.productId !== b.productId) return a.productId.localeCompare(b.productId);
      return a.dayOfWeek - b.dayOfWeek;
    });
  }

  async getReorderRecommendations(branchId: string) {
    const forecasts = await this.getDemandForecast(branchId, undefined, 30);

    // Filter items that need reordering (less than 2 weeks of stock)
    const needsReorder = forecasts.filter((f) => f.daysUntilStockout <= 14);

    // Get supplier info for products
    const productIds = needsReorder.map((f) => f.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        costUnit: true,
        unitsPerBox: true,
      },
    });

    const recommendations = needsReorder.map((forecast) => {
      const product = products.find((p) => p.id === forecast.productId);
      const lastPurchase = null;

      return {
        ...forecast,
        costUnit: product?.costUnit || 0,
        unitsPerBox: product?.unitsPerBox || 1,
        boxesToOrder: Math.ceil(forecast.recommendedReorder / (product?.unitsPerBox || 1)),
        estimatedCost:
          Math.ceil(forecast.recommendedReorder / (product?.unitsPerBox || 1)) *
          (product?.costUnit || 0) *
          (product?.unitsPerBox || 1),
        lastSupplier: lastPurchase?.supplier,
        priority: forecast.daysUntilStockout <= 3 ? 'urgent' : forecast.daysUntilStockout <= 7 ? 'high' : 'medium',
      };
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}
