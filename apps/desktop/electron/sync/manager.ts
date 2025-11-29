import axios, { AxiosInstance } from 'axios';
import { DatabaseManager } from '../database/manager';
import { BrowserWindow } from 'electron';

interface SyncItem {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  entity_id?: string;
  data: string;
}

export class SyncManager {
  private apiClient: AxiosInstance;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private token: string | null = null;
  private lastSync: Date | null = null;
  private mainWindow: BrowserWindow | null = null;
  private lastCredentials: { email: string; password: string } | null = null;

  constructor(
    private dbManager: DatabaseManager,
    private apiUrl: string
  ) {
    this.apiClient = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
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

  async login(credentials: { email: string; password: string }) {
    // Salvar credenciais para possível reautenticação
    this.lastCredentials = credentials;
    
    try {
      const response = await this.apiClient.post('/auth/login', credentials);
      this.token = response.data.accessToken;
      
      console.log('✅ Login online bem-sucedido, token válido obtido');
      
      // Salvar token localmente
      // await this.dbManager.saveSetting('auth_token', this.token);
      
      return response.data;
    } catch (error) {
      // Modo offline: validar credenciais localmente
      console.log('Backend indisponível, tentando login offline...');
      console.log('Credenciais:', credentials.email);
      
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
    console.log('🔄 Sincronização iniciada');
    console.log('📊 Status do token:', this.token === 'offline-token' ? '❌ OFFLINE-TOKEN (tentará reconectar)' : '✅ TOKEN VÁLIDO');
    console.log('⏰ Intervalo de sincronização: 30 segundos');
    this.emit('sync:started');
    
    // Sincronização inicial
    await this.syncNow();
    
    // Sincronização periódica (a cada 30 segundos)
    // Isso inclui verificação de reconexão quando em modo offline
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, 30000);
  }

  async stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
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
    
    for (const item of pendingItems) {
      try {
        const data = JSON.parse(item.data);
        
        // Mapear operações para endpoints
        const endpoint = this.getEndpoint(item.entity, item.operation);
        
        if (item.operation === 'create') {
          await this.apiClient.post(endpoint, data);
        } else if (item.operation === 'update') {
          await this.apiClient.put(`${endpoint}/${item.entity_id || ''}`, data);
        } else if (item.operation === 'delete') {
          await this.apiClient.delete(`${endpoint}/${item.entity_id || ''}`);
        }
        
        // Marcar como concluído
        this.dbManager.markSyncItemCompleted(item.id);
        
      } catch (error: any) {
        const errorMsg = error?.message || 'Unknown error';
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
   * Mescla dados recebidos do servidor com dados locais
   * Estratégia: servidor tem prioridade, mas não apaga dados locais não sincronizados
   */
  private async mergeEntityData(entityName: string, items: any[]) {
    const mergeStrategies: Record<string, (items: any[]) => void> = {
      branches: (items) => {
        for (const item of items) {
          try {
            const existing = this.dbManager.getBranchById(item.id);
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
            if (existing) {
              // Não sobrescrever senha local se usuário já existe
              this.dbManager.updateUserFromServer(item.id, {
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
            if (existing) {
              this.dbManager.updateCategory(item.id, {
                name: item.name,
                description: item.description,
                parent_id: item.parentId,
                sort_order: item.sortOrder || 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
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
              });
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
            if (existing) {
              this.dbManager.updateProduct(item.id, {
                name: item.name,
                sku: item.sku,
                barcode: item.barcode,
                description: item.description,
                category_id: item.categoryId,
                box_price: item.boxPrice,
                unit_price: item.unitPrice,
                unit_cost: item.unitCost,
                units_per_box: item.unitsPerBox,
                min_stock: item.minStock,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            } else {
              this.dbManager.createProduct({
                id: item.id,
                name: item.name,
                sku: item.sku,
                barcode: item.barcode,
                description: item.description,
                category_id: item.categoryId,
                box_price: item.boxPrice || 0,
                unit_price: item.unitPrice || 0,
                unit_cost: item.unitCost || 0,
                units_per_box: item.unitsPerBox || 1,
                min_stock: item.minStock || 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
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
            if (existing) {
              this.dbManager.updateCustomer(item.id, {
                name: item.name,
                email: item.email,
                phone: item.phone,
                code: item.code,
                address: item.address,
                credit_limit: item.creditLimit,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            } else {
              this.dbManager.createCustomer({
                id: item.id,
                name: item.name,
                email: item.email,
                phone: item.phone,
                code: item.code,
                address: item.address,
                credit_limit: item.creditLimit || 0,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
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
            if (existing) {
              this.dbManager.updateSupplier(item.id, {
                name: item.name,
                email: item.email,
                phone: item.phone,
                address: item.address,
                contact_person: item.contactPerson,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            } else {
              this.dbManager.createSupplier({
                id: item.id,
                name: item.name,
                email: item.email,
                phone: item.phone,
                address: item.address,
                contact_person: item.contactPerson,
                is_active: item.isActive !== false ? 1 : 0,
                synced: 1,
                last_sync: new Date().toISOString(),
              });
            }
          } catch (e: any) {
            console.error(`Erro ao mesclar supplier ${item.id}:`, e?.message);
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

  private getEndpoint(entity: string, operation: string): string {
    const endpoints: Record<string, string> = {
      product: '/products',
      customer: '/customers',
      sale: '/sales',
      user: '/users',
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
      isOnline: this.token !== null && this.token !== 'offline-token',
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
}
