import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  create(@Body() createDto: CreateCustomerDto) {
    return this.customersService.create(createDto);
  }

  @Get()
  findAll(@Query('branchId') branchId?: string, @Query('search') search?: string) {
    return this.customersService.findAll(branchId, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateDto);
  }

  @Get(':id/debts')
  getDebts(@Param('id') id: string) {
    return this.customersService.getDebts(id);
  }

  @Get(':id/purchase-history')
  getPurchaseHistory(@Param('id') id: string) {
    return this.customersService.getPurchaseHistory(id);
  }
}
