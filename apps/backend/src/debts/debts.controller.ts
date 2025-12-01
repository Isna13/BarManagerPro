import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DebtsService } from './debts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDebtDto, PayDebtDto } from './dto';
import { User } from '../auth/decorators/user.decorator';

@Controller('debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private debtsService: DebtsService) {}

  @Post()
  create(@Body() createDto: CreateDebtDto, @User() user: any) {
    return this.debtsService.create(createDto, user.userId);
  }

  @Post(':id/pay')
  payDebt(@Param('id') id: string, @Body() payDto: PayDebtDto) {
    return this.debtsService.payDebt(id, payDto);
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.debtsService.findAll(status);
  }

  @Get('customer/:customerId')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.debtsService.findByCustomer(customerId);
  }

  @Get('overdue')
  getOverdue() {
    return this.debtsService.getOverdue();
  }

  @Get('summary')
  getSummary() {
    return this.debtsService.getSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debtsService.findOne(id);
  }
}
