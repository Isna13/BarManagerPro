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

  @Get('overview/:branchId')
  getOverview(@Param('branchId') branchId: string) {
    return this.tablesService.getTablesOverview(branchId);
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

  // ==================== SESSÕES ====================

  @Get('sessions')
  findAllSessions(
    @Query('branchId') branchId?: string, 
    @Query('status') status?: string,
    @Query('updatedAfter') updatedAfter?: string
  ) {
    return this.tablesService.findAllSessions(branchId, status, updatedAfter);
  }

  @Post('sessions/open')
  openSession(
    @Body()
    data: {
      tableId: string;
      branchId: string;
      openedBy: string;
      sessionId?: string;
      id?: string;
    },
  ) {
    return this.tablesService.openSession(
      data.tableId,
      data.branchId,
      data.openedBy,
      data.sessionId ?? data.id,
    );
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.tablesService.getSession(sessionId);
  }

  @Post('sessions/close')
  closeSession(@Body() data: { sessionId: string; closedBy: string }) {
    return this.tablesService.closeSession(data.sessionId, data.closedBy);
  }

  @Post('sessions/transfer')
  transferSession(@Body() data: { sessionId: string; toTableId: string; transferredBy: string }) {
    return this.tablesService.transferSession(data.sessionId, data.toTableId, data.transferredBy);
  }

  @Post('sessions/transfer-customers')
  transferCustomers(@Body() data: { sessionId: string; customerIds: string[]; toTableId: string; transferredBy: string }) {
    return this.tablesService.transferCustomers(data.sessionId, data.customerIds, data.toTableId, data.transferredBy);
  }

  @Post('sessions/merge')
  mergeSessions(@Body() data: { sessionIds: string[]; targetTableId: string; mergedBy: string }) {
    return this.tablesService.mergeSessions(data.sessionIds, data.targetTableId, data.mergedBy);
  }

  @Post('sessions/split')
  splitSession(@Body() data: { sessionId: string; distributions: { customerId: string; targetTableId: string }[]; splitBy: string }) {
    return this.tablesService.splitSession(data.sessionId, data.distributions, data.splitBy);
  }

  @Get('sessions/:sessionId/actions')
  getSessionHistory(@Param('sessionId') sessionId: string) {
    return this.tablesService.getSessionHistory(sessionId);
  }

  // ==================== CLIENTES ====================

  @Post('customers/add')
  addCustomer(
    @Body()
    data: {
      sessionId: string;
      customerName: string;
      customerId?: string;
      addedBy: string;
      tableCustomerId?: string;
      id?: string;
    },
  ) {
    return this.tablesService.addCustomer(
      data.sessionId,
      data.customerName,
      data.customerId,
      data.addedBy,
      data.tableCustomerId ?? data.id,
    );
  }

  // ==================== PEDIDOS ====================

  @Post('orders/add')
  addOrder(@Body() data: { 
    sessionId: string; 
    tableCustomerId: string; 
    productId: string; 
    qtyUnits: number; 
    isMuntu: boolean; 
    orderedBy: string;
    orderId?: string;
    id?: string;
  }) {
    return this.tablesService.addOrder(
      data.sessionId, 
      data.tableCustomerId, 
      data.productId, 
      data.qtyUnits, 
      data.isMuntu, 
      data.orderedBy,
      data.orderId ?? data.id,
    );
  }

  @Post('orders/cancel')
  cancelOrder(@Body() data: { orderId: string; cancelledBy: string }) {
    return this.tablesService.cancelOrder(data.orderId, data.cancelledBy);
  }

  @Post('orders/transfer')
  transferOrder(@Body() data: { 
    orderId: string; 
    fromCustomerId: string; 
    toCustomerId: string; 
    qtyUnits: number; 
    transferredBy: string 
  }) {
    return this.tablesService.transferOrder(
      data.orderId, 
      data.fromCustomerId, 
      data.toCustomerId, 
      data.qtyUnits, 
      data.transferredBy
    );
  }

  // ==================== PAGAMENTOS ====================

  @Post('payments/customer')
  processCustomerPayment(@Body() data: { 
    sessionId: string; 
    tableCustomerId: string; 
    method: string; 
    amount: number; 
    processedBy: string 
  }) {
    return this.tablesService.processPayment(
      data.sessionId, 
      data.tableCustomerId, 
      data.method, 
      data.amount, 
      data.processedBy,
      false
    );
  }

  @Post('payments/session')
  processSessionPayment(@Body() data: { 
    sessionId: string; 
    method: string; 
    amount: number; 
    processedBy: string 
  }) {
    return this.tablesService.processPayment(
      data.sessionId, 
      null, 
      data.method, 
      data.amount, 
      data.processedBy,
      true
    );
  }

  @Post('payments/clear-paid-orders')
  clearPaidOrders(@Body() data: { sessionId: string; tableCustomerId: string; clearedBy: string }) {
    return this.tablesService.clearPaidOrders(data.sessionId, data.tableCustomerId, data.clearedBy);
  }
}
