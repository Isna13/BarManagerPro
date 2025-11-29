import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async salesReport(startDate: Date, endDate: Date, branchId?: string) {
    const sales = await this.prisma.sale.findMany({
      where: {
        ...(branchId && { branchId }),
        status: 'closed',
        closedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalMuntuSavings = sales.reduce((sum, sale) => sum + sale.muntuSavings, 0);
    const totalTax = sales.reduce((sum, sale) => sum + sale.taxTotal, 0);

    // Agrupar por método de pagamento
    const paymentMethods: Record<string, { count: number; total: number }> = {};
    sales.forEach(sale => {
      sale.payments.forEach(payment => {
        if (!paymentMethods[payment.method]) {
          paymentMethods[payment.method] = { count: 0, total: 0 };
        }
        paymentMethods[payment.method].count++;
        paymentMethods[payment.method].total += payment.amount;
      });
    });

    return {
      period: { startDate, endDate },
      summary: {
        totalSales,
        salesCount: sales.length,
        averageTicket: sales.length > 0 ? totalSales / sales.length : 0,
        totalMuntuSavings,
        totalTax,
      },
      paymentMethods,
      dailySales: this.groupByDate(sales),
    };
  }

  async inventoryReport(branchId?: string) {
    const inventory = await this.prisma.inventoryItem.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        product: true,
        branch: true,
      },
    });

    const totalValue = inventory.reduce((sum, item) => {
      return sum + (item.qtyUnits * item.product.costUnit);
    }, 0);

    const lowStockItems = inventory.filter(item => item.qtyUnits <= item.minStock);

    return {
      summary: {
        totalItems: inventory.length,
        totalValue,
        lowStockItems: lowStockItems.length,
      },
      items: inventory.map(item => ({
        product: item.product.name,
        sku: item.product.sku,
        qtyUnits: item.qtyUnits,
        minStock: item.minStock,
        value: item.qtyUnits * item.product.costUnit,
        isLowStock: item.qtyUnits <= item.minStock,
      })),
      lowStock: lowStockItems.map(item => ({
        product: item.product.name,
        sku: item.product.sku,
        qtyUnits: item.qtyUnits,
        minStock: item.minStock,
        shortage: item.minStock - item.qtyUnits,
      })),
    };
  }

  async customersReport(branchId?: string) {
    const customers = await this.prisma.customer.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        debts: {
          where: { status: { in: ['pending', 'partial'] } },
        },
      },
    });

    const totalDebt = customers.reduce((sum, c) => sum + c.currentDebt, 0);
    const customersWithDebt = customers.filter(c => c.currentDebt > 0).length;

    return {
      summary: {
        totalCustomers: customers.length,
        customersWithDebt,
        totalDebt,
        averageDebt: customersWithDebt > 0 ? totalDebt / customersWithDebt : 0,
      },
      topDebtors: customers
        .filter(c => c.currentDebt > 0)
        .sort((a, b) => b.currentDebt - a.currentDebt)
        .slice(0, 10)
        .map(c => ({
          name: c.name,
          phone: c.phone,
          currentDebt: c.currentDebt,
          openDebts: c.debts.length,
        })),
    };
  }

  async debtsReport(branchId?: string) {
    const debts = await this.prisma.debt.findMany({
      where: {
        ...(branchId && { customer: { branchId } }),
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    const pending = debts.filter(d => d.status === 'pending');
    const partial = debts.filter(d => d.status === 'partial');
    const paid = debts.filter(d => d.status === 'paid');
    const overdue = debts.filter(d => 
      d.dueDate && d.dueDate < new Date() && d.status !== 'paid'
    );

    const totalPending = pending.reduce((sum, d) => sum + d.balance, 0);
    const totalPartial = partial.reduce((sum, d) => sum + d.balance, 0);
    const totalOverdue = overdue.reduce((sum, d) => sum + d.balance, 0);

    return {
      summary: {
        totalDebts: debts.length,
        pending: { count: pending.length, total: totalPending },
        partial: { count: partial.length, total: totalPartial },
        paid: { count: paid.length },
        overdue: { count: overdue.length, total: totalOverdue },
      },
      overdueList: overdue.map(d => ({
        customer: d.customer.name,
        phone: d.customer.phone,
        amount: d.amount,
        balance: d.balance,
        dueDate: d.dueDate,
        daysOverdue: Math.floor((new Date().getTime() - d.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    };
  }

  async cashFlowReport(startDate: Date, endDate: Date, branchId?: string) {
    const sales = await this.prisma.sale.aggregate({
      where: {
        ...(branchId && { branchId }),
        status: 'closed',
        closedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { total: true },
    });

    const purchases = await this.prisma.purchase.aggregate({
      where: {
        ...(branchId && { branchId }),
        status: 'completed',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { totalCost: true },
    });

    const revenue = sales._sum.total || 0;
    const expenses = purchases._sum.totalCost || 0;
    const profit = revenue - expenses;

    return {
      period: { startDate, endDate },
      revenue,
      expenses,
      profit,
      profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  }

  async topProducts(startDate: Date, endDate: Date, branchId?: string, limit = 10) {
    const sales = await this.prisma.sale.findMany({
      where: {
        ...(branchId && { branchId }),
        status: 'closed',
        closedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Agrupar por produto
    const productStats: Record<string, { 
      name: string; 
      sku: string;
      qtyUnits: number; 
      revenue: number;
      count: number;
    }> = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            name: item.product.name,
            sku: item.product.sku,
            qtyUnits: 0,
            revenue: 0,
            count: 0,
          };
        }
        productStats[item.productId].qtyUnits += item.qtyUnits;
        productStats[item.productId].revenue += item.total;
        productStats[item.productId].count++;
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  async purchasesReport(startDate: Date, endDate: Date, branchId?: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        ...(branchId && { branchId }),
        status: 'completed',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalCost, 0);

    // Agrupar por fornecedor
    const supplierStats: Record<string, { name: string; count: number; total: number }> = {};
    purchases.forEach(purchase => {
      const supplierId = purchase.supplierId || 'sem-fornecedor';
      const supplierName = purchase.supplier?.name || 'Sem Fornecedor';
      
      if (!supplierStats[supplierId]) {
        supplierStats[supplierId] = { name: supplierName, count: 0, total: 0 };
      }
      supplierStats[supplierId].count++;
      supplierStats[supplierId].total += purchase.totalCost;
    });

    // Produtos mais comprados
    const productStats: Record<string, { 
      name: string; 
      sku: string;
      qtyUnits: number; 
      totalCost: number;
      count: number;
    }> = {};

    purchases.forEach(purchase => {
      purchase.items.forEach(item => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            name: item.product.name,
            sku: item.product.sku,
            qtyUnits: 0,
            totalCost: 0,
            count: 0,
          };
        }
        productStats[item.productId].qtyUnits += item.qtyUnits;
        productStats[item.productId].totalCost += item.totalCost;
        productStats[item.productId].count++;
      });
    });

    return {
      period: { startDate, endDate },
      summary: {
        totalPurchases,
        purchasesCount: purchases.length,
        averageTicket: purchases.length > 0 ? totalPurchases / purchases.length : 0,
      },
      suppliers: Object.values(supplierStats).sort((a, b) => b.total - a.total),
      topProducts: Object.values(productStats)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 10),
      dailyPurchases: this.groupByDatePurchases(purchases),
    };
  }

  private groupByDate(sales: any[]) {
    const grouped: Record<string, { count: number; total: number }> = {};
    
    sales.forEach(sale => {
      const date = sale.closedAt.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, total: 0 };
      }
      grouped[date].count++;
      grouped[date].total += sale.total;
    });

    return Object.entries(grouped).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  private groupByDatePurchases(purchases: any[]) {
    const grouped: Record<string, { count: number; total: number }> = {};
    
    purchases.forEach(purchase => {
      const date = purchase.completedAt.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, total: 0 };
      }
      grouped[date].count++;
      grouped[date].total += purchase.totalCost;
    });

    return Object.entries(grouped).map(([date, stats]) => ({
      date,
      ...stats,
    }));
  }

  async dashboardStats(branchId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Vendas de hoje
    const todaySales = await this.prisma.sale.aggregate({
      where: {
        ...(branchId && { branchId }),
        status: 'closed',
        closedAt: { gte: today, lt: tomorrow },
      },
      _sum: { total: true, subtotal: true },
      _count: true,
    });

    // Custos de hoje (compras)
    const todayCosts = await this.prisma.purchase.aggregate({
      where: {
        ...(branchId && { branchId }),
        status: 'completed',
        completedAt: { gte: today, lt: tomorrow },
      },
      _sum: { totalCost: true },
    });

    const todaySalesTotal = todaySales._sum.total || 0;
    const todaySubtotal = todaySales._sum.subtotal || 0;
    const todayCostsTotal = todayCosts._sum.totalCost || 0;
    const todayProfit = todaySalesTotal - todayCostsTotal;
    const todayMargin = todaySalesTotal > 0 ? (todayProfit / todaySalesTotal) * 100 : 0;

    // Faturamento semanal
    const weekRevenue = await this.prisma.sale.aggregate({
      where: {
        ...(branchId && { branchId }),
        status: 'closed',
        closedAt: { gte: weekStart },
      },
      _sum: { total: true },
    });

    // Faturamento mensal
    const monthRevenue = await this.prisma.sale.aggregate({
      where: {
        ...(branchId && { branchId }),
        status: 'closed',
        closedAt: { gte: monthStart },
      },
      _sum: { total: true },
    });

    // Dívidas pendentes
    const debts = await this.prisma.debt.aggregate({
      where: {
        ...(branchId && { customer: { branchId } }),
        status: { in: ['pending', 'partial'] },
      },
      _sum: { balance: true },
      _count: true,
    });

    // Dívidas vencidas
    const overdueDebts = await this.prisma.debt.count({
      where: {
        ...(branchId && { customer: { branchId } }),
        status: { in: ['pending', 'partial'] },
        dueDate: { lt: today },
      },
    });

    // Estoque baixo
    const lowStockItems = await this.prisma.inventoryItem.count({
      where: {
        ...(branchId && { branchId }),
        qtyUnits: { lte: this.prisma.inventoryItem.fields.minStock },
      },
    });

    // Total de produtos
    const productsCount = await this.prisma.product.count({
      where: branchId ? { branchId } : undefined,
    });

    // Total de clientes
    const customersCount = await this.prisma.customer.count({
      where: branchId ? { branchId } : undefined,
    });

    return {
      todaySales: todaySalesTotal,
      todayProfit,
      todayMargin,
      todaySalesCount: todaySales._count,
      weekRevenue: weekRevenue._sum.total || 0,
      monthRevenue: monthRevenue._sum.total || 0,
      pendingDebts: debts._sum.balance || 0,
      pendingDebtsCount: debts._count,
      overdueDebts,
      lowStockCount: lowStockItems,
      productsCount,
      customersCount,
    };
  }
}
