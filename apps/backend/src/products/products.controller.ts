import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProductDto, UpdateProductDto } from './dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  create(@Body() createDto: CreateProductDto) {
    return this.productsService.create(createDto);
  }

  @Get()
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    // 🔴 CORREÇÃO CRÍTICA: Por padrão, retornar apenas produtos ativos
    // - Sem parâmetros: isActive = true (padrão seguro)
    // - active=true: isActive = true
    // - active=false: isActive = false (para ver produtos deletados)
    // - includeInactive=true: sem filtro de isActive (para admin/sync)
    let activeFilter: boolean | undefined;
    
    if (includeInactive === 'true') {
      // Retornar todos os produtos (ativos e inativos)
      activeFilter = undefined;
    } else if (active === 'false') {
      // Explicitamente pediu apenas inativos
      activeFilter = false;
    } else {
      // Padrão: apenas produtos ativos
      activeFilter = true;
    }
    
    const products = await this.productsService.findAll(categoryId, search, activeFilter);
    
    // 🔍 LOG DIAGNÓSTICO: Ajuda a entender 200 0b
    console.log(`[Products] GET /products - activeFilter: ${activeFilter}, resultCount: ${products.length}`);
    
    return products;
  }

  @Get('categories')
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateProductDto) {
    return this.productsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get(':id/price-history')
  getPriceHistory(@Param('id') id: string) {
    return this.productsService.getPriceHistory(id);
  }
}
