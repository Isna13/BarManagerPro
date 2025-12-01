import { DatabaseManager } from '../database/manager';
import { BrowserWindow } from 'electron';
export declare class SyncManager {
    private dbManager;
    private apiUrl;
    private apiClient;
    private syncInterval;
    private connectionCheckInterval;
    private isRunning;
    private token;
    private lastSync;
    private mainWindow;
    private lastCredentials;
    private _isOnline;
    private _connectionCheckInProgress;
    constructor(dbManager: DatabaseManager, apiUrl: string);
    setMainWindow(window: BrowserWindow): void;
    private emit;
    /**
     * Verifica se o banco local está vazio ou precisa de sincronização inicial
     */
    isLocalDatabaseEmpty(): boolean;
    /**
     * Faz download completo de todos os dados do Railway para o banco local
     * Usado quando: novo dispositivo, banco local vazio, ou sync inicial
     */
    fullPullFromServer(): Promise<{
        success: boolean;
        stats: Record<string, number>;
    }>;
    /**
     * Inicia verificação periódica de conexão
     */
    startConnectionMonitor(): void;
    stopConnectionMonitor(): void;
    private updateConnectionStatus;
    get isOnline(): boolean;
    login(credentials: {
        email: string;
        password: string;
    }): Promise<any>;
    logout(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    syncNow(): Promise<void>;
    private pushLocalChanges;
    private pullServerChanges;
    /**
     * Mescla dados recebidos do servidor com dados locais
     * Estratégia: servidor tem prioridade, mas não apaga dados locais não sincronizados
     */
    private mergeEntityData;
    /**
     * Sincroniza um item individual, tratando casos especiais de entidades aninhadas
     */
    private syncEntityItem;
    private getEndpoint;
    forcePush(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        pendingItems: number;
        lastSync: Date | null;
        isOnline: boolean;
        hasValidToken: boolean;
    };
    checkConnection(): Promise<boolean>;
    /**
     * Tenta reautenticar com as últimas credenciais quando reconectar
     * Usado para converter token offline para token válido
     */
    tryReauthenticate(retries?: number): Promise<boolean>;
    /**
     * Push inicial completo - envia TODOS os dados existentes no SQLite para o servidor
     * Use esta função quando precisar sincronizar dados que já existiam antes do sistema de sync
     */
    pushFullInitialSync(): Promise<{
        success: boolean;
        summary: Record<string, {
            sent: number;
            errors: number;
        }>;
    }>;
    /**
     * Prepara os dados de uma entidade para envio ao servidor
     * Mapeia campos do SQLite para o formato esperado pelo backend
     */
    private prepareDataForSync;
}
//# sourceMappingURL=manager.d.ts.map