import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Post()
  create(@Body() createDto: CreateSupplierDto) {
    return this.suppliersService.create(createDto);
  }

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.suppliersService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateDto);
  }

  @Get(':id/purchases')
  getPurchases(@Param('id') id: string) {
    return this.suppliersService.getPurchases(id);
  }
}
