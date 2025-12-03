import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch } from '@nestjs/common';
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
    return this.cashBoxService.openCashBox(openDto, user.userId);
  }

  @Post(':id/close')
  closeCashBox(
    @Param('id') id: string,
    @Body() closeDto: CloseCashBoxDto
  ) {
    return this.cashBoxService.closeCashBox(id, closeDto);
  }

  // Endpoint para forçar fechamento de caixa (admin)
  @Patch(':id/force-close')
  forceCloseCashBox(@Param('id') id: string) {
    return this.cashBoxService.forceCloseCashBox(id);
  }

  // Endpoint para corrigir caixas fechados sem closedAt
  @Post('fix-closed-at')
  fixClosedAt() {
    return this.cashBoxService.fixClosedAtForClosedBoxes();
  }

  @Post(':id/transaction')
  addTransaction(
    @Param('id') id: string,
    @Body() transactionDto: AddTransactionDto
  ) {
    return this.cashBoxService.addTransaction(id, transactionDto);
  }

  // Endpoint para obter movimentações do caixa
  @Get('movements')
  getMovements(
    @Query('cashBoxId') cashBoxId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cashBoxService.getMovements(
      cashBoxId,
      limit ? parseInt(limit) : 50,
    );
  }

  // Endpoint sem branchId (retorna o primeiro caixa aberto)
  @Get('current')
  getCurrentCashBoxAny(@User() user: any) {
    return this.cashBoxService.getCurrentCashBoxForUser(user.userId);
  }

  @Get('current/:branchId')
  getCurrentCashBox(@Param('branchId') branchId: string) {
    return this.cashBoxService.getCurrentCashBox(branchId);
  }

  // Endpoint de histórico sem branchId
  @Get('history')
  getHistoryAll(@Query('limit') limit?: string) {
    return this.cashBoxService.getHistoryAll(limit ? parseInt(limit) : 30);
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
