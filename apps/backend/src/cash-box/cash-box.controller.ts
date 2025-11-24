import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CashBoxService } from './cash-box.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpenCashBoxDto, CloseCashBoxDto, AddTransactionDto } from './dto';
import { User } from '../auth/decorators/user.decorator';

@Controller('cash-box')
@UseGuards(JwtAuthGuard)
export class CashBoxController {
  constructor(private cashBoxService: CashBoxService) {}

  @Post('open')
  openCashBox(@Body() openDto: OpenCashBoxDto, @User() user: any) {
    return this.cashBoxService.openCashBox(openDto, user.id);
  }

  @Post(':id/close')
  closeCashBox(
    @Param('id') id: string,
    @Body() closeDto: CloseCashBoxDto
  ) {
    return this.cashBoxService.closeCashBox(id, closeDto);
  }

  @Post(':id/transaction')
  addTransaction(
    @Param('id') id: string,
    @Body() transactionDto: AddTransactionDto
  ) {
    return this.cashBoxService.addTransaction(id, transactionDto);
  }

  @Get('current/:branchId')
  getCurrentCashBox(@Param('branchId') branchId: string) {
    return this.cashBoxService.getCurrentCashBox(branchId);
  }

  @Get('history/:branchId')
  getHistory(
    @Param('branchId') branchId: string,
    @Query('limit') limit?: string
  ) {
    return this.cashBoxService.getHistory(branchId, limit ? parseInt(limit) : 30);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashBoxService.findOne(id);
  }
}
