import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  create(@Body() createDto: CreateCategoryDto) {
    return this.categoriesService.create(createDto);
  }

  @Get()
  findAll(
    @Query('parentId') parentId?: string,
    @Query('active') active?: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    // 🔴 CORREÇÃO: Por padrão, retornar apenas categorias ativas
    let activeFilter: boolean | undefined;
    
    if (includeInactive === 'true') {
      activeFilter = undefined; // Retornar todas
    } else if (active === 'false') {
      activeFilter = false; // Explicitamente pediu inativos
    } else {
      activeFilter = true; // Padrão: apenas ativas
    }
    
    return this.categoriesService.findAll(
      parentId === 'null' ? null : parentId,
      activeFilter
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
