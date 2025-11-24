import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  create(@Body() createAuditDto: CreateAuditDto, @Request() req) {
    createAuditDto.ipAddress = req.ip;
    return this.auditService.create(createAuditDto);
  }

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.findAll({
      userId,
      action,
      entity,
      startDate,
      endDate,
    });
  }

  @Get('user/:userId')
  getUserAudit(@Param('userId') userId: string) {
    return this.auditService.getUserAudit(userId);
  }

  @Get('entity/:entity/:entityId')
  getEntityAudit(@Param('entity') entity: string, @Param('entityId') entityId: string) {
    return this.auditService.getEntityAudit(entity, entityId);
  }

  @Get('stats')
  getAuditStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAuditStats(startDate, endDate);
  }
}
