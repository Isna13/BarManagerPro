import { DatabaseManager } from '../database/manager';
import { BrowserWindow } from 'electron';
export declare class SyncManager {
    private dbManager;
    private apiUrl;
    private apiClient;
    private syncInterval;
    private isRunning;
    private token;
    private lastSync;
    private mainWindow;
    private lastCredentials;
    constructor(dbManager: DatabaseManager, apiUrl: string);
    setMainWindow(window: BrowserWindow): void;
    private emit;
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
    private getEndpoint;
    forcePush(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        pendingItems: number;
        lastSync: Date | null;
        isOnline: boolean;
    };
    checkConnection(): Promise<boolean>;
    /**
     * Tenta reautenticar com as últimas credenciais quando reconectar
     * Usado para converter token offline para token válido
     */
    tryReauthenticate(retries?: number): Promise<boolean>;
}
//# sourceMappingURL=manager.d.ts.map