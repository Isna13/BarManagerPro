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
    private _coldStartDetected;
    private _consecutiveFailures;
    private _lastSuccessfulRequest;
    private _isSyncing;
    private _pendingSyncRequested;
    private _syncDebounceTimer;
    private criticalSyncInterval;
    private _settingsSyncCounter;
    constructor(dbManager: DatabaseManager, apiUrl: string);
    setMainWindow(window: BrowserWindow): void;
    /**
     * Retorna o token de autenticação atual
     */
    getToken(): string | null;
    /**
     * Verifica se o token é válido (não é null e não é offline-token)
     */
    hasValidToken(): boolean;
    private emit;
    /**
     * Executa requisição com retry e backoff exponencial
     * Otimizado para lidar com cold starts do Railway Free Plan
     */
    private requestWithRetry;
    /**
     * Verifica se o erro indica um possível cold start do Railway
     */
    private isColdStartError;
    /**
     * Utilitário para aguardar um tempo
     */
    private sleep;
    /**
     * Retorna estatísticas do sync para monitoramento
     */
    getSyncStats(): {
        isOnline: boolean;
        isRunning: boolean;
        consecutiveFailures: number;
        coldStartDetected: boolean;
        lastSuccessfulRequest: Date | null;
        lastSync: Date | null;
        syncIntervalMs: number;
        pendingItems: any;
    };
    /**
     * Verifica se o banco local está vazio ou precisa de sincronização inicial
     * Também verifica se existe caixa aberto sincronizado
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
    /**
     * Verifica se existe um caixa aberto no servidor
     * Usado antes de permitir abertura local
     */
    checkServerCashBox(branchId: string): Promise<{
        hasOpenBox: boolean;
        serverBox: any | null;
    }>;
    /**
     * Abre caixa primeiro no servidor, depois localmente
     * GARANTE: Apenas 1 caixa aberto por branch em todo o sistema
     */
    openCashBoxWithServerCheck(data: {
        boxNumber: string;
        branchId: string;
        openedBy: string;
        openingCash: number;
        notes?: string;
    }): Promise<{
        success: boolean;
        cashBox?: any;
        error?: string;
    }>;
    /**
     * Sincroniza caixa do servidor para o banco local
     * 🔴 CORREÇÃO: Mapear TODOS os campos do servidor para evitar NaN/Invalid Date
     */
    private syncServerCashBoxToLocal;
    /**
     * Busca o caixa aberto atual, verificando servidor se online
     */
    getCurrentCashBoxWithServerCheck(branchId?: string): Promise<any>;
    start(): Promise<void>;
    /**
     * 🔴 CORREÇÃO F3: Sync de entidades críticas com polling agressivo
     * Apenas CashBox e Users - não faz push, apenas pull do servidor
     */
    private syncCriticalEntities;
    /**
     * Pull rápido de status do CashBox
     * 🔴 CORREÇÃO: Sempre atualizar dados do caixa para corrigir NaN/Invalid Date
     */
    private pullCriticalCashBoxStatus;
    /**
     * 🔴 CORREÇÃO F5: Pull de configurações globais do servidor
     * Chamado periodicamente e no sync inicial
     */
    pullGlobalSettings(): Promise<void>;
    /**
   * Pull rápido de usuários
   */
    private pullCriticalUsers;
    /**
     * 🔴 CORREÇÃO CRÍTICA: Sync imediato para vendas
     * Garante que vendas rápidas em sequência não sejam perdidas
     * Usa debounce de 500ms para agrupar vendas muito rápidas
     */
    syncSalesImmediately(): void;
    stop(): Promise<void>;
    syncNow(): Promise<void>;
    /**
     * Bulk sync - envia múltiplas vendas em uma única requisição
     * Mais eficiente para sincronizar grandes volumes de vendas offline
     */
    private bulkSyncSales;
    private pushLocalChanges;
    /**
     * Verifica se o Railway está vazio mas o banco local tem dados
     * Se sim, executa automaticamente um resync completo
     */
    private checkAndTriggerFullResyncIfNeeded;
    /**
     * Conta entidades no banco local
     */
    private getLocalEntityCounts;
    /**
     * Conta entidades no Railway
     */
    private getRailwayEntityCounts;
    /**
     * Ordena itens de sincronização por dependência
     * Entidades base devem ser sincronizadas antes de entidades que dependem delas
     */
    private sortByDependency;
    private pullServerChanges;
    /**
     * Envia confirmação (ACK) ao servidor de que os dados foram recebidos e processados
     */
    private sendAcknowledgement;
    /**
     * Envia heartbeat ao servidor com status do dispositivo
     * Chamado periodicamente para monitoramento
     */
    sendHeartbeat(): Promise<any>;
    /**
     * Busca dados genéricos do servidor (para dashboard, etc)
     * @param endpoint - Endpoint a ser chamado (ex: '/sync/dashboard')
     */
    fetchFromServer(endpoint: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    /**
     * Sincroniza apenas dívidas do servidor para o desktop
     * Usado quando a aba Dívidas é aberta para garantir dados atualizados
     */
    syncDebtsFromServer(): Promise<void>;
    /**
     * Verifica se um item local tem alterações pendentes (não sincronizadas)
     * Retorna true se o item NÃO deve ser sobrescrito pelo servidor
     *
     * 🔴 CORREÇÃO CRÍTICA: Usa timestamp para resolver conflitos
     * Se o servidor tem dados mais recentes (de outro dispositivo), aceita do servidor
     */
    private hasLocalPendingChanges;
    /**
     * FASE 3: Registra conflito se os dados locais e do servidor são diferentes
     */
    private registerConflictIfNeeded;
    /**
     * Mescla dados recebidos do servidor com dados locais
     * Estratégia: servidor tem prioridade, MAS respeita alterações locais não sincronizadas
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
        pendingItems: any;
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