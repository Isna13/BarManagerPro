import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TablesService } from '../tables/tables.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controller separado para table-sessions
 * Evita conflito de roteamento com /tables/:id
 */
@Controller('table-sessions')
@UseGuards(JwtAuthGuard)
export class TableSessionsController {
  constructor(private tablesService: TablesService) {}

  @Get()
  findAllSessions(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('updatedAfter') updatedAfter?: string
  ) {
    console.log('[TableSessions] GET /table-sessions - branchId:', branchId, 'status:', status, 'updatedAfter:', updatedAfter);
    return this.tablesService.findAllSessions(branchId, status, updatedAfter);
  }
}
