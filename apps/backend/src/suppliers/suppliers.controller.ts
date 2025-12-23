import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  findAll(
    @Query('branchId') branchId?: string,
    @Query('active') active?: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    // 🔴 CORREÇÃO: Por padrão, retornar apenas fornecedores ativos
    let activeFilter: boolean | undefined;
    
    if (includeInactive === 'true') {
      activeFilter = undefined; // Retornar todos
    } else if (active === 'false') {
      activeFilter = false; // Explicitamente pediu inativos
    } else {
      activeFilter = true; // Padrão: apenas ativos
    }
    
    return this.suppliersService.findAll(branchId, activeFilter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateDto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.suppliersService.delete(id);
  }

  @Get(':id/purchases')
  getPurchases(@Param('id') id: string) {
    return this.suppliersService.getPurchases(id);
  }
}
