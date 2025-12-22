import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Request,
  Res,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupService, BackupData } from './backup.service';
import { Response } from 'express';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * POST /backup/create
   * Cria um backup completo e salva no servidor
   */
  @Post('create')
  @HttpCode(HttpStatus.OK)
  async createBackup(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.backupService.createFullBackup(userId);
  }

  /**
   * POST /backup/download
   * Gera um backup e retorna como JSON para download
   */
  @Post('download')
  @HttpCode(HttpStatus.OK)
  async downloadBackup(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    const result = await this.backupService.createFullBackup(userId);
    return result.data;
  }

  /**
   * POST /backup/restore
   * Restaura um backup a partir dos dados enviados
   * ATENÇÃO: Operação destrutiva - apaga dados existentes
   */
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  async restoreBackup(
    @Request() req: any,
    @Body() body: { backupData: BackupData; confirmationCode: string },
  ) {
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role || req.user?.roleName;

    // Verificar código de confirmação
    if (body.confirmationCode !== 'CONFIRMAR_RESTAURACAO') {
      return {
        success: false,
        message: 'Código de confirmação inválido. Use: CONFIRMAR_RESTAURACAO',
      };
    }

    return this.backupService.restoreBackup(body.backupData, userId, userRole);
  }

  /**
   * GET /backup/list
   * Lista todos os backups salvos no servidor
   */
  @Get('list')
  listBackups() {
    return this.backupService.listBackups();
  }

  /**
   * GET /backup/status
   * Retorna o status atual do sistema de backup
   */
  @Get('status')
  getStatus() {
    return this.backupService.getBackupStatus();
  }

  /**
   * GET /backup/file/:filename
   * Baixa um arquivo de backup específico do servidor
   */
  @Get('file/:filename')
  async getBackupFile(@Param('filename') filename: string, @Res() res: Response) {
    const { filepath } = await this.backupService.downloadBackup(filename);
    res.download(filepath, filename);
  }

  /**
   * DELETE /backup/:filename
   * Deleta um backup do servidor
   */
  @Delete(':filename')
  @HttpCode(HttpStatus.OK)
  async deleteBackup(@Param('filename') filename: string) {
    await this.backupService.deleteBackup(filename);
    return { success: true, message: `Backup ${filename} deletado` };
  }

  /**
   * GET /backup/auto-backup-status
   * Status do backup automático
   */
  @Get('auto-backup-status')
  getAutoBackupStatus() {
    return this.backupService.getAutoBackupStatus();
  }
}
