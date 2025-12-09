import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddStockDto, TransferStockDto, AdjustStockDto, AdjustStockByProductDto } from './dto';

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Get('product/:productId')
  findByProduct(
    @Param('productId') productId: string,
    @Query('branchId') branchId?: string
  ) {
    return this.inventoryService.findByProduct(productId, branchId);
  }

  @Post('add-stock')
  addStock(@Body() addStockDto: AddStockDto) {
    return this.inventoryService.addStock(addStockDto);
  }

  @Post('transfer')
  transferStock(@Body() transferDto: TransferStockDto) {
    return this.inventoryService.transferStock(transferDto);
  }

  @Put('adjust')
  adjustStock(@Body() adjustDto: AdjustStockDto) {
    return this.inventoryService.adjustStock(adjustDto);
  }

  @Put('adjust-by-product')
  adjustStockByProduct(@Body() adjustDto: AdjustStockByProductDto) {
    return this.inventoryService.adjustStockByProduct(adjustDto);
  }

  @Get('movements/:inventoryItemId')
  getMovements(@Param('inventoryItemId') inventoryItemId: string) {
    return this.inventoryService.getMovements(inventoryItemId);
  }

  @Get('low-stock/:branchId')
  getLowStock(@Param('branchId') branchId: string) {
    return this.inventoryService.getLowStock(branchId);
  }
}
