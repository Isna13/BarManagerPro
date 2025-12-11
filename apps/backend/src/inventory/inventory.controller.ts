import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddStockDto, TransferStockDto, AdjustStockDto, AdjustStockByProductDto, UpsertInventoryItemDto } from './dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.inventoryService.findAll(branchId);
  }

  @Get('movements')
  getAllMovements(
    @Query('productId') productId?: string,
    @Query('movementType') movementType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getAllMovements({
      productId,
      movementType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // Endpoint para criar/sincronizar item de inventário
  @Post()
  createOrUpdateItem(@Body() upsertDto: UpsertInventoryItemDto) {
    return this.inventoryService.upsertInventoryItem(upsertDto);
  }

  @Post('add-stock')
  addStock(@Body() addStockDto: AddStockDto) {
    return this.inventoryService.addStock(addStockDto);
  }

  @Post('transfer')
  transferStock(@Body() transferDto: TransferStockDto) {
    return this.inventoryService.transferStock(transferDto);
  }

  // IMPORTANTE: Rotas específicas PUT devem vir ANTES de PUT :id
  @Put('adjust')
  adjustStock(@Body() adjustDto: AdjustStockDto) {
    return this.inventoryService.adjustStock(adjustDto);
  }

  @Put('adjust-by-product')
  adjustStockByProduct(@Body() adjustDto: AdjustStockByProductDto) {
    return this.inventoryService.adjustStockByProduct(adjustDto);
  }

  // Endpoint para atualizar item de inventário por ID (deve vir DEPOIS das rotas específicas)
  @Put(':id')
  updateItem(@Param('id') id: string, @Body() upsertDto: UpsertInventoryItemDto) {
    return this.inventoryService.upsertInventoryItem({ ...upsertDto, id });
  }

  // IMPORTANTE: Rotas específicas GET devem vir ANTES de GET :id
  @Get('product/:productId')
  findByProduct(
    @Param('productId') productId: string,
    @Query('branchId') branchId?: string
  ) {
    return this.inventoryService.findByProduct(productId, branchId);
  }

  @Get('movements/:inventoryItemId')
  getMovements(@Param('inventoryItemId') inventoryItemId: string) {
    return this.inventoryService.getMovements(inventoryItemId);
  }

  @Get('low-stock/:branchId')
  getLowStock(@Param('branchId') branchId: string) {
    return this.inventoryService.getLowStock(branchId);
  }

  // Rotas com :id devem vir por último
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Delete(':id')
  deleteItem(@Param('id') id: string) {
    return this.inventoryService.deleteItem(id);
  }
}
