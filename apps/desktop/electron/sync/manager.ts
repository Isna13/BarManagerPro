import axios, { AxiosInstance, AxiosError } from 'axios';
import { DatabaseManager } from '../database/manager';
import { BrowserWindow } from 'electron';

interface SyncItem {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  entity_id?: string;
  data: string;
}

/**
 * Configurações otimizadas para Railway Free Plan
 * 
 * Limitações do plano gratuito:
 * - $1/mês de crédito (após trial de 30 dias com $5)
 * - 0.5 GB RAM máximo
 * - 1 vCPU máximo
 * - Cold start pode levar 5-15 segundos
 * - Sem sleep automático, mas pode reiniciar por falta de recursos
 */
const RAILWAY_FREE_CONFIG = {
  // Intervalo de sync (60s para economizar recursos)
  SYNC_INTERVAL_MS: 60000,
  
  // Timeout para requisições normais (15s)
  REQUEST_TIMEOUT_MS: 15000,
  
  // Timeout para cold start (pode demorar mais)
  COLD_START_TIMEOUT_MS: 45000,
  
  // Intervalo de verificação de conexão (30s)
  CONNECTION_CHECK_INTERVAL_MS: 30000,
  
  // Retry config
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 2000,
  MAX_RETRY_DELAY_MS: 30000,
  
  // Backoff multiplier
  BACKOFF_MULTIPLIER: 2,
};

export class SyncManager {
  private apiClient: AxiosInstance;
  private syncInterval: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private token: string | null = null;
  private lastSync: Date | null = null;
  private mainWindow: BrowserWindow | null = null;
  private lastCredentials: { email: string; password: string } | null = null;
  private _isOnline: boolean = false;
  private _connectionCheckInProgress: boolean = false;
  private _coldStartDetected: boolean = false;
  private _consecutiveFailures: number = 0;
  private _lastSuccessfulRequest: Date | null = null;

  constructor(
    private dbManager: DatabaseManager,
    private apiUrl: string
  ) {
    this.apiClient = axios.create({
      baseURL: apiUrl,
      timeout: RAILWAY_FREE_CONFIG.REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    // Interceptor para adicionar token
    this.apiClient.interceptors.request.use(config => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      // Garantir UTF-8 em todas as requisições
      if (!config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json; charset=utf-8';
      }
      return config;
    });
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private emit(event: string, data?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      console.log(`📡 Emitting event: ${event}`, data);
      this.mainWindow.webContents.send(event, data);
    } else {
      console.warn(`⚠️ Cannot emit ${event}: mainWindow not available`);
    }
  }

  /**
   * Executa requisição com retry e backoff exponencial
   * Otimizado para lidar com cold starts do Railway Free Plan
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    options: {
      maxRetries?: number;
      operation?: string;
      useColdStartTimeout?: boolean;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? RAILWAY_FREE_CONFIG.MAX_RETRIES;
    const operation = options.operation ?? 'request';
    let lastError: Error | null = null;
    let delay = RAILWAY_FREE_CONFIG.INITIAL_RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Se detectou cold start, usar timeout maior na primeira tentativa
        if (this._coldStartDetected && options.useColdStartTimeout) {
          this.apiClient.defaults.timeout = RAILWAY_FREE_CONFIG.COLD_START_TIMEOUT_MS;
          console.log(`🥶 Cold start detectado - usando timeout de ${RAILWAY_FREE_CONFIG.COLD_START_TIMEOUT_MS / 1000}s`);
        }

        const result = await requestFn();
        
        // Sucesso - resetar contadores
        this._consecutiveFailures = 0;
        this._coldStartDetected = false;
        this._lastSuccessfulRequest = new Date();
        this.apiClient.defaults.timeout = RAILWAY_FREE_CONFIG.REQUEST_TIMEOUT_MS;
        
        return result;
      } catch (error: any) {
        lastError = error;
        this._consecutiveFailures++;

        // Detectar cold start (timeout ou conexão recusada)
        const isColdStart = this.isColdStartError(error);
        if (isColdStart) {
          this._coldStartDetected = true;
          console.log(`🥶 Possível cold start do Railway detectado (tentativa ${attempt}/${maxRetries})`);
        }

        // Log do erro
        const errorCode = error?.code || error?.response?.status || 'UNKNOWN';
        console.log(`⚠️ [${operation}] Tentativa ${attempt}/${maxRetries} falhou: ${errorCode}`);

        // Não fazer retry para erros de autenticação ou validação
        if (error?.response?.status === 401 || error?.response?.status === 400) {
          throw error;
        }

        // Se ainda tem tentativas, aguardar com backoff
        if (attempt < maxRetries) {
          console.log(`⏳ Aguardando ${delay / 1000}s antes da próxima tentativa...`);
          await this.sleep(delay);
          delay = Math.min(delay * RAILWAY_FREE_CONFIG.BACKOFF_MULTIPLIER, RAILWAY_FREE_CONFIG.MAX_RETRY_DELAY_MS);
        }
      }
    }

    // Todas as tentativas falharam
    console.error(`❌ [${operation}] Todas as ${maxRetries} tentativas falharam`);
    throw lastError;
  }

  /**
   * Verifica se o erro indica um possível cold start do Railway
   */
  private isColdStartError(error: any): boolean {
    const coldStartIndicators = [
      'ETIMEDOUT',
      'ECONNREFUSED', 
      'ECONNRESET',
      'ENOTFOUND',
      'timeout',
      'Network Error',
      'socket hang up',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || '';

    return coldStartIndicators.some(indicator => 
      errorCode === indicator || errorMessage.includes(indicator.toLowerCase())
    );
  }

  /**
   * Utilitário para aguardar um tempo
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retorna estatísticas do sync para monitoramento
   */
  getSyncStats() {
    return {
      isOnline: this._isOnline,
      isRunning: this.isRunning,
      consecutiveFailures: this._consecutiveFailures,
      coldStartDetected: this._coldStartDetected,
      lastSuccessfulRequest: this._lastSuccessfulRequest,
      lastSync: this.lastSync,
      syncIntervalMs: RAILWAY_FREE_CONFIG.SYNC_INTERVAL_MS,
      pendingItems: this.dbManager.getPendingSyncItems()?.length || 0,
    };
  }

  /**
   * Verifica se o banco local está vazio ou precisa de sincronização inicial
   */
  isLocalDatabaseEmpty(): boolean {
    try {
      const products = this.dbManager.getProducts() as any[];
      const customers = this.dbManager.getCustomers() as any[];
      const sales = this.dbManager.getSales({}) as any[];
      
      const isEmpty = products.length === 0 && customers.length === 0 && sales.length === 0;
      console.log(`📊 Verificação do banco local: ${isEmpty ? 'VAZIO' : 'COM DADOS'}`);
      console.log(`   - Produtos: ${products.length}`);
      console.log(`   - Clientes: ${customers.length}`);
      console.log(`   - Vendas: ${sales.length}`);
      
      return isEmpty;
    } catch (error) {
      console.error('Erro ao verificar banco local:', error);
      return true; // Assume vazio em caso de erro
    }
  }

  /**
   * Faz download completo de todos os dados do Railway para o banco local
   * Usado quando: novo dispositivo, banco local vazio, ou sync inicial
   */
  async fullPullFromServer(): Promise<{ success: boolean; stats: Record<string, number> }> {
    console.log('📥 Iniciando DOWNLOAD COMPLETO do Railway...');
    this.emit('sync:fullPullStarted', { message: 'Baixando dados do servidor...' });
    
    if (!this.token || this.token === 'offline-token') {
      console.error('❌ Token inválido para download completo');
      return { success: false, stats: {} };
    }

    const stats: Record<string, number> = {};
    
    // Entidades a baixar na ordem correta (respeitando dependências)
    const entities = [
      { name: 'branches', endpoint: '/branches' },
      { name: 'categories', endpoint: '/categories' },
      { name: 'suppliers', endpoint: '/suppliers' },
      { name: 'products', endpoint: '/products' },
      { name: 'customers', endpoint: '/customers' },
      { name: 'users', endpoint: '/users' },
    ];

    let totalProgress = 0;
    const progressStep = 100 / entities.length;

    for (const entity of entities) {
      try {
        console.log(`📥 Baixando ${entity.name}...`);
        this.emit('sync:progress', { 
          progress: totalProgress, 
          message: `Baixando ${entity.name}...` 
        });
        
        const response = await this.apiClient.get(entity.endpoint, { timeout: 30000 });
        const items = Array.isArray(response.data) ? response.data : response.data?.data || [];
        
        console.log(`   ✅ ${entity.name}: ${items.length} itens recebidos`);
        stats[entity.name] = items.length;
        
        if (items.length > 0) {
          await this.mergeEntityData(entity.name, items);
        }
        
        totalProgress += progressStep;
      } catch (error: any) {
        if (error?.response?.status === 404) {
          console.log(`   ⚠️ ${entity.name}: endpoint não disponível`);
          stats[entity.name] = 0;
        } else if (error?.response?.status === 403) {
          console.log(`   ⚠️ ${entity.name}: sem permissão`);
          stats[entity.name] = 0;
        } else {
          console.error(`   ❌ Erro ao baixar ${entity.name}:`, error?.message);
          stats[entity.name] = -1; // Indica erro
        }
        totalProgress += progressStep;
      }
    }

    // Atualizar data da última sincronização
    this.dbManager.setLastSyncDate(new Date());
    
    console.log('📊 RESUMO DO DOWNLOAD COMPLETO:');
    for (const [entityName, count] of Object.entries(stats)) {
      console.log(`   ${entityName}: ${count === -1 ? 'ERRO' : count + ' itens'}`);
    }

    this.emit('sync:fullPullCompleted', { success: true, stats });
    return { success: true, stats };
  }

  /**
   * Inicia verificação periódica de conexão
   */
  startConnectionMonitor() {
    if (this.connectionCheckInterval) return;
    
    console.log('🔌 Iniciando monitor de conexão (a cada 15 segundos)');
    
    // Verificar imediatamente
    this.updateConnectionStatus();
    
    // Verificar periodicamente
    this.connectionCheckInterval = setInterval(() => {
      this.updateConnectionStatus();
    }, 15000); // 15 segundos
  }

  stopConnectionMonitor() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  private async updateConnectionStatus() {
    if (this._connectionCheckInProgress) return;
    this._connectionCheckInProgress = true;
    
    try {
      const wasOnline = this._isOnline;
      this._isOnline = await this.checkConnection();
      
      // Se mudou de offline para online
      if (!wasOnline && this._isOnline) {
        console.log('🟢 Conexão restaurada!');
        this.emit('sync:connectionChange', { isOnline: true, status: 'restored' });
        
        // Se tem token offline, tentar reautenticar
        if (this.token === 'offline-token' && this.lastCredentials) {
          console.log('🔄 Tentando reautenticação automática...');
          await this.tryReauthenticate(1);
        }
      } 
      // Se mudou de online para offline
      else if (wasOnline && !this._isOnline) {
        console.log('🔴 Conexão perdida!');
        this.emit('sync:connectionChange', { isOnline: false, status: 'lost' });
      }
      
      // Emitir status atual
      this.emit('sync:connectionChange', { isOnline: this._isOnline, status: 'check' });
    } catch (error) {
      this._isOnline = false;
    } finally {
      this._connectionCheckInProgress = false;
    }
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  async login(credentials: { email: string; password: string }) {
    // Salvar credenciais para possível reautenticação
    this.lastCredentials = credentials;
    
    try {
      const response = await this.apiClient.post('/auth/login', credentials);
      this.token = response.data.accessToken;
      this._isOnline = true;
      
      console.log('✅ Login online bem-sucedido, token válido obtido');
      
      // Verificar se banco local está vazio e precisa de sync inicial
      const needsInitialSync = this.isLocalDatabaseEmpty();
      
      if (needsInitialSync) {
        console.log('📥 Banco local vazio detectado! Iniciando download inicial...');
        this.emit('sync:initialSyncNeeded', { message: 'Baixando dados do servidor...' });
        
        // Fazer download completo em background
        setTimeout(async () => {
          try {
            await this.fullPullFromServer();
            console.log('✅ Download inicial concluído!');
          } catch (error) {
            console.error('❌ Erro no download inicial:', error);
          }
        }, 500);
      }
      
      // Iniciar monitor de conexão
      this.startConnectionMonitor();
      
      return response.data;
    } catch (error) {
      // Modo offline: validar credenciais localmente
      console.log('Backend indisponível, tentando login offline...');
      console.log('Credenciais:', credentials.email);
      this._isOnline = false;
      
      try {
        const bcrypt = require('bcryptjs');
        
        // Buscar usuário no banco local
        const user = this.dbManager.getUserByEmail(credentials.email) as any;
        
        if (!user) {
          console.error('❌ Usuário não encontrado:', credentials.email);
          throw new Error('Credenciais inválidas');
        }
        
        if (!user.is_active) {
          console.error('❌ Usuário inativo:', credentials.email);
          throw new Error('Usuário inativo');
        }
        
        // Validar senha com bcrypt
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
        
        if (!isPasswordValid) {
          console.error('❌ Senha inválida para:', credentials.email);
          throw new Error('Credenciais inválidas');
        }
        
        // Atualizar último login
        this.dbManager.updateUserLastLogin(user.id);
        
        this.token = 'offline-token';
        const offlineUser = {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            branchId: user.branch_id,
            permissions: user.role === 'admin' || user.role === 'owner' ? ['*'] : [],
          },
          accessToken: 'offline-token',
        };
        console.log('✅ Login offline bem-sucedido:', offlineUser.user.email);
        return offlineUser;
      } catch (authError) {
        console.error('❌ Erro na autenticação offline:', authError);
        throw new Error('Credenciais inválidas');
      }
    }
  }

  async logout() {
    try {
      // Não tentar fazer logout no backend se estiver em modo offline
      if (this.token && this.token !== 'offline-token') {
        await this.apiClient.post('/auth/logout');
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      this.token = null;
      await this.stop();
    }
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const intervalSecs = RAILWAY_FREE_CONFIG.SYNC_INTERVAL_MS / 1000;
    console.log('🔄 Sincronização iniciada');
    console.log('📊 Status do token:', this.token === 'offline-token' ? '❌ OFFLINE-TOKEN (tentará reconectar)' : '✅ TOKEN VÁLIDO');
    console.log(`⏰ Intervalo de sincronização: ${intervalSecs} segundos (otimizado para Railway Free)`);
    console.log('💡 Dica: Railway Free tem 0.5GB RAM e 1 vCPU - sync menos frequente economiza recursos');
    
    // Re-sincronizar mesas não sincronizadas e retry de vendas falhadas
    try {
      const tablesResynced = this.dbManager.resyncUnsyncedTables();
      if (tablesResynced > 0) {
        console.log(`📋 ${tablesResynced} mesas adicionadas à fila de sync`);
      }
      
      const salesRetried = this.dbManager.retryFailedTableSales();
      if (salesRetried > 0) {
        console.log(`🔁 ${salesRetried} vendas de mesa marcadas para retry`);
      }
    } catch (err) {
      console.error('⚠️ Erro ao preparar resync:', err);
    }
    
    this.emit('sync:started');
    
    // Sincronização inicial
    await this.syncNow();
    
    // Sincronização periódica otimizada para Railway Free
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, RAILWAY_FREE_CONFIG.SYNC_INTERVAL_MS);
  }

  async stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.stopConnectionMonitor();
    this.isRunning = false;
    console.log('⏸ Sincronização pausada');
  }

  async syncNow() {
    if (!this.token) {
      console.warn('⚠️ Token não disponível, sincronização ignorada');
      return;
    }

    // Se estiver em modo offline, tentar reautenticar automaticamente
    if (this.token === 'offline-token') {
      console.log('ℹ️ Modo offline detectado, tentando reautenticar automaticamente...');
      
      try {
        const isConnected = await this.checkConnection();
        if (isConnected) {
          console.log('✅ Backend disponível! Tentando reautenticação automática...');
          const reauthSuccess = await this.tryReauthenticate(1); // Apenas 1 tentativa no background
          
          if (reauthSuccess) {
            console.log('✅ Reautenticação automática bem-sucedida! Sincronização continuará...');
            // O método tryReauthenticate já chama syncNow() após sucesso, então retornar aqui
            return;
          } else {
            console.log('⚠️ Reautenticação automática falhou, mantendo modo offline');
          }
        } else {
          console.log('📡 Backend ainda indisponível, aguardando próxima verificação...');
        }
      } catch (error) {
        console.log('⚠️ Erro ao verificar conexão:', error);
      }
      return;
    }

    try {
      this.emit('sync:started');
      
      // Verificar se Railway está vazio e banco local tem dados
      // Se sim, fazer resync automático completo
      await this.checkAndTriggerFullResyncIfNeeded();
      
      // Restaurar itens falhados para pendentes antes de sincronizar
      // Isso garante que vendas que falharam por queda de conexão sejam retentadas
      const retriedItems = this.dbManager.retryFailedSyncItems(10); // Aumentado para 10 tentativas
      if (retriedItems > 0) {
        console.log(`🔄 ${retriedItems} itens restaurados para re-sincronização`);
      }
      
      // Simular progresso durante sincronização
      const progressInterval = setInterval(() => {
        // Progresso gradual simulado (será mais preciso com implementação real)
        this.emit('sync:progress', { progress: Math.random() * 50 + 25 });
      }, 500);
      
      try {
        // 1. Push local changes to server
        await this.pushLocalChanges();
        this.emit('sync:progress', { progress: 60 });
        
        // 2. Pull server changes to local
        await this.pullServerChanges();
        this.emit('sync:progress', { progress: 90 });
        
        clearInterval(progressInterval);
        
        this.lastSync = new Date();
        console.log('✅ Sincronização concluída');
        
        const pending = this.dbManager.getPendingSyncItems();
        this.emit('sync:completed', {
          success: true,
          lastSync: this.lastSync,
          pendingItems: pending.length,
        });
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    } catch (error: any) {
      console.error('❌ Erro na sincronização:', error?.message || error);
      
      // Verificar se é erro de conexão
      const isConnectionError = 
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('Network Error') ||
        error?.message?.includes('timeout');
      
      if (isConnectionError) {
        console.log('🔴 Conexão com backend perdida durante sincronização');
        console.log('📴 Sistema entrará em modo offline');
        console.log('🔄 Tentativas de reconexão continuarão automaticamente a cada 30 segundos');
      }
      
      this.emit('sync:error', error?.message || 'Erro desconhecido na sincronização');
    }
  }

  private async pushLocalChanges() {
    const pendingItems = this.dbManager.getPendingSyncItems() as SyncItem[];
    
    if (pendingItems.length === 0) {
      console.log('📭 Nenhum item pendente para sincronização');
      return;
    }
    
    // Ordenar itens por prioridade de dependência
    const sortedItems = this.sortByDependency(pendingItems);
    console.log(`📤 Sincronizando ${sortedItems.length} itens (ordenados por dependência):`);
    sortedItems.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.entity}/${item.operation} - ${item.entity_id}`);
    });
    
    let hasFailures = false;
    
    for (const item of sortedItems) {
      try {
        const rawData = JSON.parse(item.data);
        const data = this.prepareDataForSync(item.entity, rawData);
        
        // Tratar casos especiais de entidades aninhadas
        const syncResult = await this.syncEntityItem(item, data);
        
        if (syncResult.success) {
          this.dbManager.markSyncItemCompleted(item.id);
          console.log(`✅ Sync ${item.entity} concluído`);
        } else if (syncResult.skip) {
          // Marcar como completado para pular (entidade não suportada)
          this.dbManager.markSyncItemCompleted(item.id);
          console.log(`⏭️ Sync ${item.entity} ignorado: ${syncResult.reason}`);
        }
        
      } catch (error: any) {
        hasFailures = true;
        const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
        console.error(`❌ Erro ao sincronizar ${item.entity}:`, errorMsg);
        
        // Verificar tipo de erro
        if (error.response?.status === 401) {
          console.error('🔒 Erro de autenticação (401) - Token inválido ou expirado');
          this.dbManager.markSyncItemFailed(item.id, 'Erro de autenticação');
          await this.stop();
          break;
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          console.log('🔴 Erro de conexão ao sincronizar item:', error.code);
          console.log('📦 Item será mantido na fila para próxima tentativa');
          this.dbManager.markSyncItemFailed(item.id, `Erro de conexão: ${error.code}`);
          // Não parar sincronização, apenas marcar como falho para retry
          break; // Parar loop atual, mas não stop() completo
        } else {
          console.error('⚠️ Erro desconhecido:', error);
          this.dbManager.markSyncItemFailed(item.id, errorMsg);
        }
      }
    }
    
    // Se houve falhas, tentar re-sincronizar itens falhados
    // (útil quando dependências foram sincronizadas nesta rodada)
    if (hasFailures) {
      const retried = this.dbManager.retryFailedSyncItems(5); // max 5 tentativas
      if (retried > 0) {
        console.log(`🔄 Re-tentando ${retried} itens que podem ter sido desbloqueados por dependências...`);
        // Fazer uma segunda passada imediata
        const retryItems = this.dbManager.getPendingSyncItems() as SyncItem[];
        for (const item of retryItems) {
          try {
            const rawData = JSON.parse(item.data);
            const data = this.prepareDataForSync(item.entity, rawData);
            const syncResult = await this.syncEntityItem(item, data);
            
            if (syncResult.success) {
              this.dbManager.markSyncItemCompleted(item.id);
              console.log(`✅ Re-sync ${item.entity} concluído`);
            } else if (syncResult.skip) {
              this.dbManager.markSyncItemCompleted(item.id);
            }
          } catch (error: any) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
            console.error(`❌ Re-sync ${item.entity} falhou:`, errorMsg);
            this.dbManager.markSyncItemFailed(item.id, errorMsg);
          }
        }
      }
    }
  }

  /**
   * Verifica se o Railway está vazio mas o banco local tem dados
   * Se sim, executa automaticamente um resync completo
   */
  private async checkAndTriggerFullResyncIfNeeded(): Promise<void> {
    // Verificar se já fizemos resync recentemente (evitar loop)
    const lastResyncCheck = this.dbManager.getSetting('last_resync_check');
    const now = new Date();
    if (lastResyncCheck) {
      const lastCheck = new Date(lastResyncCheck);
      const diffMinutes = (now.getTime() - lastCheck.getTime()) / 1000 / 60;
      if (diffMinutes < 2) {
        // Verificado há menos de 2 minutos, pular
        return;
      }
    }
    
    // Salvar timestamp da verificação
    this.dbManager.setSetting('last_resync_check', now.toISOString());
    
    try {
      // Verificar se fila está vazia ou só tem itens falhados
      const pendingItems = this.dbManager.getPendingSyncItems() as SyncItem[];
      const queueStats = this.dbManager.getSyncQueueStats();
      
      // Se tem itens pendentes novos (não falhados), não fazer resync
      if (pendingItems.length > 0 && queueStats.failed === 0) {
        console.log('📋 Fila tem itens pendentes, resync não necessário');
        return;
      }
      
      // Verificar contagem local
      const localCounts = this.getLocalEntityCounts();
      const hasLocalData = localCounts.products > 0 || localCounts.customers > 0 || localCounts.sales > 0;
      
      if (!hasLocalData) {
        console.log('📭 Banco local vazio, nenhum resync necessário');
        return;
      }
      
      // Verificar Railway - fazer requests para ver se está vazio
      console.log('🔍 Verificando se Railway precisa de resync...');
      console.log(`   Dados locais: ${localCounts.products} produtos, ${localCounts.customers} clientes, ${localCounts.sales} vendas`);
      
      const railwayCounts = await this.getRailwayEntityCounts();
      console.log(`   Dados Railway: ${railwayCounts.products} produtos, ${railwayCounts.customers} clientes`);
      
      // Se Railway está vazio mas local tem dados, fazer resync
      if (railwayCounts.products === 0 && railwayCounts.customers === 0 && localCounts.products > 0) {
        console.log('⚠️ Railway vazio detectado! Iniciando resync automático completo...');
        
        // Executar queueFullResync
        const result = this.dbManager.queueFullResync();
        console.log(`✅ Resync automático enfileirado: ${result.total} itens`);
        
        // Notificar UI
        this.emit('sync:progress', { 
          progress: 5, 
          message: `Resync automático: ${result.total} itens enfileirados` 
        });
      } else {
        console.log('✅ Railway não está vazio, resync não necessário');
      }
    } catch (error: any) {
      console.log('⚠️ Erro ao verificar necessidade de resync:', error?.message);
      // Não falhar a sincronização por causa disso
    }
  }

  /**
   * Conta entidades no banco local
   */
  private getLocalEntityCounts(): { products: number; customers: number; sales: number; debts: number } {
    try {
      const products = (this.dbManager.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0;
      const customers = (this.dbManager.prepare('SELECT COUNT(*) as count FROM customers').get() as any)?.count || 0;
      const sales = (this.dbManager.prepare('SELECT COUNT(*) as count FROM sales').get() as any)?.count || 0;
      const debts = (this.dbManager.prepare('SELECT COUNT(*) as count FROM debts').get() as any)?.count || 0;
      return { products, customers, sales, debts };
    } catch (e) {
      return { products: 0, customers: 0, sales: 0, debts: 0 };
    }
  }

  /**
   * Conta entidades no Railway
   */
  private async getRailwayEntityCounts(): Promise<{ products: number; customers: number }> {
    try {
      const [productsRes, customersRes] = await Promise.all([
        this.apiClient.get('/products', { params: { limit: 1 } }),
        this.apiClient.get('/customers', { params: { limit: 1 } }),
      ]);
      
      // Tentar pegar o total da resposta
      const products = Array.isArray(productsRes.data) 
        ? productsRes.data.length 
        : (productsRes.data?.total || productsRes.data?.items?.length || 0);
      const customers = Array.isArray(customersRes.data) 
        ? customersRes.data.length 
        : (customersRes.data?.total || customersRes.data?.items?.length || 0);
      
      return { products, customers };
    } catch (e) {
      return { products: -1, customers: -1 }; // -1 indica erro
    }
  }

  /**
   * Ordena itens de sincronização por dependência
   * Entidades base devem ser sincronizadas antes de entidades que dependem delas
   */
  private sortByDependency(items: SyncItem[]): SyncItem[] {
    // Ordem de prioridade (menor número = sincroniza primeiro)
    const priorityMap: Record<string, number> = {
      // Entidades base (sem dependências)
      'branch': 1,
      'branches': 1,
      'user': 2,
      'users': 2,
      'category': 3,
      'categories': 3,
      'supplier': 4,
      'suppliers': 4,
      'customer': 5,
      'customers': 5,
      
      // Entidades com dependências leves
      'product': 10,
      'products': 10,
      'table': 11,
      'tables': 11,
      
      // Entidades transacionais (dependem das anteriores)
      'debt': 20,
      'debts': 20,
      'purchase': 21,
      'purchases': 21,
      'sale': 22,
      'sales': 22,
      'cash_box': 23,
      'cashBox': 23,
      
      // Itens de transações (dependem da transação pai)
      'debt_payment': 30,
      'purchase_item': 31,
      'sale_item': 32,
      'payment': 33,
      
      // Outros
      'inventory': 40,
      'inventory_item': 40,
      'customer_loyalty': 50,
      'table_session': 51,
    };
    
    return items.sort((a, b) => {
      const priorityA = priorityMap[a.entity] || 100;
      const priorityB = priorityMap[b.entity] || 100;
      return priorityA - priorityB;
    });
  }

  private async pullServerChanges() {
    console.log('📥 Iniciando pull de dados do servidor...');
    
    try {
      // 1. Buscar última data de sincronização
      const lastSyncDate = this.dbManager.getLastSyncDate();
      console.log('📅 Última sincronização:', lastSyncDate || 'Nunca sincronizado');
      
      // 2. Pull de cada entidade importante
      const entities = [
        { name: 'branches', endpoint: '/branches' },
        { name: 'users', endpoint: '/users' },
        { name: 'categories', endpoint: '/categories' },
        { name: 'products', endpoint: '/products' },
        { name: 'customers', endpoint: '/customers' },
        { name: 'suppliers', endpoint: '/suppliers' },
        { name: 'inventory', endpoint: '/inventory' },
        { name: 'debts', endpoint: '/debts' },
        { name: 'purchases', endpoint: '/purchases' },
        { name: 'sales', endpoint: '/sales' },
      ];
      
      for (const entity of entities) {
        try {
          console.log(`📥 Sincronizando ${entity.name}...`);
          
          // Construir URL com parâmetro de data se houver última sincronização
          let url = entity.endpoint;
          if (lastSyncDate) {
            url += `?updatedAfter=${lastSyncDate.toISOString()}`;
          }
          
          const response = await this.apiClient.get(url, { timeout: 30000 });
          const items = Array.isArray(response.data) ? response.data : response.data?.data || [];
          
          if (items.length > 0) {
            console.log(`✅ ${entity.name}: ${items.length} itens recebidos`);
            await this.mergeEntityData(entity.name, items);
          } else {
            console.log(`ℹ️ ${entity.name}: nenhum item novo`);
          }
        } catch (entityError: any) {
          // Ignorar erros 404 (endpoint não existe)
          if (entityError?.response?.status === 404) {
            console.log(`⚠️ ${entity.name}: endpoint não disponível (404)`);
          } else if (entityError?.response?.status === 403) {
            console.log(`⚠️ ${entity.name}: sem permissão (403)`);
          } else {
            console.error(`❌ Erro ao sincronizar ${entity.name}:`, entityError?.message);
          }
        }
      }
      
      // 3. Atualizar data da última sincronização
      this.dbManager.setLastSyncDate(new Date());
      console.log('✅ Pull do servidor concluído');
      
    } catch (error: any) {
      console.error('❌ Erro geral no pull:', error?.message);
      throw error;
    }
  }
  
  /**
   * Verifica se um item local tem alterações pendentes (não sincronizadas)
   * Retorna true se o item NÃO deve ser sobrescrito pelo servidor
   */
  private hasLocalPendingChanges(entityName: string, itemId: string, existing: any): boolean {
    // Se não existe localmente, não há conflito
    if (!existing) return false;
    
    // Verificar se synced = 0 (alteração local pendente)
    const synced = existing.synced ?? existing.is_synced ?? 1;
    if (synced === 0) {
      console.log(`⚠️ ${entityName} ${itemId}: mantendo alterações locais pendentes (synced=0)`);
      return true;
    }
    
    // Verificar se está na fila de sincronização
    const pendingItems = this.dbManager.getPendingSyncItems() as SyncItem[];
    const hasPendingSync = pendingItems.some(
      item => item.entity === entityName.slice(0, -1) && item.entity_id === itemId
    );
    
    if (hasPendingSync) {
      console.log(`⚠️ ${entityName} ${itemId}: mantendo alterações locais (na fila de sync)`);
      return true;
    }
    
    return false;
  }

  /**
   * Mescla dados recebidos do servidor com dados locais
   * Estratégia: servidor tem prioridade, MAS respeita alterações locais não sincronizadas
   */
  private async mergeEntityData(entityName: string, items: any[]) {
    const mergeStrategies: Record<string, (items: any[]) => void> = {
      branches: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getBranchById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('branches', item.id, existing)) {
              continue;
            }
            
            if (existing) {
              this.dbManager.updateBranch(item.id, {
                name: item.name,
                code: item.code,
                address: item.address,
                phone: item.phone,
                is_main: item.isMain ? 1 : 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            } else {
              this.dbManager.createBranch({
                id: item.id,
                name: item.name,
                code: item.code,
                address: item.address,
                phone: item.phone,
                is_main: item.isMain ? 1 : 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar branch ${item.id}:`, e?.message);
          }
        }
      },
      
      users: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getUserByEmail(item.email);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (existing && this.hasLocalPendingChanges('users', (existing as any).id, existing)) {
              continue;
            }
            
            if (existing) {
              // Não sobrescrever senha local se usuário já existe
              this.dbManager.updateUserFromServer((existing as any).id, {
                email: item.email,
                full_name: item.fullName,
                role: item.role,
                branch_id: item.branchId,
                phone: item.phone,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            }
            // Não criar usuários do servidor localmente sem senha
          } catch (e: any) {
            console.error(`Erro ao mesclar user ${item.email}:`, e?.message);
          }
        }
      },
      
      categories: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getCategoryById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('categories', item.id, existing)) {
              continue;
            }
            
            if (existing) {
              this.dbManager.updateCategory(item.id, {
                name: item.name,
                description: item.description,
                parent_id: item.parentId,
                sort_order: item.sortOrder || 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            } else {
              this.dbManager.createCategory({
                id: item.id,
                name: item.name,
                description: item.description,
                parent_id: item.parentId,
                sort_order: item.sortOrder || 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar category ${item.id}:`, e?.message);
          }
        }
      },
      
      products: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getProductById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('products', item.id, existing)) {
              continue;
            }
            
            if (existing) {
              this.dbManager.updateProduct(item.id, {
                name: item.name,
                sku: item.sku,
                barcode: item.barcode,
                description: item.description,
                categoryId: item.categoryId,
                priceBox: item.priceBox,
                priceUnit: item.priceUnit || 0,
                costUnit: item.costUnit || 0,
                unitsPerBox: item.unitsPerBox,
                lowStockAlert: item.lowStockAlert,
                isActive: item.isActive !== false ? 1 : 0,
                synced: 1,
                lastSync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            } else {
              this.dbManager.createProduct({
                id: item.id,
                name: item.name,
                sku: item.sku,
                barcode: item.barcode,
                description: item.description,
                categoryId: item.categoryId,
                priceBox: item.priceBox || 0,
                priceUnit: item.priceUnit || 0,
                costUnit: item.costUnit || 0,
                unitsPerBox: item.unitsPerBox || 1,
                lowStockAlert: item.lowStockAlert || 10,
                isActive: item.isActive !== false ? 1 : 0,
                synced: 1,
                lastSync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar product ${item.id}:`, e?.message);
          }
        }
      },
      
      customers: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getCustomerById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('customers', item.id, existing)) {
              continue;
            }
            
            // Mapear name corretamente - backend pode enviar name, fullName ou firstName/lastName
            const fullName = item.name || item.fullName || 
              (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : null);
            
            if (!fullName) {
              console.warn(`⚠️ Cliente ${item.id} sem nome válido - pulando`);
              continue;
            }
            
            if (existing) {
              // Preservar creditLimit local se o servidor não enviar
              const existingAny = existing as any;
              const creditLimit = item.creditLimit !== undefined 
                ? item.creditLimit 
                : (existingAny.credit_limit || 0);
              
              this.dbManager.updateCustomer(item.id, {
                name: fullName,
                email: item.email,
                phone: item.phone,
                code: item.code,
                address: item.address,
                creditLimit: creditLimit,
                loyalty_points: item.loyaltyPoints ?? item.loyalty_points ?? existingAny.loyalty_points ?? 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            } else {
              this.dbManager.createCustomer({
                id: item.id,
                name: fullName,
                email: item.email,
                phone: item.phone,
                code: item.code,
                address: item.address,
                creditLimit: item.creditLimit || 0,
                loyalty_points: item.loyaltyPoints ?? item.loyalty_points ?? 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar customer ${item.id}:`, e?.message);
          }
        }
      },
      
      suppliers: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getSupplierById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('suppliers', item.id, existing)) {
              continue;
            }
            
            if (existing) {
              this.dbManager.updateSupplier(item.id, {
                name: item.name,
                email: item.email,
                phone: item.phone,
                address: item.address,
                contact_person: item.contactPerson,
                tax_id: item.taxId,
                payment_terms: item.paymentTerms,
                notes: item.notes,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            } else {
              this.dbManager.createSupplier({
                id: item.id,
                name: item.name,
                email: item.email,
                phone: item.phone,
                address: item.address,
                contact_person: item.contactPerson,
                tax_id: item.taxId,
                payment_terms: item.paymentTerms,
                notes: item.notes,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar supplier ${item.id}:`, e?.message);
          }
        }
      },
      
      inventory: (items) => {
        // Inventário - atualizar quantidades dos produtos no desktop
        console.log(`📦 Recebidos ${items.length} itens de inventário do servidor`);
        
        for (const item of items) {
          try {
            // O backend retorna items com productId e qtyUnits
            const productId = item.productId || item.product_id;
            if (!productId) {
              console.log(`⚠️ Item de inventário sem productId: ${JSON.stringify(item)}`);
              continue;
            }
            
            // Verificar se o produto existe
            const product = this.dbManager.getProductById(productId);
            if (!product) {
              console.log(`⚠️ Produto não encontrado localmente: ${productId}`);
              continue;
            }
            
            const newQty = item.qtyUnits ?? item.qty_units ?? 0;
            const currentStock = product.stock ?? 0;
            
            // Verificar se há alterações locais pendentes
            if (product.synced === 0) {
              console.log(`⚠️ Produto ${productId} tem alterações locais pendentes (synced=0), pulando...`);
              continue;
            }
            
            // Só atualizar se houver diferença
            if (currentStock !== newQty) {
              console.log(`📦 Atualizando estoque: ${product.name} (${productId})`);
              console.log(`   Local: ${currentStock} → Servidor: ${newQty}`);
              
              // Atualizar stock do produto usando updateProduct
              this.dbManager.updateProduct(productId, {
                stock: newQty,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
              
              console.log(`✅ Estoque atualizado: ${product.name} = ${newQty} unidades`);
            } else {
              console.log(`ℹ️ Estoque já sincronizado: ${product.name} = ${newQty}`);
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar inventory ${item.id}:`, e?.message);
          }
        }
      },
      
      debts: (items) => {
        // Débitos/Vales - sincronizar do servidor para o desktop
        for (const item of items) {
          try {
            const existing = this.dbManager.getDebtById ? this.dbManager.getDebtById(item.id) : null;
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('debts', item.id, existing)) {
              continue;
            }
            
            // Calcular valores corretos
            const amount = item.amount || item.originalAmount || 0;
            const paidAmount = item.paid || item.paidAmount || 0;
            const balance = item.balance ?? (amount - paidAmount);
            
            if (existing) {
              // Atualizar débito existente
              this.dbManager.prepare(`
                UPDATE debts SET
                  customer_id = ?,
                  original_amount = ?,
                  amount = ?,
                  paid_amount = ?,
                  balance = ?,
                  status = ?,
                  due_date = ?,
                  notes = ?,
                  synced = 1,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(
                item.customerId || item.customer_id,
                item.originalAmount || amount,
                amount,
                paidAmount,
                balance,
                item.status || 'pending',
                item.dueDate || item.due_date || null,
                item.notes || null,
                item.id
              );
              console.log(`📝 Débito atualizado: ${item.id} (${item.status}, saldo: ${balance})`);
            } else {
              // Criar novo débito
              this.dbManager.prepare(`
                INSERT INTO debts (id, debt_number, customer_id, original_amount, amount, paid_amount, balance, status, due_date, notes, created_by, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.debtNumber || item.debt_number || `DEBT-${Date.now()}`,
                item.customerId || item.customer_id,
                item.originalAmount || amount,
                amount,
                paidAmount,
                balance,
                item.status || 'pending',
                item.dueDate || item.due_date || null,
                item.notes || null,
                item.createdBy || item.created_by || null
              );
              console.log(`➕ Débito criado: ${item.id} (${item.status})`);
            }
            
            // Sincronizar pagamentos do débito se existirem
            if (item.payments && Array.isArray(item.payments)) {
              for (const payment of item.payments) {
                try {
                  const existingPayment = this.dbManager.prepare(`
                    SELECT id FROM debt_payments WHERE id = ?
                  `).get(payment.id);
                  
                  if (!existingPayment) {
                    this.dbManager.prepare(`
                      INSERT INTO debt_payments (id, debt_id, amount, method, reference, notes, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      payment.id,
                      item.id,
                      payment.amount,
                      payment.method || 'cash',
                      payment.referenceNumber || payment.reference || null,
                      payment.notes || null,
                      payment.createdAt || new Date().toISOString()
                    );
                    console.log(`  💰 Pagamento sincronizado: ${payment.id}`);
                  }
                } catch (paymentError: any) {
                  console.error(`  ❌ Erro ao sincronizar pagamento ${payment.id}:`, paymentError?.message);
                }
              }
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar debt ${item.id}:`, e?.message);
          }
        }
      },
      
      purchases: (items) => {
        // Compras - sincronizar do servidor para o desktop
        for (const item of items) {
          try {
            const existing = this.dbManager.getPurchaseById ? this.dbManager.getPurchaseById(item.id) : null;
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('purchases', item.id, existing)) {
              continue;
            }
            
            if (existing) {
              // Atualizar compra existente - especialmente o status
              this.dbManager.prepare(`
                UPDATE purchases SET
                  supplier_id = ?,
                  status = ?,
                  total = ?,
                  notes = ?,
                  received_at = ?,
                  synced = 1,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(
                item.supplierId || item.supplier_id,
                item.status || 'pending',
                item.total || 0,
                item.notes || null,
                item.receivedAt || item.received_at || null,
                item.id
              );
              console.log(`📦 Compra atualizada: ${item.id} (status: ${item.status})`);
            } else {
              // Criar nova compra
              this.dbManager.prepare(`
                INSERT INTO purchases (id, purchase_number, branch_id, supplier_id, status, total, notes, created_by, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.purchaseNumber || item.purchase_number || `PUR-${Date.now()}`,
                item.branchId || item.branch_id || 'main-branch',
                item.supplierId || item.supplier_id,
                item.status || 'pending',
                item.total || 0,
                item.notes || null,
                item.createdBy || item.created_by || null
              );
              console.log(`➕ Compra criada: ${item.id}`);
            }
            
            // Sincronizar itens da compra se existirem
            if (item.items && Array.isArray(item.items)) {
              for (const purchaseItem of item.items) {
                try {
                  const existingItem = this.dbManager.prepare(`
                    SELECT id FROM purchase_items WHERE id = ?
                  `).get(purchaseItem.id);
                  
                  if (!existingItem) {
                    this.dbManager.prepare(`
                      INSERT INTO purchase_items (id, purchase_id, product_id, qty_units, qty_boxes, unit_cost, subtotal, total)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      purchaseItem.id,
                      item.id,
                      purchaseItem.productId || purchaseItem.product_id,
                      purchaseItem.qtyUnits || purchaseItem.qty_units || 0,
                      purchaseItem.qtyBoxes || purchaseItem.qty_boxes || 0,
                      purchaseItem.unitCost || purchaseItem.unit_cost || 0,
                      purchaseItem.subtotal || 0,
                      purchaseItem.total || purchaseItem.subtotal || 0
                    );
                    console.log(`  📋 Item de compra sincronizado: ${purchaseItem.id}`);
                  }
                } catch (itemError: any) {
                  console.error(`  ❌ Erro ao sincronizar item ${purchaseItem.id}:`, itemError?.message);
                }
              }
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar purchase ${item.id}:`, e?.message);
          }
        }
      },
      
      sales: (items) => {
        // Vendas - sincronizar do servidor para o desktop (bidirecional)
        for (const item of items) {
          try {
            // Verificar se a venda já existe localmente
            const existing = this.dbManager.getSaleById ? this.dbManager.getSaleById(item.id) : null;
            
            // Não sobrescrever vendas locais que ainda não foram sincronizadas
            if (this.hasLocalPendingChanges('sales', item.id, existing)) {
              continue;
            }
            
            if (!existing) {
              // Criar venda do servidor localmente (sync bidirecional)
              const saleData = {
                id: item.id,
                sale_number: item.saleNumber || item.sale_number || `SALE-${Date.now()}`,
                type: item.type || 'direct',
                status: item.status || 'completed',
                subtotal: item.subtotal || 0,
                discount: item.discount || 0,
                tax: item.tax || 0,
                total: item.total || 0,
                paid: item.paid || item.total || 0,
                change_amount: item.change || item.changeAmount || item.change_amount || 0,
                customer_id: item.customerId || item.customer_id || null,
                customer_name: item.customerName || item.customer_name || null,
                table_id: item.tableId || item.table_id || null,
                cash_box_id: item.cashBoxId || item.cash_box_id || null,
                branch_id: item.branchId || item.branch_id || null,
                created_by: item.createdBy || item.created_by || null,
                notes: item.notes || null,
                synced: 1,
                created_at: item.createdAt || item.created_at || new Date().toISOString(),
                updated_at: item.updatedAt || item.updated_at || new Date().toISOString(),
              };
              
              // Criar a venda no banco local
              this.dbManager.createSale(saleData, true); // skipSyncQueue = true
              console.log(`➕ Venda criada do servidor: ${item.id} (${item.status}, total: ${item.total})`);
              
              // Sincronizar itens da venda se existirem
              if (item.items && Array.isArray(item.items)) {
                for (const saleItem of item.items) {
                  try {
                    const existingItem = this.dbManager.prepare(`
                      SELECT id FROM sale_items WHERE id = ?
                    `).get(saleItem.id);
                    
                    if (!existingItem) {
                      this.dbManager.prepare(`
                        INSERT INTO sale_items (id, sale_id, product_id, qty_units, unit_price, unit_cost, subtotal, discount_amount, tax_amount, total, is_muntu, notes, synced, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                      `).run(
                        saleItem.id,
                        item.id,
                        saleItem.productId || saleItem.product_id,
                        saleItem.qtyUnits || saleItem.qty_units || 1,
                        saleItem.unitPrice || saleItem.unit_price || 0,
                        saleItem.unitCost || saleItem.unit_cost || 0,
                        saleItem.subtotal || 0,
                        saleItem.discount || saleItem.discountAmount || saleItem.discount_amount || 0,
                        saleItem.taxAmount || saleItem.tax_amount || 0,
                        saleItem.total || saleItem.subtotal || 0,
                        saleItem.isMuntu || saleItem.is_muntu ? 1 : 0,
                        saleItem.notes || null,
                        saleItem.createdAt || new Date().toISOString()
                      );
                      console.log(`  📦 Item sincronizado: productId=${saleItem.productId || saleItem.product_id}`);
                    }
                  } catch (itemError: any) {
                    console.error(`  ❌ Erro ao sincronizar item ${saleItem.id}:`, itemError?.message);
                  }
                }
              }
              
              // Sincronizar pagamentos da venda se existirem
              if (item.payments && Array.isArray(item.payments)) {
                for (const payment of item.payments) {
                  try {
                    const existingPayment = this.dbManager.prepare(`
                      SELECT id FROM payments WHERE id = ?
                    `).get(payment.id);
                    
                    if (!existingPayment) {
                      this.dbManager.prepare(`
                        INSERT INTO payments (id, sale_id, method, amount, provider, reference_number, transaction_id, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                      `).run(
                        payment.id,
                        item.id,
                        payment.method || 'cash',
                        payment.amount || item.total,
                        payment.provider || null,
                        payment.referenceNumber || payment.reference_number || null,
                        payment.transactionId || payment.transaction_id || null,
                        payment.createdAt || new Date().toISOString()
                      );
                      console.log(`  💰 Pagamento sincronizado: ${payment.method} - ${payment.amount}`);
                    }
                  } catch (paymentError: any) {
                    console.error(`  ❌ Erro ao sincronizar pagamento ${payment.id}:`, paymentError?.message);
                  }
                }
              }
            } else {
              // Atualizar status se necessário
              const existingAny = existing as any;
              if (existingAny.status !== item.status || existingAny.synced === 0) {
                this.dbManager.prepare(`
                  UPDATE sales SET status = ?, synced = 1, updated_at = datetime('now')
                  WHERE id = ?
                `).run(item.status, item.id);
                console.log(`📝 Venda atualizada: ${item.id} (status: ${item.status})`);
              }
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar sale ${item.id}:`, e?.message);
          }
        }
      },
    };
    
    const strategy = mergeStrategies[entityName];
    if (strategy) {
      strategy(items);
    } else {
      console.warn(`⚠️ Sem estratégia de merge para: ${entityName}`);
    }
  }

  /**
   * Sincroniza um item individual, tratando casos especiais de entidades aninhadas
   */
  private async syncEntityItem(item: SyncItem, data: any): Promise<{ success: boolean; skip?: boolean; reason?: string }> {
    const { entity, operation, entity_id } = item;
    
    console.log(`📤 Sync ${entity}/${operation}:`, JSON.stringify(data).substring(0, 200));
    
    // Log especial para vendas de mesa
    if (entity === 'sale') {
      console.log(`🍽️ Sincronizando venda: ID=${entity_id}, Type=${data.type}, Status=${data.status}, Total=${data.total}`);
      if (data.type === 'table') {
        console.log(`   Mesa: tableId=${data.tableId}, customerName=${data.customerName}`);
      }
    }
    
    // Casos especiais - entidades que são sub-recursos de outras
    switch (entity) {
      case 'sale_item':
        // Itens de venda devem ser adicionados via POST /sales/:saleId/items
        if (operation === 'create' && data.saleId) {
          // Verificar se a venda existe primeiro
          try {
            await this.apiClient.get(`/sales/${data.saleId}`);
          } catch (checkError: any) {
            if (checkError.response?.status === 404) {
              console.log(`⏳ Venda ${data.saleId} ainda não existe no servidor, adiando item...`);
              // Não marcar como falhado permanente, apenas retornar false para retry
              throw new Error(`Venda ${data.saleId} não encontrada - aguardando sync`);
            }
            throw checkError;
          }
          
          await this.apiClient.post(`/sales/${data.saleId}/items`, {
            productId: data.productId,
            qtyUnits: data.qtyUnits || data.qty_units || 1,
            isMuntu: data.isMuntu || false,
            notes: data.notes,
          });
          return { success: true };
        }
        // Se não tem saleId, pular
        return { skip: true, success: false, reason: 'Item de venda sem saleId' };
        
      case 'payment':
        // Pagamentos devem ser processados via POST /sales/:saleId/payments
        if (operation === 'create' && data.saleId) {
          // Verificar se a venda existe primeiro
          try {
            await this.apiClient.get(`/sales/${data.saleId}`);
          } catch (checkError: any) {
            if (checkError.response?.status === 404) {
              console.log(`⏳ Venda ${data.saleId} ainda não existe no servidor, adiando pagamento...`);
              throw new Error(`Venda ${data.saleId} não encontrada - aguardando sync`);
            }
            throw checkError;
          }
          
          await this.apiClient.post(`/sales/${data.saleId}/payments`, {
            method: data.method || 'cash',
            amount: data.amount,
            provider: data.provider,
            referenceNumber: data.referenceNumber || data.reference_number,
            transactionId: data.transactionId || data.transaction_id,
          });
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Pagamento sem saleId' };
        
      case 'cash_box':
        // Caixa - sincronizar abertura/fechamento
        if (operation === 'create') {
          // Abrir caixa no backend - usar o mesmo ID do Electron
          const openResponse = await this.apiClient.post('/cash-box/open', {
            id: entity_id, // Enviar o ID do Electron para manter consistência
            branchId: data.branchId || data.branch_id || 'main-branch',
            openingAmount: data.openingCash || data.opening_cash || 0,
            boxNumber: data.boxNumber || data.box_number,
            notes: data.notes || 'Aberto via Electron Desktop'
          });
          console.log('✅ Caixa aberto no backend:', openResponse.data?.id || entity_id);
          return { success: true };
        } else if (operation === 'update') {
          // Verificar se é fechamento de caixa
          if (data.status === 'closed' || data.closingCash !== undefined || data.closing_cash !== undefined) {
            try {
              const closeResponse = await this.apiClient.post(`/cash-box/${entity_id}/close`, {
                closingAmount: data.closingCash || data.closing_cash || 0,
                notes: data.notes || 'Fechado via Electron Desktop'
              });
              console.log('✅ Caixa fechado no backend:', entity_id);
              return { success: true };
            } catch (closeError: any) {
              // Se o caixa não foi encontrado, pode ser que nunca foi sincronizado
              // Tentar criar primeiro e depois fechar
              if (closeError?.response?.status === 404 && entity_id) {
                console.log('⚠️ Caixa não encontrado no backend, tentando criar primeiro...');
                try {
                  // Buscar dados completos do caixa local
                  const localCashBox = this.dbManager.getCashBoxById(entity_id);
                  if (localCashBox) {
                    await this.apiClient.post('/cash-box/open', {
                      id: entity_id,
                      branchId: localCashBox.branch_id || 'main-branch',
                      openingAmount: localCashBox.opening_cash || 0,
                      boxNumber: localCashBox.box_number,
                      notes: localCashBox.notes || 'Sincronizado via Electron Desktop'
                    });
                    // Agora fechar
                    await this.apiClient.post(`/cash-box/${entity_id}/close`, {
                      closingAmount: data.closingCash || data.closing_cash || 0,
                      notes: data.notes || 'Fechado via Electron Desktop'
                    });
                    console.log('✅ Caixa criado e fechado no backend:', entity_id);
                    return { success: true };
                  }
                } catch (createError) {
                  console.error('❌ Erro ao criar caixa antes de fechar:', createError);
                }
              }
              throw closeError;
            }
          }
          // Outra atualização de caixa
          return { skip: true, success: false, reason: 'Atualização de caixa não suportada (apenas abertura/fechamento)' };
        }
        return { skip: true, success: false, reason: 'Operação de caixa não suportada' };
        
      case 'debt_payment':
        // Pagamento de dívida - deve chamar POST /debts/:debtId/pay
        if (operation === 'create' && data.debtId) {
          await this.apiClient.post(`/debts/${data.debtId}/pay`, {
            amount: data.amount,
            method: data.method || 'cash',
            reference: data.reference,
            notes: data.notes,
          });
          console.log('✅ Pagamento de dívida sincronizado:', data.debtId);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Pagamento de dívida sem debtId' };
      
      case 'debt':
        // Dívida - sincronizar criação e atualização
        if (operation === 'create') {
          // Criar dívida no backend com o mesmo ID do Electron
          await this.apiClient.post('/debts', {
            id: entity_id, // Usar o mesmo ID para manter consistência
            customerId: data.customerId || data.customer_id,
            saleId: data.saleId || data.sale_id,
            branchId: data.branchId || data.branch_id,
            amount: data.amount || data.originalAmount || data.original_amount,
            notes: data.notes,
          });
          console.log('✅ Dívida criada no backend:', entity_id);
          return { success: true };
        } else if (operation === 'update') {
          // Usar PATCH para atualizar parcialmente (status, valores pagos)
          await this.apiClient.patch(`/debts/${entity_id}`, {
            paidAmount: data.paidAmount || data.paid_amount,
            balance: data.balance,
            status: data.status,
          });
          console.log('✅ Dívida atualizada no backend:', entity_id, '- Status:', data.status);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de dívida não suportada' };
      
      case 'inventory':
      case 'inventory_item':
        // Inventário - sincronizar usando valores absolutos via POST /inventory (upsert)
        if (operation === 'update' || operation === 'create') {
          // Usar POST /inventory que faz upsert com valores absolutos
          await this.apiClient.post('/inventory', {
            productId: data.productId || data.product_id,
            branchId: data.branchId || data.branch_id,
            qtyUnits: data.qtyUnits ?? data.qty_units ?? 0,
            closedBoxes: data.closedBoxes ?? data.closed_boxes ?? 0,
            openBoxUnits: data.openBoxUnits ?? data.open_box_units ?? 0,
            minStock: 10,
            synced: true,
          });
          console.log('✅ Estoque sincronizado (upsert):', data.productId, 'Qty:', data.qtyUnits ?? data.qty_units ?? 0);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de inventário não suportada' };
        
      case 'customer_loyalty':
        // Fidelidade - não existe endpoint separado
        return { skip: true, success: false, reason: 'Lealdade gerenciada via customer' };
        
      case 'purchase_item':
        // Itens de compra devem ser adicionados via POST /purchases/:purchaseId/items
        if (operation === 'create' && data.purchaseId) {
          // Verificar se a compra existe primeiro
          try {
            const purchaseCheck = await this.apiClient.get(`/purchases/${data.purchaseId}`);
            // Se a compra está completed, tentar reabrir
            if (purchaseCheck.data?.status === 'completed') {
              console.log(`⚠️ Compra ${data.purchaseId} está completed, tentando reabrir...`);
              await this.apiClient.put(`/purchases/${data.purchaseId}`, { status: 'pending' });
            }
          } catch (checkError: any) {
            if (checkError.response?.status === 404) {
              console.log(`⏳ Compra ${data.purchaseId} ainda não existe no servidor, adiando item...`);
              throw new Error(`Compra ${data.purchaseId} não encontrada - aguardando sync`);
            }
            throw checkError;
          }
          
          await this.apiClient.post(`/purchases/${data.purchaseId}/items`, {
            productId: data.productId || data.product_id,
            qtyUnits: data.qtyUnits || data.qty_units || 0,
            qtyBoxes: data.qtyBoxes || data.qty_boxes || 0,
            unitCost: data.unitCost || data.unit_cost || 0,
          });
          console.log('✅ Item de compra sincronizado:', entity_id);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Item de compra sem purchaseId' };
      
      case 'purchase':
        // Compra - sincronizar criação e atualização
        if (operation === 'create') {
          // Verificar se já existe
          try {
            const existing = await this.apiClient.get(`/purchases/${entity_id}`);
            if (existing.data) {
              console.log('⚠️ Compra já existe no servidor:', entity_id);
              return { success: true };
            }
          } catch (e: any) {
            // 404 é esperado - compra não existe
          }
          
          await this.apiClient.post('/purchases', {
            id: entity_id,
            purchaseNumber: data.purchaseNumber || data.purchase_number,
            branchId: data.branchId || data.branch_id,
            supplierId: data.supplierId || data.supplier_id,
            status: 'pending', // Criar como pending para permitir adicionar itens
            total: data.total || 0,
            notes: data.notes,
          });
          console.log('✅ Compra sincronizada:', entity_id);
          return { success: true };
        } else if (operation === 'update') {
          // Construir payload apenas com campos definidos
          const updatePayload: any = {};
          if (data.status) updatePayload.status = data.status;
          if (data.total !== undefined && data.total !== null) updatePayload.total = data.total;
          if (data.notes !== undefined) updatePayload.notes = data.notes;
          
          await this.apiClient.put(`/purchases/${entity_id}`, updatePayload);
          console.log('✅ Compra atualizada no backend:', entity_id, '- Status:', data.status);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de compra não suportada' };
        
      default:
        // Entidades normais - usar endpoint padrão
        const endpoint = this.getEndpoint(entity, operation);
        
        if (operation === 'create') {
          await this.apiClient.post(endpoint, data);
        } else if (operation === 'update') {
          await this.apiClient.put(`${endpoint}/${entity_id || ''}`, data);
        } else if (operation === 'delete') {
          await this.apiClient.delete(`${endpoint}/${entity_id || ''}`);
        }
        
        return { success: true };
    }
  }

  private getEndpoint(entity: string, operation: string): string {
    const endpoints: Record<string, string> = {
      product: '/products',
      products: '/products',
      customer: '/customers',
      customers: '/customers',
      sale: '/sales',
      sales: '/sales',
      user: '/users',
      users: '/users',
      category: '/categories',
      categories: '/categories',
      supplier: '/suppliers',
      suppliers: '/suppliers',
      branch: '/branches',
      branches: '/branches',
      debt: '/debts',
      debts: '/debts',
      cash_box: '/cash-box',
      cashBox: '/cash-box',
      inventory_item: '/inventory',
      inventory: '/inventory',
      table: '/tables',
      tables: '/tables',
      table_session: '/table-sessions',
    };
    
    return endpoints[entity] || `/${entity}s`;
  }

  async forcePush() {
    await this.pushLocalChanges();
  }

  getStatus() {
    const pending = this.dbManager.getPendingSyncItems();
    return {
      isRunning: this.isRunning,
      pendingItems: pending.length,
      lastSync: this.lastSync,
      isOnline: this._isOnline,
      hasValidToken: this.token !== null && this.token !== 'offline-token',
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.apiClient.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Tenta reautenticar com as últimas credenciais quando reconectar
   * Usado para converter token offline para token válido
   */
  async tryReauthenticate(retries = 3): Promise<boolean> {
    console.log('🔍 tryReauthenticate chamado (tentativas restantes:', retries + ')');
    console.log('   - lastCredentials existe?', !!this.lastCredentials);
    console.log('   - Token atual:', this.token);
    
    if (!this.lastCredentials) {
      console.log('❌ Sem credenciais salvas para reautenticação');
      return false;
    }

    if (this.token !== 'offline-token') {
      console.log('ℹ️ Token já é válido, reautenticação não necessária');
      return true;
    }

    try {
      console.log('🔄 Tentando reautenticar com backend...');
      console.log('   - Email:', this.lastCredentials.email);
      console.log('   - Password length:', this.lastCredentials.password?.length);
      console.log('   - API Base URL:', this.apiClient.defaults.baseURL);
      
      const response = await this.apiClient.post('/auth/login', this.lastCredentials, {
        timeout: 5000, // 5 segundos timeout
      });
      this.token = response.data.accessToken;
      
      console.log('✅ Reautenticação bem-sucedida! Token offline convertido para token válido');
      console.log('   - Novo token:', this.token?.substring(0, 20) + '...');
      this.emit('sync:reauthenticated', { success: true });
      
      // Iniciar sincronização imediatamente
      console.log('🚀 Iniciando sincronização após reautenticação...');
      await this.syncNow();
      
      return true;
    } catch (error: any) {
      console.error('❌ Falha na reautenticação (tentativa ' + (4 - retries) + '/3):');
      console.error('   - Erro:', error?.message || 'Erro desconhecido');
      console.error('   - Response data:', JSON.stringify(error?.response?.data));
      console.error('   - Status:', error?.response?.status);
      console.error('   - Status text:', error?.response?.statusText);
      
      // Se for 401, tentar criar usuário no backend
      if (error?.response?.status === 401) {
        console.log('⚠️ Erro 401: Usuário não existe no backend, tentando criar...');
        
        try {
          // Buscar dados do usuário no banco local
          console.log('🔍 Buscando usuário local:', this.lastCredentials.email);
          const localUser = this.dbManager.getUserByEmail(this.lastCredentials.email) as any;
          
          if (!localUser) {
            console.error('❌ Usuário não encontrado no banco local');
            this.emit('sync:reauthenticated', { success: false, error: '401 - Usuário não encontrado' });
            return false;
          }
          
          console.log('✅ Usuário local encontrado:', JSON.stringify({
            email: localUser.email,
            full_name: localUser.full_name,
            name: localUser.name,
            role: localUser.role,
            branch_id: localUser.branch_id,
            language: localUser.language,
          }));
          
          console.log('📝 Criando usuário no backend...');
          
          const registerPayload = {
            email: localUser.email,
            password: this.lastCredentials.password,
            fullName: localUser.full_name || localUser.name,
            phone: localUser.phone || undefined,
            role: localUser.role || 'cashier',
            branchId: localUser.branch_id || undefined,
            language: localUser.language || 'pt',
          };
          
          console.log('📤 Payload de registro:', JSON.stringify(registerPayload, null, 2));
          
          // Criar usuário no backend via endpoint de registro
          const registerResponse = await this.apiClient.post('/auth/register', registerPayload);
          
          console.log('✅ Resposta do registro:', JSON.stringify(registerResponse.data));
          console.log('✅ Usuário criado no backend! Tentando login novamente...');
          
          // Tentar login novamente agora que usuário existe
          const loginResponse = await this.apiClient.post('/auth/login', this.lastCredentials, {
            timeout: 5000,
          });
          
          this.token = loginResponse.data.accessToken;
          console.log('✅ Login bem-sucedido após criar usuário!');
          this.emit('sync:reauthenticated', { success: true });
          
          // Iniciar sincronização
          console.log('🚀 Iniciando sincronização...');
          await this.syncNow();
          
          return true;
        } catch (createError: any) {
          console.error('❌ Erro ao criar usuário no backend:', createError?.message);
          console.error('   - Status:', createError?.response?.status);
          console.error('   - Data:', JSON.stringify(createError?.response?.data));
          
          // Se usuário já existe (409 ou erro de constraint único), tentar login direto
          const isUserExists = 
            createError?.response?.status === 409 || 
            createError?.response?.status === 400 ||
            createError?.message?.includes('Unique constraint') ||
            createError?.message?.includes('already exists') ||
            createError?.response?.data?.message?.includes('already exists') ||
            createError?.response?.data?.message?.includes('unique constraint');
          
          if (isUserExists) {
            console.log('💡 Usuário já existe no backend, tentando login direto...');
            try {
              const loginResponse = await this.apiClient.post('/auth/login', this.lastCredentials, { 
                timeout: 5000 
              });
              this.token = loginResponse.data.accessToken;
              console.log('✅ Login bem-sucedido com usuário existente!');
              this.emit('sync:reauthenticated', { success: true });
              
              console.log('🚀 Iniciando sincronização...');
              await this.syncNow();
              return true;
            } catch (loginError: any) {
              console.error('❌ Falha no login após detectar usuário existente:', loginError?.message);
              console.error('   - Status:', loginError?.response?.status);
              console.error('   - Data:', JSON.stringify(loginError?.response?.data));
              this.emit('sync:reauthenticated', { 
                success: false, 
                error: 'Login falhou após verificar usuário existente' 
              });
              return false;
            }
          }
          
          // Outros erros
          console.log('💡 O sistema continuará funcionando offline');
          this.emit('sync:reauthenticated', { success: false, error: 'Falha ao criar usuário no backend' });
          return false;
        }
      }
      
      // Retry com backoff exponencial (apenas para erros de rede/timeout)
      if (retries > 0) {
        const delay = (4 - retries) * 2000; // 2s, 4s, 6s
        console.log(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.tryReauthenticate(retries - 1);
      }
      
      this.emit('sync:reauthenticated', { success: false, error: error?.message });
      return false;
    }
  }

  /**
   * Push inicial completo - envia TODOS os dados existentes no SQLite para o servidor
   * Use esta função quando precisar sincronizar dados que já existiam antes do sistema de sync
   */
  async pushFullInitialSync(): Promise<{ success: boolean; summary: Record<string, { sent: number; errors: number }> }> {
    console.log('🚀 Iniciando PUSH INICIAL COMPLETO de todos os dados...');
    this.emit('sync:progress', { progress: 0, message: 'Iniciando push completo...' });

    if (!this.token || this.token === 'offline-token') {
      console.error('❌ Token inválido para push completo');
      return { success: false, summary: {} };
    }

    const summary: Record<string, { sent: number; errors: number }> = {};

    // Entidades a sincronizar na ordem correta (respeitando dependências)
    // Usando métodos existentes do DatabaseManager
    const entities = [
      { name: 'categories', getter: () => this.dbManager.getCategories(), endpoint: '/categories' },
      { name: 'suppliers', getter: () => this.dbManager.getSuppliers(), endpoint: '/suppliers' },
      { name: 'products', getter: () => this.dbManager.getProducts(), endpoint: '/products' },
      { name: 'customers', getter: () => this.dbManager.getCustomers(), endpoint: '/customers' },
    ];

    let totalProgress = 0;
    const progressStep = 100 / entities.length;

    for (const entity of entities) {
      console.log(`📦 Sincronizando ${entity.name}...`);
      summary[entity.name] = { sent: 0, errors: 0 };

      try {
        const items = entity.getter() as any[];
        console.log(`   📊 ${items.length} itens encontrados`);

        // Buscar itens existentes no servidor para evitar duplicação
        let existingIds = new Set<string>();
        try {
          const serverItems = await this.apiClient.get(entity.endpoint);
          const serverData = Array.isArray(serverItems.data) ? serverItems.data : serverItems.data?.value || [];
          existingIds = new Set(serverData.map((s: any) => s.id));
          console.log(`   📋 ${existingIds.size} itens já existem no servidor`);
        } catch (e) {
          console.log(`   ⚠️ Não foi possível buscar itens existentes`);
        }

        for (const item of items) {
          try {
            // Preparar dados (remover campos que não devem ser enviados)
            const data = this.prepareDataForSync(entity.name, item);
            
            // Verificar se já existe no servidor pelo ID
            if (existingIds.has(item.id)) {
              // Atualizar item existente (PUT)
              try {
                await this.apiClient.put(`${entity.endpoint}/${item.id}`, data);
                summary[entity.name].sent++;
                console.log(`   🔄 ${entity.name}[${item.id}] atualizado`);
              } catch (updateError: any) {
                summary[entity.name].errors++;
                console.error(`   ❌ ${entity.name}[${item.id}] erro ao atualizar:`, updateError?.response?.data?.message || updateError?.message);
              }
            } else {
              // Criar novo item (POST)
              try {
                await this.apiClient.post(entity.endpoint, data);
                summary[entity.name].sent++;
                console.log(`   ✅ ${entity.name}[${item.id}] criado`);
              } catch (createError: any) {
                // Se falhar com 400/409, pode ser duplicação por nome - ignorar
                if (createError?.response?.status === 409 || createError?.response?.status === 400) {
                  console.log(`   ⚠️ ${entity.name}[${item.id}] já existe ou inválido, ignorando`);
                  summary[entity.name].sent++; // Considerar como "ok" pois já existe
                } else {
                  summary[entity.name].errors++;
                  console.error(`   ❌ ${entity.name}[${item.id}] erro:`, createError?.response?.data?.message || createError?.message);
                }
              }
            }
          } catch (error: any) {
            summary[entity.name].errors++;
            console.error(`   ❌ ${entity.name}[${item.id}] erro geral:`, error?.message);
          }
        }
      } catch (entityError: any) {
        console.error(`❌ Erro ao processar ${entity.name}:`, entityError?.message);
        summary[entity.name].errors++;
      }

      totalProgress += progressStep;
      this.emit('sync:progress', { 
        progress: Math.min(totalProgress, 100), 
        message: `${entity.name}: ${summary[entity.name].sent} enviados, ${summary[entity.name].errors} erros` 
      });
    }

    console.log('📊 RESUMO DO PUSH INICIAL:');
    let totalSent = 0;
    let totalErrors = 0;
    for (const [entityName, stats] of Object.entries(summary)) {
      console.log(`   ${entityName}: ${stats.sent} enviados, ${stats.errors} erros`);
      totalSent += stats.sent;
      totalErrors += stats.errors;
    }
    console.log(`   TOTAL: ${totalSent} enviados, ${totalErrors} erros`);

    const success = totalErrors === 0;
    this.emit('sync:completed', { 
      success, 
      type: 'full-initial-sync',
      summary,
      lastSync: new Date() 
    });

    return { success, summary };
  }

  /**
   * Prepara os dados de uma entidade para envio ao servidor
   * Mapeia campos do SQLite para o formato esperado pelo backend
   */
  private prepareDataForSync(entityName: string, item: any): any {
    // Clone para não modificar o original
    const data: any = {};

    // Mapeamentos específicos por entidade (SQLite -> Backend)
    if (entityName === 'categories') {
      data.name = item.name;
      data.description = item.description;
      data.parentId = item.parent_id;
      data.sortOrder = item.sort_order || 0;
      data.isActive = item.is_active === 1;
      if (item.id) data.id = item.id;
    }
    else if (entityName === 'sale') {
      // Venda - mapear campos do desktop para o backend
      data.branchId = item.branchId || item.branch_id || 'main-branch';
      data.type = item.type || 'counter';
      data.customerId = item.customerId || item.customer_id;
      data.tableId = item.tableId || item.table_id;
      // Campos de valores e status
      data.subtotal = item.subtotal ?? item.sub_total ?? 0;
      data.total = item.total ?? 0;
      data.discountTotal = item.discountTotal ?? item.discount_total ?? 0;
      data.status = item.status || 'open';
      data.notes = item.notes;
      // Nome do cliente para vendas de mesa sem cadastro
      data.customerName = item.customerName ?? item.customer_name;
      data.saleNumber = item.saleNumber ?? item.sale_number;
      // Campos de pagamento (para referência)
      data.paymentMethod = item.paymentMethod ?? item.payment_method;
      if (item.id) data.id = item.id;
    }
    else if (entityName === 'suppliers') {
      data.name = item.name;
      data.code = item.code;
      data.contactPerson = item.contact_person;
      data.phone = item.phone;
      data.email = item.email;
      data.address = item.address;
      data.taxId = item.tax_id;
      data.paymentTerms = item.payment_terms;
      data.notes = item.notes;
      data.isActive = item.is_active === 1;
      if (item.id) data.id = item.id;
    }
    else if (entityName === 'products') {
      data.name = item.name;
      data.description = item.description;
      data.sku = item.sku;
      data.barcode = item.barcode;
      data.categoryId = item.category_id;
      data.unitsPerBox = item.units_per_box || 1;
      data.priceUnit = Math.round((item.sell_price || 0) * 100); // Converter para centavos
      data.priceBox = Math.round((item.sell_price || 0) * (item.units_per_box || 1) * 100);
      data.costUnit = Math.round((item.cost_price || 0) * 100);
      data.costBox = Math.round((item.cost_price || 0) * (item.units_per_box || 1) * 100);
      data.minStock = item.low_stock_alert || 0;
      data.isActive = item.is_active === 1;
      data.trackInventory = true;
      if (item.id) data.id = item.id;
    }
    else if (entityName === 'customers' || entityName === 'customer') {
      data.name = item.full_name || item.name || 'Cliente';
      data.fullName = item.full_name || item.name;
      data.phone = item.phone;
      data.email = item.email;
      data.code = item.code;
      // Aceitar tanto creditLimit quanto credit_limit
      data.creditLimit = item.creditLimit ?? item.credit_limit ?? 0;
      data.loyaltyPoints = item.loyalty_points ?? item.loyaltyPoints ?? 0;
      data.address = item.address;
      data.notes = item.notes;
      if (item.id) data.id = item.id;
    }
    else {
      // Fallback: copiar todos os campos com mapeamento básico
      for (const [key, value] of Object.entries(item)) {
        // Converter snake_case para camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        data[camelKey] = value;
      }
    }

    // Remover campos nulos ou undefined
    for (const key of Object.keys(data)) {
      if (data[key] === null || data[key] === undefined) {
        delete data[key];
      }
    }

    return data;
  }
}
