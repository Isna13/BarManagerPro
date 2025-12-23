import axios, { AxiosInstance, AxiosError } from 'axios';
import { DatabaseManager } from '../database/manager';
import { BrowserWindow } from 'electron';
import { tryNormalizePaymentMethod, isValidPaymentMethod, PaymentMethod } from '../shared/payment-methods';

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

  /**
   * Retorna o token de autenticação atual
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Verifica se o token é válido (não é null e não é offline-token)
   */
  hasValidToken(): boolean {
    return this.token !== null && this.token !== 'offline-token';
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
   * Também verifica se existe caixa aberto sincronizado
   */
  isLocalDatabaseEmpty(): boolean {
    try {
      const products = this.dbManager.getProducts() as any[];
      const customers = this.dbManager.getCustomers() as any[];
      const sales = this.dbManager.getSales({}) as any[];
      
      // Verificar se existe caixa aberto
      let currentCashBox = null;
      try {
        currentCashBox = this.dbManager.getCurrentCashBox?.() || null;
      } catch (e) {
        // Ignorar erro se método não existir
      }
      
      const isEmpty = products.length === 0 && customers.length === 0 && sales.length === 0;
      const needsCashBoxSync = !currentCashBox && products.length > 0;
      
      console.log(`📊 Verificação do banco local: ${isEmpty ? 'VAZIO' : 'COM DADOS'}`);
      console.log(`   - Produtos: ${products.length}`);
      console.log(`   - Clientes: ${customers.length}`);
      console.log(`   - Vendas: ${sales.length}`);
      console.log(`   - Caixa atual: ${currentCashBox ? 'SIM' : 'NÃO'}`);
      
      // Retorna true se banco vazio OU se precisa sincronizar caixa
      if (needsCashBoxSync) {
        console.log(`⚠️ Banco tem dados mas não tem caixa - forçando sync inicial`);
      }
      
      return isEmpty || needsCashBoxSync;
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
      { name: 'inventory', endpoint: '/inventory' },
      { name: 'inventory_movements', endpoint: '/inventory/movements?limit=500' },
      { name: 'debts', endpoint: '/debts' },
      { name: 'tables', endpoint: '/tables' },
      { name: 'table_sessions', endpoint: '/tables/sessions?status=open' },
      { name: 'sales', endpoint: '/sales?limit=500' },
      { name: 'cash_boxes', endpoint: '/cash-box?limit=500' }, // Usar endpoint raiz
      { name: 'purchases', endpoint: '/purchases?limit=500' }, // Adicionar limite
      { name: 'settings', endpoint: '/settings' },
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
        if (error?.response?.status === 401) {
          console.log(`   ⚠️ ${entity.name}: token inválido ou expirado (401)`);
          // Tentar reautenticar uma vez
          if (this.lastCredentials) {
            console.log(`   🔄 Tentando reautenticação...`);
            try {
              await this.tryReauthenticate(1);
              // Tentar novamente após reautenticação
              const retryResponse = await this.apiClient.get(entity.endpoint, { timeout: 30000 });
              const retryItems = Array.isArray(retryResponse.data) ? retryResponse.data : retryResponse.data?.data || [];
              console.log(`   ✅ ${entity.name}: ${retryItems.length} itens (após reauth)`);
              stats[entity.name] = retryItems.length;
              if (retryItems.length > 0) {
                await this.mergeEntityData(entity.name, retryItems);
              }
            } catch (reauthError) {
              console.error(`   ❌ Falha na reautenticação para ${entity.name}`);
              stats[entity.name] = -1;
            }
          } else {
            stats[entity.name] = -1;
          }
        } else if (error?.response?.status === 404) {
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

    // Buscar caixa ativo atual (separadamente do histórico)
    try {
      console.log('📥 Buscando caixa ativo...');
      const currentCashBoxResponse = await this.apiClient.get('/cash-box/current', { timeout: 15000 });
      console.log('   📦 Resposta do caixa atual:', JSON.stringify(currentCashBoxResponse.data).substring(0, 200));
      
      if (currentCashBoxResponse.data && currentCashBoxResponse.data.id) {
        console.log(`   ✅ Caixa ativo encontrado: ${currentCashBoxResponse.data.id} (status: ${currentCashBoxResponse.data.status})`);
        
        // FORÇAR inserção/atualização do caixa atual, ignorando conflitos
        const cashBoxData = currentCashBoxResponse.data;
        try {
          const existingCashBox = this.dbManager.getCashBoxById ? this.dbManager.getCashBoxById(cashBoxData.id) : null;
          
          if (existingCashBox) {
            // Atualizar caixa existente
            this.dbManager.prepare(`
              UPDATE cash_boxes SET
                status = ?,
                closing_cash = ?,
                total_sales = ?,
                total_cash = ?,
                total_card = ?,
                total_mobile_money = ?,
                total_debt = ?,
                difference = ?,
                closed_at = ?,
                synced = 1,
                updated_at = datetime('now')
              WHERE id = ?
            `).run(
              cashBoxData.status || 'open',
              cashBoxData.closingCash || cashBoxData.closing_cash || null,
              cashBoxData.totalSales || cashBoxData.total_sales || cashBoxData.stats?.totalSales || 0,
              cashBoxData.totalCash || cashBoxData.total_cash || cashBoxData.stats?.cashPayments || 0,
              cashBoxData.totalCard || cashBoxData.total_card || cashBoxData.stats?.cardPayments || 0,
              cashBoxData.totalMobileMoney || cashBoxData.total_mobile_money || cashBoxData.stats?.mobileMoneyPayments || 0,
              cashBoxData.totalDebt || cashBoxData.total_debt || cashBoxData.stats?.debtPayments || 0,
              cashBoxData.difference || 0,
              cashBoxData.closedAt || cashBoxData.closed_at || null,
              cashBoxData.id
            );
            console.log(`   📝 Caixa ativo ATUALIZADO: ${cashBoxData.id}`);
          } else {
            // Inserir novo caixa
            this.dbManager.prepare(`
              INSERT INTO cash_boxes (id, box_number, branch_id, opened_by, status, opening_cash, closing_cash, total_sales, total_cash, total_card, total_mobile_money, total_debt, difference, notes, opened_at, closed_at, synced, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `).run(
              cashBoxData.id,
              cashBoxData.boxNumber || cashBoxData.box_number || `CX-${Date.now()}`,
              cashBoxData.branchId || cashBoxData.branch_id || 'main-branch',
              cashBoxData.openedBy || cashBoxData.opened_by || 'unknown',
              cashBoxData.status || 'open',
              cashBoxData.openingCash || cashBoxData.opening_cash || 0,
              cashBoxData.closingCash || cashBoxData.closing_cash || null,
              cashBoxData.totalSales || cashBoxData.total_sales || cashBoxData.stats?.totalSales || 0,
              cashBoxData.totalCash || cashBoxData.total_cash || cashBoxData.stats?.cashPayments || 0,
              cashBoxData.totalCard || cashBoxData.total_card || cashBoxData.stats?.cardPayments || 0,
              cashBoxData.totalMobileMoney || cashBoxData.total_mobile_money || cashBoxData.stats?.mobileMoneyPayments || 0,
              cashBoxData.totalDebt || cashBoxData.total_debt || cashBoxData.stats?.debtPayments || 0,
              cashBoxData.difference || 0,
              cashBoxData.notes || null,
              cashBoxData.openedAt || cashBoxData.opened_at || new Date().toISOString(),
              cashBoxData.closedAt || cashBoxData.closed_at || null
            );
            console.log(`   ➕ Caixa ativo INSERIDO: ${cashBoxData.id} (status: ${cashBoxData.status})`);
          }
          stats['cash_box_current'] = 1;
        } catch (insertError: any) {
          console.error(`   ❌ Erro ao salvar caixa ativo: ${insertError?.message}`);
          stats['cash_box_current'] = -1;
        }
      } else {
        console.log('   ℹ️ Nenhum caixa ativo no servidor (resposta vazia ou null)');
        stats['cash_box_current'] = 0;
      }
    } catch (error: any) {
      console.error('   ❌ Erro ao buscar caixa ativo:', error?.response?.status, error?.message);
      if (error?.response?.status !== 404) {
        console.error('   ❌ Detalhes:', error?.response?.data);
      }
      stats['cash_box_current'] = 0;
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
        
        // Parse allowed_tabs do banco de dados
        let allowedTabs: string[] = [];
        if (user.allowed_tabs) {
          try {
            allowedTabs = JSON.parse(user.allowed_tabs);
          } catch (e) {
            console.warn('⚠️ Erro ao parsear allowed_tabs:', e);
          }
        }
        
        this.token = 'offline-token';
        const offlineUser = {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            branchId: user.branch_id,
            permissions: user.role === 'admin' || user.role === 'owner' ? ['*'] : [],
            allowedTabs: allowedTabs,
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
    
    // Atualizar heartbeat do dispositivo
    this.dbManager.updateDeviceHeartbeat();
    
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
          // Log de auditoria - sucesso
          this.dbManager.logSyncAudit({
            action: item.operation,
            entity: item.entity,
            entityId: item.entity_id,
            direction: 'push',
            status: 'success',
            details: { itemId: item.id },
          });
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
        
        // Log de auditoria - erro
        this.dbManager.logSyncAudit({
          action: item.operation,
          entity: item.entity,
          entityId: item.entity_id,
          direction: 'push',
          status: 'error',
          errorMessage: errorMsg,
        });
        
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
    
    // Atualizar última sincronização do dispositivo
    this.dbManager.updateDeviceLastSync();
    
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
      
      // Entidades de mesa (ordenadas por dependência)
      'table_session': 12, // Sessões dependem de mesas (priority 11)
      'table_customer': 13, // Clientes de mesa dependem de sessões
      'table_order': 14, // Pedidos dependem de clientes de mesa
      'table_payment': 15, // Pagamentos dependem de sessões e clientes
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
      // Algumas entidades precisam de sync completo (não incremental)
      // CORREÇÃO COMPLETA: Após reset, lastSyncDate é null, forçando sync completo
      // Entidades com fullSync: true sempre buscam todos os registros (independente de lastSyncDate)
      const entities = [
        { name: 'branches', endpoint: '/branches', fullSync: true },
        { name: 'users', endpoint: '/users' },
        { name: 'categories', endpoint: '/categories', fullSync: true },
        { name: 'products', endpoint: '/products', fullSync: true },
        { name: 'customers', endpoint: '/customers', fullSync: true }, // Clientes sempre sync completo (necessário para debts)
        { name: 'suppliers', endpoint: '/suppliers', fullSync: true }, // CORREÇÃO: Fornecedores precisam de sync completo
        { name: 'inventory', endpoint: '/inventory', fullSync: true },
        { name: 'debts', endpoint: '/debts', fullSync: true }, // Dívidas sempre sync completo
        { name: 'purchases', endpoint: '/purchases?limit=500', fullSync: true }, // CORREÇÃO: Compras precisam de sync completo
        { name: 'cash_boxes', endpoint: '/cash-box?limit=500', fullSync: true }, // CORREÇÃO: Caixas precisam de sync completo
        { name: 'sales', endpoint: '/sales?limit=500', fullSync: true },
        { name: 'tables', endpoint: '/tables', fullSync: true },
        { name: 'table_sessions', endpoint: '/table-sessions', fullSync: true }, // Rota separada para evitar conflito com /tables/:id
      ];
      
      console.log('🔍 DEBUG: Entidades para sincronizar:', entities.map(e => e.name).join(', '));
      
      for (const entity of entities) {
        try {
          console.log(`📥 Sincronizando ${entity.name}...`);
          
          // Construir URL com parâmetro de data se houver última sincronização
          // Entidades com fullSync: true sempre buscam todos os registros
          let url = entity.endpoint;
          if (lastSyncDate && !entity.fullSync) {
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
   * Sincroniza apenas dívidas do servidor para o desktop
   * Usado quando a aba Dívidas é aberta para garantir dados atualizados
   */
  async syncDebtsFromServer() {
    if (!this.isOnline) {
      console.log('📴 Offline - usando dívidas locais');
      return;
    }

    try {
      console.log('📥 Sincronizando dívidas do servidor...');
      
      // 1. Primeiro sincronizar clientes (necessário para dívidas)
      try {
        const customersResponse = await this.apiClient.get('/customers', { timeout: 15000 });
        const customers = Array.isArray(customersResponse.data) ? customersResponse.data : customersResponse.data?.data || [];
        if (customers.length > 0) {
          await this.mergeEntityData('customers', customers);
          console.log(`✅ Clientes: ${customers.length} sincronizados`);
        }
      } catch (custError: any) {
        console.warn('⚠️ Erro ao sincronizar clientes:', custError?.message);
      }
      
      // 2. Sincronizar dívidas
      const debtsResponse = await this.apiClient.get('/debts', { timeout: 15000 });
      const debts = Array.isArray(debtsResponse.data) ? debtsResponse.data : debtsResponse.data?.data || [];
      
      if (debts.length > 0) {
        await this.mergeEntityData('debts', debts);
        console.log(`✅ Dívidas: ${debts.length} sincronizadas`);
      } else {
        console.log('ℹ️ Nenhuma dívida no servidor');
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar dívidas:', error?.message);
      throw error;
    }
  }
  
  /**
   * Verifica se um item local tem alterações pendentes (não sincronizadas)
   * Retorna true se o item NÃO deve ser sobrescrito pelo servidor
   * 
   * FASE 3: Agora também detecta e registra conflitos
   */
  private hasLocalPendingChanges(entityName: string, itemId: string, existing: any, serverItem?: any): boolean {
    // Se não existe localmente, não há conflito
    if (!existing) return false;
    
    // Verificar se synced = 0 (alteração local pendente)
    const synced = existing.synced ?? existing.is_synced ?? 1;
    if (synced === 0) {
      console.log(`⚠️ ${entityName} ${itemId}: mantendo alterações locais pendentes (synced=0)`);
      
      // FASE 3: Registrar conflito se temos dados do servidor
      if (serverItem) {
        this.registerConflictIfNeeded(entityName, itemId, existing, serverItem);
      }
      
      return true;
    }
    
    // Verificar se está na fila de sincronização
    const pendingItems = this.dbManager.getPendingSyncItems() as SyncItem[];
    const hasPendingSync = pendingItems.some(
      item => item.entity === entityName.slice(0, -1) && item.entity_id === itemId
    );
    
    if (hasPendingSync) {
      console.log(`⚠️ ${entityName} ${itemId}: mantendo alterações locais (na fila de sync)`);
      
      // FASE 3: Registrar conflito se temos dados do servidor
      if (serverItem) {
        this.registerConflictIfNeeded(entityName, itemId, existing, serverItem);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * FASE 3: Registra conflito se os dados locais e do servidor são diferentes
   */
  private registerConflictIfNeeded(entityName: string, itemId: string, localData: any, serverData: any): void {
    try {
      // Verificar se realmente há diferença significativa
      const localUpdated = new Date(localData.updated_at || localData.updatedAt || 0);
      const serverUpdated = new Date(serverData.updated_at || serverData.updatedAt || 0);
      
      // Se os timestamps são iguais, não há conflito real
      if (Math.abs(localUpdated.getTime() - serverUpdated.getTime()) < 1000) {
        return;
      }
      
      // Registrar o conflito
      this.dbManager.registerSyncConflict({
        entity: entityName,
        entityId: itemId,
        localData: localData,
        serverData: serverData,
        serverDeviceId: serverData._deviceId,
        localTimestamp: localUpdated,
        serverTimestamp: serverUpdated,
      });
      
      // Log de auditoria
      this.dbManager.logSyncAudit({
        action: 'conflict_detected',
        entity: entityName,
        entityId: itemId,
        direction: 'pull',
        status: 'conflict',
        details: {
          localUpdated: localUpdated.toISOString(),
          serverUpdated: serverUpdated.toISOString(),
        },
      });
      
      // Emitir evento para UI
      this.emit('sync:conflict', {
        entity: entityName,
        entityId: itemId,
        localTimestamp: localUpdated,
        serverTimestamp: serverUpdated,
      });
      
    } catch (error: any) {
      console.error(`Erro ao registrar conflito para ${entityName}/${itemId}:`, error.message);
    }
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
            if (this.hasLocalPendingChanges('branches', item.id, existing, item)) {
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
            // Tentar encontrar por email (mais confiável)
            const existingByEmail = this.dbManager.getUserByEmail(item.email);
            // Também tentar por ID (pode ser o mesmo)
            const existingById = this.dbManager.getUserById(item.id);
            
            const existing = existingByEmail || existingById;
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (existing && this.hasLocalPendingChanges('users', (existing as any).id, existing, item)) {
              console.log(`⏳ Usuário ${item.email} tem alterações locais pendentes - pulando`);
              continue;
            }
            
            if (existing) {
              // Não sobrescrever senha local se usuário já existe
              // Processar allowedTabs - pode vir como string JSON ou array
              let allowedTabs = item.allowedTabs;
              if (typeof allowedTabs === 'string') {
                try {
                  allowedTabs = JSON.parse(allowedTabs);
                } catch (e) {
                  // Já é string, manter
                }
              }
              
              // Atualizar com o server_id do servidor
              this.dbManager.updateUserFromServer((existing as any).id, {
                username: item.username,
                email: item.email,
                full_name: item.fullName,
                role: item.role || item.roleName,
                branch_id: item.branchId,
                phone: item.phone,
                allowed_tabs: allowedTabs,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
                server_id: item.id, // Vincular ao ID do servidor
              });
              console.log(`✅ Usuário vinculado/atualizado: ${item.email} (server_id: ${item.id})`);
            } else {
              // Usuário existe no servidor mas não localmente
              // NOTA: Não criar localmente sem senha - apenas registrar
              console.log(`ℹ️ Usuário ${item.email} existe no servidor mas não localmente (sem senha para criar)`);
            }
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
            if (this.hasLocalPendingChanges('categories', item.id, existing, item)) {
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
            if (this.hasLocalPendingChanges('products', item.id, existing, item)) {
              continue;
            }
            
            if (existing) {
              this.dbManager.updateProduct(item.id, {
                name: item.name,
                sku: item.sku,
                barcode: item.barcode,
                description: item.description,
                categoryId: item.categoryId,
                supplierId: item.supplierId,
                priceBox: item.priceBox,
                priceUnit: item.priceUnit || 0,
                costUnit: item.costUnit || 0,
                costBox: item.costBox,
                unitsPerBox: item.unitsPerBox,
                lowStockAlert: item.lowStockAlert,
                isActive: item.isActive !== false ? 1 : 0,
                // MUNTU: Campos booleanos e numéricos - usar ?? para preservar false/0
                isMuntuEligible: item.isMuntuEligible ?? false,
                muntuQuantity: item.muntuQuantity ?? null,
                muntuPrice: item.muntuPrice ?? null,
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
                supplierId: item.supplierId,
                priceBox: item.priceBox || 0,
                priceUnit: item.priceUnit || 0,
                costUnit: item.costUnit || 0,
                costBox: item.costBox || null,
                unitsPerBox: item.unitsPerBox || 1,
                lowStockAlert: item.lowStockAlert || 10,
                isActive: item.isActive !== false ? 1 : 0,
                // MUNTU: Campos booleanos e numéricos - usar ?? para preservar false/0
                isMuntuEligible: item.isMuntuEligible ?? false,
                muntuQuantity: item.muntuQuantity ?? null,
                muntuPrice: item.muntuPrice ?? null,
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
        // LOGS DE RASTREABILIDADE para sincronização de clientes
        console.log(`\n👥 SYNC CUSTOMERS: Processando ${items.length} clientes do servidor`);
        let created = 0, updated = 0, skippedNoName = 0, skippedPending = 0;
        
        for (const item of items) {
          try {
            const existing = this.dbManager.getCustomerById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('customers', item.id, existing, item)) {
              skippedPending++;
              continue;
            }
            
            // Mapear name corretamente - backend pode enviar name, fullName ou firstName/lastName
            const fullName = item.name || item.fullName || 
              (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : null);
            
            if (!fullName) {
              console.warn(`⚠️ Cliente ${item.id} sem nome válido - pulando`);
              skippedNoName++;
              continue;
            }
            
            if (existing) {
              // Preservar creditLimit local se o servidor não enviar
              const existingAny = existing as any;
              const creditLimit = item.creditLimit !== undefined 
                ? item.creditLimit 
                : (existingAny.credit_limit || 0);
              
              // Obter loyalty_points e current_debt do servidor
              const loyaltyPoints = item.loyaltyPoints ?? item.loyalty_points ?? existingAny.loyalty_points ?? 0;
              const currentDebt = item.currentDebt ?? item.current_debt ?? existingAny.current_debt ?? 0;
              
              this.dbManager.updateCustomer(item.id, {
                name: fullName,
                email: item.email,
                phone: item.phone,
                code: item.code,
                address: item.address,
                creditLimit: creditLimit,
                loyalty_points: loyaltyPoints,
                current_debt: currentDebt,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
              updated++;
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
                current_debt: item.currentDebt ?? item.current_debt ?? 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
              created++;
              console.log(`   ➕ Cliente criado: ${fullName} (${item.code || 'sem código'})`);
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar customer ${item.id}:`, e?.message);
          }
        }
        
        // RESUMO DE SINCRONIZAÇÃO DE CLIENTES
        console.log(`📊 SYNC CUSTOMERS RESUMO:`);
        console.log(`   ✅ Criados: ${created}`);
        console.log(`   📝 Atualizados: ${updated}`);
        console.log(`   ⚠️ Pulados (sem nome): ${skippedNoName}`);
        console.log(`   ⏸️ Pulados (alterações locais): ${skippedPending}`);
      },
      
      suppliers: (items) => {
        console.log(`📦 SYNC SUPPLIERS: Processando ${items.length} fornecedores...`);
        let created = 0, updated = 0, errors = 0;
        
        for (const item of items) {
          try {
            const existing = this.dbManager.getSupplierById(item.id);
            
            // CORREÇÃO: Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('suppliers', item.id, existing, item)) {
              console.log(`⏸️ Supplier ${item.name} tem alterações locais pendentes`);
              continue;
            }
            
            // Gerar código se não existir
            const code = item.code || `SUP-${Date.now()}`;
            
            if (existing) {
              this.dbManager.updateSupplier(item.id, {
                code: code,
                name: item.name,
                email: item.email,
                phone: item.phone,
                address: item.address,
                contactPerson: item.contactPerson || item.contact_person,
                taxId: item.taxId || item.tax_id,
                paymentTerms: item.paymentTerms || item.payment_terms,
                notes: item.notes,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              }, true); // skipSyncQueue = true para evitar loop
              updated++;
              console.log(`📝 Supplier atualizado: ${item.name}`);
            } else {
              this.dbManager.createSupplier({
                id: item.id,
                code: code,
                name: item.name,
                email: item.email,
                phone: item.phone,
                address: item.address,
                contactPerson: item.contactPerson || item.contact_person,
                taxId: item.taxId || item.tax_id,
                paymentTerms: item.paymentTerms || item.payment_terms,
                notes: item.notes,
              }, true); // skipSyncQueue = true para evitar loop
              created++;
              console.log(`➕ Supplier criado: ${item.name}`);
            }
          } catch (e: any) {
            errors++;
            console.error(`❌ Erro ao mesclar supplier ${item.id} (${item.name}):`, e?.message);
          }
        }
        
        console.log(`📊 SYNC SUPPLIERS RESUMO: ✅ Criados: ${created} | 📝 Atualizados: ${updated} | ❌ Erros: ${errors}`);
      },
      
      inventory: (items) => {
        // Inventário - atualizar quantidades na tabela inventory_items
        console.log(`📦 Recebidos ${items.length} itens de inventário do servidor`);
        
        for (const item of items) {
          try {
            // O backend retorna items com productId e qtyUnits
            const productId = item.productId || item.product_id;
            const branchId = item.branchId || item.branch_id;
            
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
            
            // IMPORTANTE: Não usar closedBoxes/openBoxUnits do servidor se forem 0
            // O servidor Railway pode não ter esses campos corretamente preenchidos
            // O método updateInventoryItemByProductId vai calcular automaticamente baseado em qtyUnits
            const closedBoxes = (item.closedBoxes ?? item.closed_boxes) || undefined;
            const openBoxUnits = (item.openBoxUnits ?? item.open_box_units) || undefined;
            
            // Buscar item de inventário local
            const inventoryItem = this.dbManager.getInventoryItemByProductId(productId, branchId);
            
            if (inventoryItem) {
              // Verificar se há alterações locais pendentes no inventário
              if (inventoryItem.synced === 0) {
                console.log(`⚠️ Inventory item ${productId} tem alterações locais pendentes (synced=0), pulando...`);
                continue;
              }
              
              const currentStock = inventoryItem.qty_units ?? 0;
              
              // Só atualizar se houver diferença
              if (currentStock !== newQty) {
                console.log(`📦 Atualizando estoque: ${(product as any).name} (${productId})`);
                console.log(`   Local: ${currentStock} → Servidor: ${newQty}`);
                
                // Atualizar inventory_items diretamente
                const updated = this.dbManager.updateInventoryItemByProductId(productId, {
                  qtyUnits: newQty,
                  closedBoxes,
                  openBoxUnits,
                }, true); // skipSyncQueue = true para evitar loop
                
                if (updated) {
                  console.log(`✅ Estoque atualizado: ${(product as any).name} = ${newQty} unidades`);
                }
              } else {
                console.log(`ℹ️ Estoque já sincronizado: ${(product as any).name} = ${newQty}`);
              }
            } else {
              // Item não existe localmente - criar novo
              if (branchId) {
                console.log(`📦 Criando inventory item: ${(product as any).name} (${productId}) = ${newQty} unidades`);
                this.dbManager.createInventoryItemFromSync(productId, branchId, {
                  qtyUnits: newQty,
                  closedBoxes,
                  openBoxUnits,
                });
              } else {
                console.log(`⚠️ Não é possível criar inventory item sem branchId: ${productId}`);
              }
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar inventory ${item.id}:`, e?.message);
          }
        }
      },
      
      inventory_movements: (items) => {
        // Movimentações de estoque - sincronizar do servidor para o desktop
        console.log(`📦 Processando ${items.length} movimentações de estoque do servidor`);
        
        for (const item of items) {
          try {
            // Verificar se a movimentação já existe localmente
            const existing = this.dbManager.prepare(`
              SELECT id FROM stock_movements WHERE id = ?
            `).get(item.id);
            
            if (existing) {
              // Movimentação já existe, pular
              continue;
            }
            
            // Extrair dados da movimentação
            const productId = item.inventoryItem?.product?.id || item.productId || item.product_id;
            const branchId = item.inventoryItem?.branch?.id || item.branchId || item.branch_id;
            
            if (!productId) {
              console.log(`⚠️ Movimentação ${item.id} sem productId, pulando...`);
              continue;
            }
            
            // Criar nova movimentação
            this.dbManager.prepare(`
              INSERT INTO stock_movements (id, product_id, branch_id, movement_type, qty_units, qty_boxes, reason, reference_type, reference_id, notes, created_by, synced, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(
              item.id,
              productId,
              branchId || 'main-branch',
              item.movementType || item.movement_type || 'adjustment',
              item.qtyUnits || item.qty_units || 0,
              item.qtyBoxes || item.qty_boxes || 0,
              item.reason || null,
              item.referenceType || item.reference_type || null,
              item.referenceId || item.reference_id || null,
              item.notes || null,
              item.createdBy || item.created_by || null,
              item.createdAt || item.created_at || new Date().toISOString()
            );
            console.log(`➕ Movimentação criada: ${item.id} (${item.movementType || item.movement_type})`);
          } catch (e: any) {
            console.error(`Erro ao mesclar movement ${item.id}:`, e?.message);
          }
        }
      },
      
      debts: (items) => {
        // Débitos/Vales - sincronizar do servidor para o desktop
        // LOGS DE RASTREABILIDADE para diagnóstico de sincronização
        console.log(`\n📋 SYNC DEBTS: Processando ${items.length} dívidas do servidor`);
        let created = 0, updated = 0, skippedNoCustomer = 0, skippedPending = 0;
        
        for (const item of items) {
          try {
            const existing = this.dbManager.getDebtById ? this.dbManager.getDebtById(item.id) : null;
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('debts', item.id, existing, item)) {
              skippedPending++;
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
              updated++;
            } else {
              // Criar novo débito
              // Verificar se o cliente existe localmente
              const customerId = item.customerId || item.customer_id;
              const customerExists = this.dbManager.prepare(`SELECT id, full_name FROM customers WHERE id = ?`).get(customerId) as { id: string; full_name: string } | undefined;
              
              if (!customerExists) {
                console.warn(`   ⚠️ PULANDO débito ${item.id}: Cliente ${customerId} não existe localmente`);
                skippedNoCustomer++;
                continue;
              }
              
              this.dbManager.prepare(`
                INSERT INTO debts (id, debt_number, customer_id, branch_id, original_amount, amount, paid_amount, balance, status, due_date, notes, created_by, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.debtNumber || item.debt_number || `DEBT-${Date.now()}`,
                customerId,
                item.branchId || item.branch_id || 'main-branch',
                item.originalAmount || amount,
                amount,
                paidAmount,
                balance,
                item.status || 'pending',
                item.dueDate || item.due_date || null,
                item.notes || null,
                item.createdBy || item.created_by || null
              );
              created++;
              console.log(`   ➕ Débito criado: ${item.id} | Cliente: ${customerExists.full_name} | Status: ${item.status} | Saldo: ${balance/100} FCFA`);
            }
            
            // Sincronizar pagamentos do débito se existirem
            if (item.payments && Array.isArray(item.payments)) {
              for (const payment of item.payments) {
                try {
                  const existingPayment = this.dbManager.prepare(`
                    SELECT id FROM debt_payments WHERE id = ?
                  `).get(payment.id);
                  
                  if (!existingPayment) {
                    // Validar método de pagamento - NUNCA usar fallback
                    const normalizedMethod = tryNormalizePaymentMethod(payment.method);
                    if (!normalizedMethod) {
                      console.error(`  ❌ Pagamento de dívida ${payment.id} com método inválido: ${payment.method}`);
                      continue;
                    }
                    
                    this.dbManager.prepare(`
                      INSERT INTO debt_payments (id, debt_id, amount, method, reference, notes, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                      payment.id,
                      item.id,
                      payment.amount,
                      normalizedMethod, // Método validado e normalizado
                      payment.referenceNumber || payment.reference || null,
                      payment.notes || null,
                      payment.createdAt || new Date().toISOString()
                    );
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
        
        // RESUMO DE SINCRONIZAÇÃO DE DÍVIDAS
        console.log(`📊 SYNC DEBTS RESUMO:`);
        console.log(`   ✅ Criados: ${created}`);
        console.log(`   📝 Atualizados: ${updated}`);
        console.log(`   ⚠️ Pulados (sem cliente local): ${skippedNoCustomer}`);
        console.log(`   ⏸️ Pulados (alterações locais): ${skippedPending}`);
        if (skippedNoCustomer > 0) {
          console.log(`   ❗ ATENÇÃO: ${skippedNoCustomer} dívidas não foram sincronizadas porque os clientes não existem localmente!`);
        }
      },
      
      purchases: (items) => {
        // Compras - sincronizar do servidor para o desktop
        console.log(`📦 SYNC PURCHASES: Processando ${items.length} compras...`);
        let created = 0, updated = 0, errors = 0;
        
        for (const item of items) {
          try {
            const existing = this.dbManager.getPurchaseById ? this.dbManager.getPurchaseById(item.id) : null;
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('purchases', item.id, existing, item)) {
              console.log(`⏸️ Compra ${item.id} tem alterações locais pendentes`);
              continue;
            }
            
            // Verificar se o fornecedor existe
            const supplierId = item.supplierId || item.supplier_id;
            if (supplierId) {
              const supplierExists = this.dbManager.getSupplierById(supplierId);
              if (!supplierExists) {
                console.log(`⚠️ Compra ${item.id}: fornecedor ${supplierId} não existe localmente, pulando...`);
                errors++;
                continue;
              }
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
                supplierId,
                item.status || 'pending',
                item.total || 0,
                item.notes || null,
                item.receivedAt || item.received_at || null,
                item.id
              );
              updated++;
              console.log(`📝 Compra atualizada: ${item.id} (status: ${item.status})`);
            } else {
              // Criar nova compra
              this.dbManager.prepare(`
                INSERT INTO purchases (id, purchase_number, branch_id, supplier_id, status, subtotal, tax_total, discount_total, total, notes, received_by, received_at, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.purchaseNumber || item.purchase_number || `PUR-${Date.now()}`,
                item.branchId || item.branch_id || 'main-branch',
                supplierId,
                item.status || 'pending',
                item.subtotal || 0,
                item.taxTotal || item.tax_total || 0,
                item.discountTotal || item.discount_total || 0,
                item.total || item.totalCost || 0,
                item.notes || null,
                item.receivedBy || item.received_by || null,
                item.receivedAt || item.received_at || null
              );
              created++;
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
            errors++;
            console.error(`❌ Erro ao mesclar purchase ${item.id}:`, e?.message);
          }
        }
        
        console.log(`📊 SYNC PURCHASES RESUMO: ✅ Criados: ${created} | 📝 Atualizados: ${updated} | ❌ Erros: ${errors}`);
      },
      
      tables: (items) => {
        // Mesas - sincronizar do servidor para o desktop
        for (const item of items) {
          try {
            const existing = this.dbManager.getTableById ? this.dbManager.getTableById(item.id) : null;
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('tables', item.id, existing, item)) {
              continue;
            }
            
            if (existing) {
              // Atualizar mesa existente
              this.dbManager.prepare(`
                UPDATE tables SET
                  number = ?,
                  name = ?,
                  seats = ?,
                  area = ?,
                  status = ?,
                  is_active = ?,
                  synced = 1,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(
                item.number,
                item.name || `Mesa ${item.number}`,
                item.seats || 4,
                item.area || null,
                item.status || 'available',
                item.isActive !== false ? 1 : 0,
                item.id
              );
              console.log(`📝 Mesa atualizada: ${item.number}`);
            } else {
              // Criar nova mesa
              this.dbManager.prepare(`
                INSERT INTO tables (id, number, name, seats, area, status, branch_id, is_active, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.number,
                item.name || `Mesa ${item.number}`,
                item.seats || 4,
                item.area || null,
                item.status || 'available',
                item.branchId || item.branch_id || 'main-branch',
                item.isActive !== false ? 1 : 0
              );
              console.log(`➕ Mesa criada: ${item.number}`);
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar table ${item.id}:`, e?.message);
          }
        }
      },
      
      table_sessions: (items) => {
        // Sessões de mesa - sincronizar do servidor para o desktop
        for (const item of items) {
          try {
            const existing = this.dbManager.prepare(`SELECT id FROM table_sessions WHERE id = ?`).get(item.id);
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('table_sessions', item.id, existing, item)) {
              continue;
            }
            
            if (existing) {
              // Atualizar sessão existente
              this.dbManager.prepare(`
                UPDATE table_sessions SET
                  status = ?,
                  closed_by = ?,
                  closed_at = ?,
                  synced = 1,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(
                item.status || 'open',
                item.closedBy || item.closed_by || null,
                item.closedAt || item.closed_at || null,
                item.id
              );
              console.log(`📝 Sessão de mesa atualizada: ${item.id}`);
            } else {
              // Criar nova sessão
              this.dbManager.prepare(`
                INSERT INTO table_sessions (id, table_id, branch_id, status, opened_by, opened_at, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.tableId || item.table_id,
                item.branchId || item.branch_id || 'main-branch',
                item.status || 'open',
                item.openedBy || item.opened_by || 'system',
                item.openedAt || item.opened_at || new Date().toISOString()
              );
              console.log(`➕ Sessão de mesa criada: ${item.id}`);
            }
            
            // Sincronizar clientes da sessão
            if (item.customers && Array.isArray(item.customers)) {
              for (const customer of item.customers) {
                try {
                  const existingCustomer = this.dbManager.prepare(`SELECT id FROM table_customers WHERE id = ?`).get(customer.id);
                  
                  if (!existingCustomer) {
                    this.dbManager.prepare(`
                      INSERT INTO table_customers (id, session_id, customer_id, customer_name, status, added_by, synced, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
                    `).run(
                      customer.id,
                      item.id,
                      customer.customerId || customer.customer_id || null,
                      customer.customerName || customer.customer_name,
                      customer.status || 'active',
                      customer.addedBy || customer.added_by || 'system'
                    );
                    console.log(`   ➕ Cliente de mesa: ${customer.customerName || customer.customer_name}`);
                  }
                  
                  // Sincronizar pedidos do cliente
                  if (customer.orders && Array.isArray(customer.orders)) {
                    for (const order of customer.orders) {
                      try {
                        const existingOrder = this.dbManager.prepare(`SELECT id FROM table_orders WHERE id = ?`).get(order.id);
                        
                        if (!existingOrder) {
                          this.dbManager.prepare(`
                            INSERT INTO table_orders (id, session_id, table_customer_id, product_id, qty_units, unit_price, is_muntu, status, ordered_by, synced, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
                          `).run(
                            order.id,
                            item.id,
                            customer.id,
                            order.productId || order.product_id,
                            order.qtyUnits || order.qty_units || 1,
                            order.unitPrice || order.unit_price || 0,
                            order.isMuntu || order.is_muntu ? 1 : 0,
                            order.status || 'pending',
                            order.orderedBy || order.ordered_by || 'system'
                          );
                        }
                      } catch (orderError: any) {
                        console.error(`   ❌ Erro ao criar pedido de mesa:`, orderError?.message);
                      }
                    }
                  }
                } catch (customerError: any) {
                  console.error(`   ❌ Erro ao criar cliente de mesa:`, customerError?.message);
                }
              }
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar table_session ${item.id}:`, e?.message);
          }
        }
      },
      
      cash_boxes: (items) => {
        // Caixas - sincronizar histórico do servidor para o desktop
        console.log(`💰 SYNC CASH_BOXES: Processando ${items.length} caixas...`);
        let created = 0, updated = 0, errors = 0;
        
        for (const item of items) {
          try {
            const existing = this.dbManager.getCashBoxById ? this.dbManager.getCashBoxById(item.id) : null;
            
            // Não sobrescrever se há alterações locais pendentes
            if (this.hasLocalPendingChanges('cash_box', item.id, existing, item)) {
              console.log(`⏸️ Caixa ${item.id} tem alterações locais pendentes`);
              continue;
            }
            
            if (existing) {
              // Atualizar caixa existente (especialmente status de fechamento)
              // NOTA: A tabela NÃO tem coluna 'total_pix'
              this.dbManager.prepare(`
                UPDATE cash_boxes SET
                  status = ?,
                  closing_cash = ?,
                  total_sales = ?,
                  total_cash = ?,
                  total_card = ?,
                  total_mobile_money = ?,
                  total_debt = ?,
                  difference = ?,
                  closed_at = ?,
                  synced = 1,
                  updated_at = datetime('now')
                WHERE id = ?
              `).run(
                item.status || 'open',
                item.closingCash || item.closing_cash || null,
                item.totalSales || item.total_sales || item.stats?.totalSales || 0,
                item.totalCash || item.total_cash || item.stats?.cashPayments || 0,
                item.totalCard || item.total_card || item.stats?.cardPayments || 0,
                item.totalMobileMoney || item.total_mobile_money || item.totalPix || item.stats?.mobileMoneyPayments || 0,
                item.totalDebt || item.total_debt || item.stats?.debtPayments || 0,
                item.difference || 0,
                item.closedAt || item.closed_at || null,
                item.id
              );
              updated++;
              console.log(`📝 Caixa atualizado: ${item.id} (${item.status})`);
            } else {
              // Criar novo caixa do servidor
              // NOTA: A tabela NÃO tem coluna 'total_pix', usa 'total_mobile_money' para pagamentos móveis
              this.dbManager.prepare(`
                INSERT INTO cash_boxes (id, box_number, branch_id, opened_by, status, opening_cash, closing_cash, total_sales, total_cash, total_card, total_mobile_money, total_debt, difference, notes, opened_at, closed_at, synced, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
              `).run(
                item.id,
                item.boxNumber || item.box_number || `CX-${Date.now()}`,
                item.branchId || item.branch_id || 'main-branch',
                item.openedBy || item.opened_by || 'unknown', // NOT NULL - usar default se não existir
                item.status || 'closed',
                item.openingCash || item.opening_cash || 0,
                item.closingCash || item.closing_cash || null,
                item.totalSales || item.total_sales || item.stats?.totalSales || 0,
                item.totalCash || item.total_cash || item.stats?.cashPayments || 0,
                item.totalCard || item.total_card || item.stats?.cardPayments || 0,
                item.totalMobileMoney || item.total_mobile_money || item.totalPix || item.stats?.mobileMoneyPayments || 0,
                item.totalDebt || item.total_debt || item.stats?.debtPayments || 0,
                item.difference || 0,
                item.notes || null,
                item.openedAt || item.opened_at || new Date().toISOString(),
                item.closedAt || item.closed_at || null
              );
              created++;
              console.log(`➕ Caixa criado do servidor: ${item.id} (${item.status})`);
            }
          } catch (e: any) {
            errors++;
            console.error(`❌ Erro ao mesclar cash_box ${item.id}:`, e?.message);
          }
        }
        
        console.log(`📊 SYNC CASH_BOXES RESUMO: ✅ Criados: ${created} | 📝 Atualizados: ${updated} | ❌ Erros: ${errors}`);
      },
      
      settings: (items) => {
        // Configurações - sincronizar do servidor para o desktop
        // Configurações de admin têm prioridade sobre locais
        console.log(`⚙️ Processando ${items.length} configurações do servidor`);
        
        for (const item of items) {
          try {
            const key = item.key;
            const value = item.value;
            
            if (!key) {
              continue;
            }
            
            // Configurações especiais que NÃO devem ser sobrescritas (específicas do dispositivo)
            const deviceSpecificKeys = ['device_id', 'last_sync_date', 'offline_mode'];
            if (deviceSpecificKeys.includes(key)) {
              console.log(`⚠️ Pulando configuração específica do dispositivo: ${key}`);
              continue;
            }
            
            // Verificar se existe localmente
            const existing = this.dbManager.getSetting(key);
            
            if (existing !== value) {
              this.dbManager.setSetting(key, value);
              console.log(`⚙️ Configuração atualizada: ${key} = ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar setting ${item.key}:`, e?.message);
          }
        }
      },
      
      sales: (items) => {
        // Vendas - sincronizar do servidor para o desktop (bidirecional)
        for (const item of items) {
          try {
            // Verificar se a venda já existe localmente
            const existing = this.dbManager.getSaleById ? this.dbManager.getSaleById(item.id) : null;
            
            // Para vendas, NÃO pular se existir - precisamos verificar pagamentos
            // Mesmo que a venda local tenha synced=0, podemos precisar adicionar pagamentos do servidor
            
            if (!existing) {
              // Determinar o método de pagamento do servidor
              // Prioridade: 1) payments[0].method, 2) paymentMethod da venda
              const serverPaymentMethod = item.payments && Array.isArray(item.payments) && item.payments.length > 0
                ? item.payments[0].method
                : (item.paymentMethod || item.payment_method || null);
              
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
                paymentMethod: serverPaymentMethod, // IMPORTANTE: Salvar método de pagamento
                notes: item.notes || null,
                synced: 1,
                created_at: item.createdAt || item.created_at || new Date().toISOString(),
                updated_at: item.updatedAt || item.updated_at || new Date().toISOString(),
              };
              
              console.log(`📝 Criando venda ${item.id} com paymentMethod: ${serverPaymentMethod}`);
              
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
              if (item.payments && Array.isArray(item.payments) && item.payments.length > 0) {
                for (const payment of item.payments) {
                  try {
                    const existingPayment = this.dbManager.prepare(`
                      SELECT id FROM payments WHERE id = ?
                    `).get(payment.id);
                    
                    if (!existingPayment) {
                      // Validar método de pagamento - NUNCA usar fallback
                      const normalizedMethod = tryNormalizePaymentMethod(payment.method);
                      if (!normalizedMethod) {
                        console.error(`  ❌ Método de pagamento inválido: ${payment.method} - Venda ${item.id} marcada como inconsistente`);
                        // Marcar a venda como inconsistente em vez de assumir 'cash'
                        continue;
                      }
                      
                      this.dbManager.prepare(`
                        INSERT INTO payments (id, sale_id, method, amount, provider, reference_number, transaction_id, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                      `).run(
                        payment.id,
                        item.id,
                        normalizedMethod, // Método validado e normalizado
                        payment.amount || item.total,
                        payment.provider || null,
                        payment.referenceNumber || payment.reference_number || null,
                        payment.transactionId || payment.transaction_id || null,
                        payment.createdAt || new Date().toISOString()
                      );
                      console.log(`  💰 Pagamento sincronizado: ${normalizedMethod} - ${payment.amount}`);
                    }
                  } catch (paymentError: any) {
                    console.error(`  ❌ Erro ao sincronizar pagamento ${payment.id}:`, paymentError?.message);
                  }
                }
              } else {
                // Se não tem array de payments, verificar paymentMethod direto do item
                const rawPaymentMethod = item.paymentMethod || item.payment_method;
                
                // Validar método de pagamento - NUNCA usar fallback
                const normalizedMethod = tryNormalizePaymentMethod(rawPaymentMethod);
                if (!normalizedMethod) {
                  console.error(`  ❌ Venda ${item.id} sem método de pagamento válido: ${rawPaymentMethod}`);
                  // NÃO criar pagamento com método inválido
                } else {
                  const paymentId = `PAY-${item.id}-${Date.now()}`;
                  
                  try {
                    this.dbManager.prepare(`
                      INSERT INTO payments (id, sale_id, method, amount, created_at)
                      VALUES (?, ?, ?, ?, ?)
                    `).run(
                      paymentId,
                      item.id,
                      normalizedMethod, // Método validado e normalizado
                      item.total || 0,
                      item.createdAt || new Date().toISOString()
                    );
                    console.log(`  💰 Pagamento criado: ${normalizedMethod} - ${item.total}`);
                  } catch (paymentError: any) {
                    console.error(`  ❌ Erro ao criar pagamento:`, paymentError?.message);
                  }
                }
              }
              
              // ⚠️ NÃO decrementar estoque aqui!
              // O estoque já foi decrementado no dispositivo que criou a venda (Mobile ou outro Desktop)
              // E o servidor sincroniza o inventário separadamente.
              // Decrementar aqui causaria DUPLICAÇÃO: estoque cairia 2x para cada venda.
              
              // ANTIGO CÓDIGO PROBLEMÁTICO (REMOVIDO):
              // if (item.items && Array.isArray(item.items)) {
              //   for (const saleItem of item.items) {
              //     // decrementava estoque para vendas recebidas do servidor - ERRADO!
              //   }
              // }
            } else {
              // Venda já existe - verificar se precisa atualizar
              const existingAny = existing as any;
              
              // DEBUG: Log do que o servidor enviou
              console.log(`🔍 DEBUG Venda ${item.id}: payments=${JSON.stringify(item.payments)}, paymentMethod=${item.paymentMethod || item.payment_method}`);
              
              // Atualizar status se necessário
              if (existingAny.status !== item.status) {
                this.dbManager.prepare(`
                  UPDATE sales SET status = ?, synced = 1, updated_at = datetime('now')
                  WHERE id = ?
                `).run(item.status, item.id);
                console.log(`📝 Venda atualizada: ${item.id} (status: ${item.status})`);
              }
              
              // Verificar pagamentos locais e do servidor
              const localPayments = this.dbManager.prepare(`
                SELECT id, method FROM payments WHERE sale_id = ?
              `).all(item.id) as any[];
              
              console.log(`📊 DEBUG Local payments (${localPayments.length}): ${JSON.stringify(localPayments)}`);
              
              // Determinar método de pagamento do servidor
              const serverPaymentMethod = item.payments && Array.isArray(item.payments) && item.payments.length > 0
                ? item.payments[0].method
                : (item.paymentMethod || item.payment_method || null);
              
              if (localPayments.length === 0) {
                // Não tem pagamento local - criar
                if (item.payments && Array.isArray(item.payments) && item.payments.length > 0) {
                  // Sincronizar pagamentos do servidor
                  for (const payment of item.payments) {
                    try {
                      // Validar método de pagamento - NUNCA usar fallback
                      const normalizedMethod = tryNormalizePaymentMethod(payment.method);
                      if (!normalizedMethod) {
                        console.error(`  ❌ Pagamento ${payment.id} com método inválido: ${payment.method}`);
                        continue;
                      }
                      
                      this.dbManager.prepare(`
                        INSERT INTO payments (id, sale_id, method, amount, provider, reference_number, transaction_id, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                      `).run(
                        payment.id,
                        item.id,
                        normalizedMethod, // Método validado e normalizado
                        payment.amount || item.total,
                        payment.provider || null,
                        payment.referenceNumber || payment.reference_number || null,
                        payment.transactionId || payment.transaction_id || null,
                        payment.createdAt || new Date().toISOString()
                      );
                      console.log(`  💰 Pagamento adicionado: ${normalizedMethod} - ${payment.amount}`);
                    } catch (paymentError: any) {
                      console.error(`  ❌ Erro ao adicionar pagamento:`, paymentError?.message);
                    }
                  }
                } else if (serverPaymentMethod) {
                  // Sem pagamento no servidor mas tem paymentMethod - criar do paymentMethod
                  const paymentId = `PAY-${item.id}-${Date.now()}`;
                  
                  try {
                    this.dbManager.prepare(`
                      INSERT INTO payments (id, sale_id, method, amount, created_at)
                      VALUES (?, ?, ?, ?, ?)
                    `).run(
                      paymentId,
                      item.id,
                      serverPaymentMethod,
                      item.total || 0,
                      item.createdAt || new Date().toISOString()
                    );
                    console.log(`  💰 Pagamento criado para venda existente: ${serverPaymentMethod} - ${item.total}`);
                  } catch (paymentError: any) {
                    console.error(`  ❌ Erro ao criar pagamento:`, paymentError?.message);
                  }
                }
              } else if (serverPaymentMethod && localPayments.length > 0) {
                // Tem pagamento local E servidor tem método diferente
                // Verificar se o método local está incorreto (cash quando deveria ser outro)
                const localMethod = localPayments[0].method;
                
                console.log(`  📊 Comparando métodos: local="${localMethod}" vs server="${serverPaymentMethod}"`);
                
                // Se o servidor diz que é 'debt' ou 'vale' mas local diz 'cash', confiar no servidor
                if (localMethod !== serverPaymentMethod) {
                  console.log(`  🔄 Corrigindo método de pagamento: ${localMethod} → ${serverPaymentMethod}`);
                  this.dbManager.prepare(`
                    UPDATE payments SET method = ? WHERE sale_id = ?
                  `).run(serverPaymentMethod, item.id);
                }
              }
              
              // Marcar como sincronizado
              this.dbManager.prepare(`
                UPDATE sales SET synced = 1 WHERE id = ?
              `).run(item.id);
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
          // Validar método de pagamento - NUNCA usar fallback
          const normalizedMethod = tryNormalizePaymentMethod(data.method);
          if (!normalizedMethod) {
            console.error(`❌ Pagamento com método inválido: ${data.method}`);
            return { success: false, reason: `Método de pagamento inválido: ${data.method}` };
          }
          
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
            method: normalizedMethod, // Método validado e normalizado
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
      
      case 'user':
        // Usuário - sincronizar criação
        // Garantir que entity_id existe
        const userId = entity_id || data.id;
        if (!userId) {
          console.error('❌ ID do usuário não disponível para sincronização');
          return { success: false, reason: 'ID do usuário não disponível' };
        }
        
        if (operation === 'create') {
          // Verificar se temos a senha original para enviar ao backend
          if (!data.password) {
            console.error('❌ Senha não disponível para sincronização de usuário');
            // Marcar erro no registro do usuário
            this.dbManager.markUserSyncError(userId, 'Senha não disponível para sincronização');
            return { 
              success: false, 
              reason: 'Senha não disponível para sincronização. Usuário criado apenas localmente.' 
            };
          }
          
          // Obter branchId default se não fornecido
          let branchId = data.branchId;
          if (!branchId) {
            // Tentar obter a primeira branch disponível
            branchId = this.dbManager.getDefaultBranchId();
            if (branchId) {
              console.log(`📍 Usando branchId default: ${branchId}`);
            }
          }
          
          // Formatar dados para o backend (CreateUserDto completo)
          const createUserPayload = {
            id: userId, // Usar ID do Electron para manter consistência
            username: data.username,
            email: data.email,
            fullName: data.fullName,
            password: data.password,
            role: data.role || 'cashier',
            branchId: branchId,
            phone: data.phone,
            allowedTabs: data.allowedTabs,
            isActive: data.isActive !== undefined ? data.isActive : true,
          };
          
          console.log('📤 Enviando usuário para backend:', { 
            id: createUserPayload.id,
            username: createUserPayload.username,
            email: data.email, 
            role: data.role, 
            branchId,
            allowedTabs: data.allowedTabs,
          });
          
          try {
            const response = await this.apiClient.post('/users', createUserPayload);
            const serverId = response.data?.id || userId;
            console.log('✅ Usuário sincronizado com backend:', data.email);
            // Marcar como sincronizado com sucesso
            this.dbManager.markUserSynced(userId, serverId);
            return { success: true };
          } catch (error: any) {
            // Se usuário já existe, considerar sucesso e vincular
            if (error?.response?.status === 409) {
              console.log('⚠️ Usuário já existe no backend:', data.email);
              // Marcar como sincronizado (já existe no servidor)
              this.dbManager.markUserSynced(userId, userId);
              return { success: true };
            }
            // Marcar erro
            const errorMsg = error?.response?.data?.message || error.message || 'Erro desconhecido';
            this.dbManager.markUserSyncError(userId, errorMsg);
            throw error;
          }
        } else if (operation === 'update') {
          // Para update, usar PUT /users/:id com todos os campos
          const updatePayload: any = {};
          if (data.username) updatePayload.username = data.username;
          if (data.email) updatePayload.email = data.email;
          if (data.fullName) updatePayload.fullName = data.fullName;
          if (data.role) updatePayload.role = data.role;
          if (data.branchId) updatePayload.branchId = data.branchId;
          if (data.phone !== undefined) updatePayload.phone = data.phone;
          if (data.allowedTabs !== undefined) updatePayload.allowedTabs = data.allowedTabs;
          if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
          if (data.password) updatePayload.password = data.password;
          
          try {
            await this.apiClient.put(`/users/${userId}`, updatePayload);
            console.log('✅ Usuário atualizado no backend:', userId);
            this.dbManager.markUserSynced(userId);
            return { success: true };
          } catch (error: any) {
            const errorMsg = error?.response?.data?.message || error.message || 'Erro desconhecido';
            this.dbManager.markUserSyncError(userId, errorMsg);
            throw error;
          }
        } else if (operation === 'delete') {
          // Desativar usuário
          try {
            await this.apiClient.put(`/users/${userId}`, { isActive: false });
            console.log('✅ Usuário desativado no backend:', userId);
            this.dbManager.markUserSynced(userId);
            return { success: true };
          } catch (error: any) {
            const errorMsg = error?.response?.data?.message || error.message || 'Erro desconhecido';
            this.dbManager.markUserSyncError(userId, errorMsg);
            throw error;
          }
        }
        return { skip: true, success: false, reason: 'Operação de usuário não suportada' };
        
      case 'user_password':
        // Reset de senha de usuário - enviar para o backend
        const pwUserId = entity_id || data.id;
        if (!pwUserId) {
          console.error('❌ ID do usuário não disponível para reset de senha');
          return { success: false, reason: 'ID do usuário não disponível' };
        }
        
        if (operation === 'update' && data.newPassword) {
          try {
            await this.apiClient.post(`/users/${pwUserId}/reset-password`, {
              newPassword: data.newPassword
            });
            console.log('✅ Senha do usuário resetada no backend:', pwUserId);
            this.dbManager.markUserSynced(pwUserId);
            return { success: true };
          } catch (error: any) {
            // Se endpoint não existir, tentar PUT /users/:id com password
            if (error?.response?.status === 404) {
              try {
                await this.apiClient.put(`/users/${pwUserId}`, { 
                  password: data.newPassword 
                });
                console.log('✅ Senha do usuário atualizada no backend via PUT:', pwUserId);
                this.dbManager.markUserSynced(pwUserId);
                return { success: true };
              } catch (putError: any) {
                const errorMsg = putError?.response?.data?.message || putError.message || 'Erro desconhecido';
                this.dbManager.markUserSyncError(pwUserId, errorMsg);
                throw putError;
              }
            }
            const errorMsg = error?.response?.data?.message || error.message || 'Erro desconhecido';
            this.dbManager.markUserSyncError(pwUserId, errorMsg);
            throw error;
          }
        }
        console.warn('⚠️ Reset de senha sem newPassword, pulando sincronização');
        return { skip: true, success: false, reason: 'Senha não disponível para sincronização' };
        
      case 'debt_payment':
        // Pagamento de dívida - deve chamar POST /debts/:debtId/pay
        if (operation === 'create' && data.debtId) {
          // Validar método de pagamento - NUNCA usar fallback
          const normalizedMethod = tryNormalizePaymentMethod(data.method);
          if (!normalizedMethod) {
            console.error(`❌ Pagamento de dívida com método inválido: ${data.method}`);
            return { success: false, reason: `Método de pagamento inválido: ${data.method}` };
          }
          
          await this.apiClient.post(`/debts/${data.debtId}/pay`, {
            amount: data.amount,
            method: normalizedMethod, // Método validado e normalizado
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
      
      // ==================== MESAS E SESSÕES ====================
      
      case 'table':
        // Mesas - usar endpoint POST /tables (já mapeado no default)
        // Mas garantir que o branchId está correto
        if (operation === 'create') {
          await this.apiClient.post('/tables', {
            id: entity_id,
            branchId: data.branchId || data.branch_id,
            number: data.number,
            seats: data.seats || 4,
            area: data.area,
            isActive: data.isActive !== undefined ? data.isActive : true,
          });
          console.log('✅ Mesa sincronizada:', entity_id);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de mesa não suportada' };
      
      case 'table_session':
        // Sessões de mesa - usar endpoint /tables/sessions/open ou /tables/sessions/close
        if (operation === 'create') {
          // Verificar se a mesa já foi sincronizada
          try {
            await this.apiClient.get(`/tables/${data.tableId}`);
          } catch (checkError: any) {
            if (checkError.response?.status === 404) {
              console.log(`⏳ Mesa ${data.tableId} ainda não existe no servidor, adiando sessão...`);
              throw new Error(`Mesa ${data.tableId} não encontrada - aguardando sync`);
            }
            throw checkError;
          }
          
          await this.apiClient.post('/tables/sessions/open', {
            tableId: data.tableId,
            branchId: data.branchId || data.branch_id,
            openedBy: data.openedBy || data.opened_by || 'system',
          });
          console.log('✅ Sessão de mesa sincronizada:', entity_id);
          return { success: true };
        } else if (operation === 'update' && (data.status === 'closed' || data.closedBy)) {
          await this.apiClient.post('/tables/sessions/close', {
            sessionId: entity_id,
            closedBy: data.closedBy || data.closed_by || 'system',
          });
          console.log('✅ Sessão de mesa fechada no backend:', entity_id);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de sessão não suportada' };
      
      case 'table_customer':
        // Clientes de mesa - usar endpoint /tables/customers/add
        if (operation === 'create' && data.sessionId) {
          // Verificar se a sessão existe
          try {
            await this.apiClient.get(`/tables/sessions/${data.sessionId}`);
          } catch (checkError: any) {
            if (checkError.response?.status === 404) {
              console.log(`⏳ Sessão ${data.sessionId} ainda não existe no servidor, adiando cliente...`);
              throw new Error(`Sessão ${data.sessionId} não encontrada - aguardando sync`);
            }
            throw checkError;
          }
          
          await this.apiClient.post('/tables/customers/add', {
            sessionId: data.sessionId || data.session_id,
            customerName: data.customerName || data.customer_name,
            customerId: data.customerId || data.customer_id,
            addedBy: data.addedBy || data.added_by || 'system',
          });
          console.log('✅ Cliente de mesa sincronizado:', entity_id);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de cliente de mesa não suportada' };
      
      case 'table_order':
        // Pedidos de mesa - usar endpoint /tables/orders/add
        if (operation === 'create' && data.sessionId && data.tableCustomerId) {
          // Verificar se a sessão existe
          try {
            await this.apiClient.get(`/tables/sessions/${data.sessionId}`);
          } catch (checkError: any) {
            if (checkError.response?.status === 404) {
              console.log(`⏳ Sessão ${data.sessionId} ainda não existe no servidor, adiando pedido...`);
              throw new Error(`Sessão ${data.sessionId} não encontrada - aguardando sync`);
            }
            throw checkError;
          }
          
          await this.apiClient.post('/tables/orders/add', {
            sessionId: data.sessionId || data.session_id,
            tableCustomerId: data.tableCustomerId || data.table_customer_id,
            productId: data.productId || data.product_id,
            qtyUnits: data.qtyUnits || data.qty_units || 1,
            isMuntu: data.isMuntu || data.is_muntu || false,
            orderedBy: data.orderedBy || data.ordered_by || 'system',
          });
          console.log('✅ Pedido de mesa sincronizado:', entity_id);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de pedido de mesa não suportada' };
      
      case 'table_payment':
        // Pagamentos de mesa - usar endpoint /tables/payments/customer ou /tables/payments/session
        if (operation === 'create' && data.sessionId) {
          // Validar método de pagamento
          const normalizedMethod = tryNormalizePaymentMethod(data.method);
          if (!normalizedMethod) {
            console.error(`❌ Pagamento de mesa com método inválido: ${data.method}`);
            return { success: false, reason: `Método de pagamento inválido: ${data.method}` };
          }
          
          if (data.tableCustomerId) {
            // Pagamento de cliente específico
            await this.apiClient.post('/tables/payments/customer', {
              sessionId: data.sessionId || data.session_id,
              tableCustomerId: data.tableCustomerId || data.table_customer_id,
              method: normalizedMethod,
              amount: data.amount,
              processedBy: data.processedBy || data.processed_by || 'system',
            });
          } else {
            // Pagamento da sessão inteira
            await this.apiClient.post('/tables/payments/session', {
              sessionId: data.sessionId || data.session_id,
              method: normalizedMethod,
              amount: data.amount,
              processedBy: data.processedBy || data.processed_by || 'system',
            });
          }
          console.log('✅ Pagamento de mesa sincronizado:', entity_id);
          return { success: true };
        }
        return { skip: true, success: false, reason: 'Operação de pagamento de mesa não suportada' };
        
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
