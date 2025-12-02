import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TablesService } from './tables.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTableDto, UpdateTableDto } from './dto';

@Controller('tables')
@UseGuards(JwtAuthGuard)
export class TablesController {
  constructor(private tablesService: TablesService) {}

  @Post()
  create(@Body() createDto: CreateTableDto) {
    console.log('📋 Criando mesa:', createDto);
    return this.tablesService.create(createDto);
  }

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.tablesService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.tablesService.getTableStatus(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateTableDto) {
    return this.tablesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tablesService.remove(id);
  }
}
