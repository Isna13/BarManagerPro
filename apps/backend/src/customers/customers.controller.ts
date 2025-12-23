import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  findAll(
    @Query('branchId') branchId?: string, 
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    // 🔴 CORREÇÃO: Por padrão, retornar apenas clientes ativos
    let activeFilter: boolean | undefined;
    
    if (includeInactive === 'true') {
      activeFilter = undefined; // Retornar todos
    } else if (active === 'false') {
      activeFilter = false; // Explicitamente pediu inativos
    } else {
      activeFilter = true; // Padrão: apenas ativos
    }
    
    return this.customersService.findAll(branchId, search, activeFilter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
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
