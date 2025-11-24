import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupService } from './backup.service';
import { Response } from 'express';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  createBackup(@Request() req) {
    return this.backupService.createBackup(req.user.userId);
  }

  @Get('list')
  listBackups() {
    return this.backupService.listBackups();
  }

  @Get('download/:filename')
  async downloadBackup(@Res() res: Response) {
    const { filepath, filename } = await this.backupService.getLatestBackup();
    res.download(filepath, filename);
  }

  @Post('restore/:filename')
  restoreBackup(@Request() req) {
    // Implement restore logic - requires careful transaction handling
    return { message: 'Restore functionality - implement with caution' };
  }

  @Get('auto-backup-status')
  getAutoBackupStatus() {
    return this.backupService.getAutoBackupStatus();
  }
}
