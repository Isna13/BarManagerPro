import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, AddSaleItemDto, ProcessPaymentDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() createSaleDto: CreateSaleDto, @Request() req) {
    return this.salesService.create(createSaleDto, req.user.id);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() addItemDto: AddSaleItemDto) {
    return this.salesService.addItem(id, addItemDto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.salesService.removeItem(id);
  }

  @Post(':id/payments')
  processPayment(
    @Param('id') id: string,
    @Body() paymentDto: ProcessPaymentDto,
    @Request() req,
  ) {
    return this.salesService.processPayment(id, paymentDto, req.user.id);
  }

  @Post(':id/close')
  closeSale(@Param('id') id: string) {
    return this.salesService.closeSale(id);
  }

  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.salesService.findAll(branchId, status, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      customerId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }
}
