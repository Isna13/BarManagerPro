import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePurchaseDto, AddPurchaseItemDto, UpdatePurchaseDto } from './dto';
import { User } from '../auth/decorators/user.decorator';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) {}

  @Post()
  create(@Body() createDto: CreatePurchaseDto, @User() user: any) {
    return this.purchasesService.create(createDto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdatePurchaseDto) {
    return this.purchasesService.update(id, updateDto);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() itemDto: AddPurchaseItemDto) {
    return this.purchasesService.addItem(id, itemDto);
  }

  @Post(':id/complete')
  completePurchase(@Param('id') id: string) {
    return this.purchasesService.completePurchase(id);
  }

  @Get()
  findAll(@Query('branchId') branchId?: string, @Query('status') status?: string) {
    return this.purchasesService.findAll(branchId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }
}
