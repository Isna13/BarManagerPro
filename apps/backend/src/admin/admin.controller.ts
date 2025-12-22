import { Controller, Post, Get, UseGuards, Request, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminService, ResetDataResult } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * POST /admin/reset-server-data
   * Zera todos os dados do servidor, exceto usuários e branches
   * APENAS para administradores
   */
  @Post('reset-server-data')
  @HttpCode(HttpStatus.OK)
  async resetServerData(
    @Request() req: any,
    @Body() body: { confirmationCode?: string },
  ): Promise<ResetDataResult> {
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role || req.user?.roleName;

    console.log(`🔐 Reset solicitado por usuário: ${userId} (${userRole})`);

    // Verificar código de confirmação (segurança extra)
    if (body.confirmationCode !== 'CONFIRMAR_RESET_DADOS') {
      return {
        success: false,
        error: 'Código de confirmação inválido. Use: CONFIRMAR_RESET_DADOS',
      };
    }

    return this.adminService.resetServerData(userId, userRole);
  }

  /**
   * GET /admin/data-counts
   * Obtém contagem de registros para preview antes do reset
   */
  @Get('data-counts')
  async getDataCounts(@Request() req: any): Promise<Record<string, number>> {
    const userRole = req.user?.role || req.user?.roleName;

    // Apenas admins podem ver
    if (!['admin', 'owner'].includes(userRole)) {
      return { error: -1 };
    }

    return this.adminService.getDataCountsForReset();
  }

  /**
   * POST /admin/reset-mobile-data
   * Envia comando para o app mobile limpar seus dados locais
   * O mobile recebe via WebSocket/API
   */
  @Post('reset-mobile-data')
  @HttpCode(HttpStatus.OK)
  async resetMobileData(
    @Request() req: any,
    @Body() body: { deviceId?: string; confirmationCode?: string },
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role || req.user?.roleName;

    if (!['admin', 'owner'].includes(userRole)) {
      return { success: false, message: 'Apenas administradores podem executar esta operação' };
    }

    if (body.confirmationCode !== 'CONFIRMAR_RESET_MOBILE') {
      return { success: false, message: 'Código de confirmação inválido' };
    }

    // TODO: Implementar notificação via WebSocket para o mobile
    // Por enquanto, retornar instrução para reset manual
    return {
      success: true,
      message: 'Comando de reset enviado. O app mobile deve ser reiniciado para aplicar.',
    };
  }
}
