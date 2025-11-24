import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Post()
  create(@Body() createDto: CreateBranchDto) {
    return this.branchesService.create(createDto);
  }

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateBranchDto) {
    return this.branchesService.update(id, updateDto);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.branchesService.getStats(id);
  }
}
