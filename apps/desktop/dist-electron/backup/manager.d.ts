/**
 * Gerenciador de Backup Automático do SQLite
 *
 * Funcionalidades:
 * - Backup automático a cada 4 horas
 * - Backup antes de atualizações
 * - Retenção de últimos 7 backups
 * - Restauração de backup
 */
export declare class BackupManager {
    private dbPath;
    private backupDir;
    private backupInterval;
    private maxBackups;
    private intervalHours;
    constructor(dbPath: string);
    /**
     * Inicia o backup automático periódico
     */
    startAutoBackup(): void;
    /**
     * Para o backup automático
     */
    stopAutoBackup(): void;
    /**
     * Cria um backup do banco de dados
     * @param reason - Motivo do backup (startup, scheduled, manual, pre-update)
     * @returns Caminho do arquivo de backup ou null em caso de erro
     */
    createBackup(reason: 'startup' | 'scheduled' | 'manual' | 'pre-update'): string | null;
    /**
     * Remove backups antigos, mantendo apenas os últimos N
     */
    private cleanupOldBackups;
    /**
     * Lista todos os backups disponíveis
     */
    listBackups(): Array<{
        name: string;
        path: string;
        size: number;
        date: Date;
        reason: string;
    }>;
    /**
     * Restaura um backup específico
     * @param backupPath - Caminho do backup a restaurar
     * @returns true se restaurado com sucesso
     */
    restoreBackup(backupPath: string): boolean;
    /**
     * Retorna estatísticas dos backups
     */
    getStats(): {
        totalBackups: number;
        totalSize: number;
        lastBackup: Date | null;
        backupDir: string;
    };
}
//# sourceMappingURL=manager.d.ts.map