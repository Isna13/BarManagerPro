import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('sales')
  salesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.salesReport(
      new Date(startDate),
      new Date(endDate),
      branchId
    );
  }

  @Get('inventory')
  inventoryReport(@Query('branchId') branchId?: string) {
    return this.reportsService.inventoryReport(branchId);
  }

  @Get('customers')
  customersReport(@Query('branchId') branchId?: string) {
    return this.reportsService.customersReport(branchId);
  }

  @Get('debts')
  debtsReport(@Query('branchId') branchId?: string) {
    return this.reportsService.debtsReport(branchId);
  }

  @Get('cash-flow')
  cashFlowReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.cashFlowReport(
      new Date(startDate),
      new Date(endDate),
      branchId
    );
  }

  @Get('top-products')
  topProducts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string
  ) {
    return this.reportsService.topProducts(
      new Date(startDate),
      new Date(endDate),
      branchId,
      limit ? parseInt(limit) : 10
    );
  }

  @Get('purchases')
  purchasesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string
  ) {
    return this.reportsService.purchasesReport(
      new Date(startDate),
      new Date(endDate),
      branchId
    );
  }

  @Get('dashboard')
  async dashboardStats(@Query('branchId') branchId?: string) {
    return this.reportsService.dashboardStats(branchId);
  }
}
