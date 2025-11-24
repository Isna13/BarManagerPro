"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncManager = void 0;
const axios_1 = __importDefault(require("axios"));
class SyncManager {
    constructor(dbManager, apiUrl) {
        this.dbManager = dbManager;
        this.apiUrl = apiUrl;
        this.syncInterval = null;
        this.isRunning = false;
        this.token = null;
        this.apiClient = axios_1.default.create({
            baseURL: apiUrl,
            timeout: 30000,
        });
        // Interceptor para adicionar token
        this.apiClient.interceptors.request.use(config => {
            if (this.token) {
                config.headers.Authorization = `Bearer ${this.token}`;
            }
            return config;
        });
    }
    async login(credentials) {
        try {
            const response = await this.apiClient.post('/auth/login', credentials);
            this.token = response.data.accessToken;
            // Salvar token localmente
            // await this.dbManager.saveSetting('auth_token', this.token);
            return response.data;
        }
        catch (error) {
            throw new Error('Falha no login: ' + error.message);
        }
    }
    async logout() {
        try {
            await this.apiClient.post('/auth/logout');
        }
        catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
        finally {
            this.token = null;
            await this.stop();
        }
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('🔄 Sincronização iniciada');
        // Sincronização inicial
        await this.syncNow();
        // Sincronização periódica (a cada 30 segundos)
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
            console.warn('Token não disponível, sincronização ignorada');
            return;
        }
        try {
            // 1. Push local changes to server
            await this.pushLocalChanges();
            // 2. Pull server changes to local
            await this.pullServerChanges();
            console.log('✅ Sincronização concluída');
        }
        catch (error) {
            console.error('❌ Erro na sincronização:', error);
        }
    }
    async pushLocalChanges() {
        const pendingItems = this.dbManager.getPendingSyncItems();
        for (const item of pendingItems) {
            try {
                const data = JSON.parse(item.data);
                // Mapear operações para endpoints
                const endpoint = this.getEndpoint(item.entity, item.operation);
                if (item.operation === 'create') {
                    await this.apiClient.post(endpoint, data);
                }
                else if (item.operation === 'update') {
                    await this.apiClient.put(`${endpoint}/${item.entity_id || ''}`, data);
                }
                else if (item.operation === 'delete') {
                    await this.apiClient.delete(`${endpoint}/${item.entity_id || ''}`);
                }
                // Marcar como concluído
                this.dbManager.markSyncItemCompleted(item.id);
            }
            catch (error) {
                console.error(`Erro ao sincronizar ${item.entity}:`, error);
                this.dbManager.markSyncItemFailed(item.id, error?.message || 'Unknown error');
                // Se erro 401, parar sincronização
                if (error.response?.status === 401) {
                    await this.stop();
                    break;
                }
            }
        }
    }
    async pullServerChanges() {
        // TODO: Implementar pull de mudanças do servidor
        // 1. Buscar última data de sincronização
        // 2. Requisitar mudanças desde essa data
        // 3. Aplicar mudanças localmente (com resolução de conflitos)
    }
    getEndpoint(entity, operation) {
        const endpoints = {
            sale: '/sales',
            sale_item: '/sales/items',
            payment: '/payments',
            product: '/products',
            inventory: '/inventory',
            customer: '/customers',
            cash_box: '/cash-boxes',
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
            lastSync: new Date(),
        };
    }
}
exports.SyncManager = SyncManager;
//# sourceMappingURL=manager.js.map