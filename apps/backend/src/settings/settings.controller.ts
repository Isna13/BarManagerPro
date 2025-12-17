import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Post()
  upsert(@Body() body: { key: string; value: string }) {
    return this.settingsService.upsert(body.key, body.value);
  }

  @Post('bulk')
  upsertMany(@Body() body: { settings: Array<{ key: string; value: string }> }) {
    return this.settingsService.upsertMany(body.settings);
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() body: { value: string }) {
    return this.settingsService.upsert(key, body.value);
  }

  @Delete(':key')
  delete(@Param('key') key: string) {
    return this.settingsService.delete(key);
  }
}
