import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QrMenuService } from './qr-menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';

@Controller('qr-menu')
export class QrMenuController {
  constructor(private readonly qrMenuService: QrMenuService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createMenuDto: CreateMenuDto) {
    return this.qrMenuService.create(createMenuDto);
  }

  @Get()
  findAll() {
    return this.qrMenuService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.qrMenuService.findOne(id);
  }

  @Get('branch/:branchId')
  getMenuByBranch(@Param('branchId') branchId: string) {
    return this.qrMenuService.getMenuByBranch(branchId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateMenuDto: CreateMenuDto) {
    return this.qrMenuService.update(id, updateMenuDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.qrMenuService.remove(id);
  }

  @Get(':id/qr-code')
  generateQRCode(@Param('id') id: string) {
    return this.qrMenuService.generateQRCode(id);
  }
}
