"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Gerenciador de Backup Automático do SQLite
 *
 * Funcionalidades:
 * - Backup automático a cada 4 horas
 * - Backup antes de atualizações
 * - Retenção de últimos 7 backups
 * - Restauração de backup
 */
class BackupManager {
    constructor(dbPath) {
        this.backupInterval = null;
        this.maxBackups = 7; // Manter últimos 7 backups
        this.intervalHours = 4; // Backup a cada 4 horas
        this.dbPath = dbPath;
        // Diretório de backups ao lado do banco
        this.backupDir = path.join(path.dirname(dbPath), 'backups');
        // Criar diretório de backups se não existir
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log('📁 Diretório de backups criado:', this.backupDir);
        }
    }
    /**
     * Inicia o backup automático periódico
     */
    startAutoBackup() {
        // Fazer backup inicial na inicialização
        this.createBackup('startup');
        // Configurar intervalo de backup
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        this.backupInterval = setInterval(() => {
            this.createBackup('scheduled');
        }, intervalMs);
        console.log(`🔄 Backup automático iniciado (a cada ${this.intervalHours} horas)`);
    }
    /**
     * Para o backup automático
     */
    stopAutoBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            console.log('⏹️ Backup automático parado');
        }
    }
    /**
     * Cria um backup do banco de dados
     * @param reason - Motivo do backup (startup, scheduled, manual, pre-update)
     * @returns Caminho do arquivo de backup ou null em caso de erro
     */
    createBackup(reason) {
        try {
            // Verificar se o banco existe
            if (!fs.existsSync(this.dbPath)) {
                console.warn('⚠️ Banco de dados não encontrado para backup:', this.dbPath);
                return null;
            }
            // Gerar nome do arquivo com timestamp
            const timestamp = new Date().toISOString()
                .replace(/:/g, '-')
                .replace(/\..+/, '');
            const backupFileName = `barmanager_${reason}_${timestamp}.db`;
            const backupPath = path.join(this.backupDir, backupFileName);
            // Copiar o arquivo do banco
            fs.copyFileSync(this.dbPath, backupPath);
            // Também copiar o WAL se existir (importante para integridade)
            const walPath = this.dbPath + '-wal';
            if (fs.existsSync(walPath)) {
                fs.copyFileSync(walPath, backupPath + '-wal');
            }
            // Copiar SHM se existir
            const shmPath = this.dbPath + '-shm';
            if (fs.existsSync(shmPath)) {
                fs.copyFileSync(shmPath, backupPath + '-shm');
            }
            console.log(`✅ Backup criado: ${backupFileName} (${reason})`);
            // Limpar backups antigos
            this.cleanupOldBackups();
            return backupPath;
        }
        catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            return null;
        }
    }
    /**
     * Remove backups antigos, mantendo apenas os últimos N
     */
    cleanupOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith('barmanager_') && f.endsWith('.db'))
                .map(f => ({
                name: f,
                path: path.join(this.backupDir, f),
                time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
            }))
                .sort((a, b) => b.time - a.time); // Mais recentes primeiro
            // Remover backups além do limite
            const toDelete = files.slice(this.maxBackups);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
                // Remover WAL e SHM associados se existirem
                const walPath = file.path + '-wal';
                const shmPath = file.path + '-shm';
                if (fs.existsSync(walPath))
                    fs.unlinkSync(walPath);
                if (fs.existsSync(shmPath))
                    fs.unlinkSync(shmPath);
                console.log(`🗑️ Backup antigo removido: ${file.name}`);
            }
        }
        catch (error) {
            console.error('⚠️ Erro ao limpar backups antigos:', error);
        }
    }
    /**
     * Lista todos os backups disponíveis
     */
    listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith('barmanager_') && f.endsWith('.db'))
                .map(f => {
                const filePath = path.join(this.backupDir, f);
                const stats = fs.statSync(filePath);
                // Extrair reason do nome do arquivo
                const match = f.match(/barmanager_(\w+)_/);
                const reason = match ? match[1] : 'unknown';
                return {
                    name: f,
                    path: filePath,
                    size: stats.size,
                    date: stats.mtime,
                    reason
                };
            })
                .sort((a, b) => b.date.getTime() - a.date.getTime());
            return files;
        }
        catch (error) {
            console.error('❌ Erro ao listar backups:', error);
            return [];
        }
    }
    /**
     * Restaura um backup específico
     * @param backupPath - Caminho do backup a restaurar
     * @returns true se restaurado com sucesso
     */
    restoreBackup(backupPath) {
        try {
            if (!fs.existsSync(backupPath)) {
                console.error('❌ Arquivo de backup não encontrado:', backupPath);
                return false;
            }
            // Criar backup do estado atual antes de restaurar
            this.createBackup('pre-update');
            // Copiar backup para substituir o banco atual
            fs.copyFileSync(backupPath, this.dbPath);
            // Restaurar WAL se existir no backup
            const walPath = backupPath + '-wal';
            if (fs.existsSync(walPath)) {
                fs.copyFileSync(walPath, this.dbPath + '-wal');
            }
            else {
                // Remover WAL atual se backup não tem
                const currentWal = this.dbPath + '-wal';
                if (fs.existsSync(currentWal))
                    fs.unlinkSync(currentWal);
            }
            // Restaurar SHM se existir no backup
            const shmPath = backupPath + '-shm';
            if (fs.existsSync(shmPath)) {
                fs.copyFileSync(shmPath, this.dbPath + '-shm');
            }
            else {
                const currentShm = this.dbPath + '-shm';
                if (fs.existsSync(currentShm))
                    fs.unlinkSync(currentShm);
            }
            console.log(`✅ Backup restaurado: ${path.basename(backupPath)}`);
            return true;
        }
        catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            return false;
        }
    }
    /**
     * Retorna estatísticas dos backups
     */
    getStats() {
        const backups = this.listBackups();
        const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
        const lastBackup = backups.length > 0 ? backups[0].date : null;
        return {
            totalBackups: backups.length,
            totalSize,
            lastBackup,
            backupDir: this.backupDir
        };
    }
}
exports.BackupManager = BackupManager;
//# sourceMappingURL=manager.js.map