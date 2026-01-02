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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_store_1 = __importDefault(require("electron-store"));
const axios_1 = __importDefault(require("axios"));
const manager_1 = require("./database/manager");
const manager_2 = require("./sync/manager");
// Logs críticos obrigatórios
console.log('🚀 ELECTRON MAIN STARTED');
process.on('uncaughtException', (err) => console.error('❌ UNCAUGHT EXCEPTION:', err));
process.on('unhandledRejection', (reason) => console.error('❌ UNHANDLED REJECTION:', reason));
const store = new electron_store_1.default();
let mainWindow = null;
let dbManager;
let syncManager;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        title: 'BarManager Pro - Guiné-Bissau',
    });
    // Em desenvolvimento, carrega o Vite dev server
    // Em produção (ou quando app.isPackaged), carrega o arquivo HTML compilado
    const isDev = process.env.NODE_ENV === 'development' && !electron_1.app.isPackaged;
    // Capturar erros de carregamento
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('❌ Falha ao carregar:', validatedURL);
        console.error('❌ Erro:', errorCode, errorDescription);
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('✅ Página carregada com sucesso');
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        mainWindow.loadFile(indexPath).catch(err => {
            console.error('❌ Erro ao carregar arquivo:', err);
        });
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    // Inicializar banco de dados local SQLite
    const dbPath = path.join(electron_1.app.getPath('userData'), 'barmanager.db');
    dbManager = new manager_1.DatabaseManager(dbPath);
    try {
        await dbManager.initialize();
        console.log('✅ Banco de dados SQLite inicializado');
    }
    catch (error) {
        console.error('⚠️ Erro ao inicializar banco SQLite (funcionará apenas online):', error);
        // Continuar sem banco local - app vai usar apenas API
    }
    // Inicializar sincronização
    // URL do Railway para produção, com fallback para local em desenvolvimento
    const defaultApiUrl = 'https://barmanagerbackend-production.up.railway.app/api/v1';
    const apiUrl = store.get('apiUrl', defaultApiUrl);
    console.log('🌐 API URL configurada:', apiUrl);
    if (dbManager) {
        syncManager = new manager_2.SyncManager(dbManager, apiUrl);
    }
    createWindow();
    // Passar referência da janela para o SyncManager (para emitir eventos)
    if (mainWindow && syncManager) {
        syncManager.setMainWindow(mainWindow);
        // Configurar listeners para repassar eventos de sync para o renderer
        // Nota: SyncManager já emite os eventos através de mainWindow.webContents.send()
        // então não precisamos adicionar listeners extras aqui
        console.log('✅ SyncManager configurado para emitir eventos para renderer');
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', async () => {
    if (syncManager) {
        try {
            await syncManager.stop();
        }
        catch (error) {
            console.error('Erro ao parar sincronização:', error);
        }
    }
    if (dbManager) {
        try {
            dbManager.close();
        }
        catch (error) {
            console.error('Erro ao fechar banco:', error);
        }
    }
});
// ============================================
// IPC Handlers
// ============================================
// Auth
electron_1.ipcMain.handle('auth:login', async (_, credentials) => {
    try {
        const result = await syncManager.login(credentials);
        // Após login bem-sucedido, iniciar sincronização automática
        if (result) {
            console.log('🔄 Iniciando sincronização automática após login...');
            // Iniciar em background para não bloquear resposta do login
            setTimeout(() => {
                syncManager.start().catch(err => {
                    console.error('Erro ao iniciar sincronização:', err);
                });
            }, 1000);
        }
        return { success: true, data: result };
    }
    catch (error) {
        console.error('Erro no login:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('auth:logout', async () => {
    await syncManager.logout();
    return { success: true };
});
// Sales
electron_1.ipcMain.handle('sales:create', async (_, saleData) => {
    const sale = dbManager.createSale(saleData);
    // 🔴 CORREÇÃO CRÍTICA: Sync imediato após criar venda
    // Garante que vendas rápidas em sequência não sejam perdidas
    syncManager.syncSalesImmediately();
    return sale;
});
electron_1.ipcMain.handle('sales:addItem', async (_, { saleId, itemData }) => {
    const item = dbManager.addSaleItem(saleId, itemData);
    // 🔴 CORREÇÃO: Sync imediato após adicionar item
    syncManager.syncSalesImmediately();
    return item;
});
electron_1.ipcMain.handle('sales:addPayment', async (_, { saleId, paymentData }) => {
    const payment = dbManager.addSalePayment(saleId, paymentData);
    // 🔴 CORREÇÃO: Sync imediato após adicionar pagamento
    syncManager.syncSalesImmediately();
    return payment;
});
electron_1.ipcMain.handle('sales:list', async (_, filters) => {
    return dbManager.getSales(filters);
});
electron_1.ipcMain.handle('sales:getById', async (_, saleId) => {
    return dbManager.getSaleById(saleId);
});
// Products
electron_1.ipcMain.handle('products:list', async (_, filters) => {
    return dbManager.getProducts(filters);
});
electron_1.ipcMain.handle('products:search', async (_, query) => {
    return dbManager.searchProducts(query);
});
electron_1.ipcMain.handle('products:create', async (_, productData) => {
    return dbManager.createProduct(productData);
});
electron_1.ipcMain.handle('products:update', async (_, { id, data }) => {
    return dbManager.updateProduct(id, data);
});
electron_1.ipcMain.handle('products:delete', async (_, id) => {
    return dbManager.deleteProduct(id);
});
electron_1.ipcMain.handle('products:getById', async (_, id) => {
    return dbManager.getProductById(id);
});
// Categories
electron_1.ipcMain.handle('categories:list', async (_, filters) => {
    return dbManager.getCategories(filters);
});
electron_1.ipcMain.handle('categories:create', async (_, categoryData) => {
    return dbManager.createCategory(categoryData);
});
electron_1.ipcMain.handle('categories:update', async (_, { id, data }) => {
    return dbManager.updateCategory(id, data);
});
electron_1.ipcMain.handle('categories:delete', async (_, id) => {
    return dbManager.deleteCategory(id);
});
// Suppliers
electron_1.ipcMain.handle('suppliers:list', async () => {
    return dbManager.getSuppliers();
});
electron_1.ipcMain.handle('suppliers:create', async (_, supplierData) => {
    return dbManager.createSupplier(supplierData);
});
electron_1.ipcMain.handle('suppliers:update', async (_, { id, data }) => {
    return dbManager.updateSupplier(id, data);
});
electron_1.ipcMain.handle('suppliers:delete', async (_, id) => {
    return dbManager.deleteSupplier(id);
});
// Purchases
electron_1.ipcMain.handle('purchases:list', async (_, filters) => {
    return dbManager.getPurchases(filters);
});
electron_1.ipcMain.handle('purchases:getById', async (_, id) => {
    return dbManager.getPurchaseById(id);
});
electron_1.ipcMain.handle('purchases:create', async (_, purchaseData) => {
    return dbManager.createPurchase(purchaseData);
});
electron_1.ipcMain.handle('purchases:addItem', async (_, { purchaseId, itemData }) => {
    return dbManager.addPurchaseItem(purchaseId, itemData);
});
electron_1.ipcMain.handle('purchases:complete', async (_, { purchaseId, receivedBy }) => {
    return dbManager.completePurchase(purchaseId, receivedBy);
});
// Customers
electron_1.ipcMain.handle('customers:list', async (_, filters) => {
    return dbManager.getCustomers(filters);
});
electron_1.ipcMain.handle('customers:create', async (_, customerData) => {
    return dbManager.createCustomer(customerData);
});
electron_1.ipcMain.handle('customers:update', async (_, { id, data }) => {
    return dbManager.updateCustomer(id, data);
});
electron_1.ipcMain.handle('customers:getById', async (_, id) => {
    return dbManager.getCustomerById(id);
});
electron_1.ipcMain.handle('customers:delete', async (_, id) => {
    return dbManager.deleteCustomer(id);
});
electron_1.ipcMain.handle('customers:getPurchaseHistory', async (_, { customerId, filters }) => {
    return dbManager.getCustomerPurchaseHistory(customerId, filters);
});
electron_1.ipcMain.handle('customers:getStats', async (_, customerId) => {
    return dbManager.getCustomerStats(customerId);
});
// Loyalty Points (Fidelidade)
electron_1.ipcMain.handle('loyalty:addPoints', async (_, { customerId, saleAmount, saleId }) => {
    return dbManager.addLoyaltyPoints(customerId, saleAmount, saleId);
});
electron_1.ipcMain.handle('loyalty:getCustomerLoyalty', async (_, customerId) => {
    return dbManager.getCustomerLoyalty(customerId);
});
electron_1.ipcMain.handle('loyalty:fixCustomerPoints', async (_, customerCode) => {
    return dbManager.fixCustomerLoyaltyPoints(customerCode);
});
// Rate limiter para evitar chamadas excessivas
const loyaltyCallCache = new Map();
const LOYALTY_RATE_LIMIT_MS = 1000; // Máximo 1 chamada por segundo por cliente
electron_1.ipcMain.handle('loyalty:setCustomerPoints', async (_, { customerCode, points }) => {
    const now = Date.now();
    const lastCall = loyaltyCallCache.get(customerCode) || 0;
    if (now - lastCall < LOYALTY_RATE_LIMIT_MS) {
        // Ignorar chamadas muito frequentes
        return { success: true, skipped: true, reason: 'rate_limited' };
    }
    loyaltyCallCache.set(customerCode, now);
    return dbManager.setCustomerLoyaltyPoints(customerCode, points);
});
// Users (Usuários)
electron_1.ipcMain.handle('users:list', async (_, filters) => {
    return dbManager.getUsers(filters);
});
electron_1.ipcMain.handle('users:create', async (_, userData) => {
    return dbManager.createUser(userData);
});
electron_1.ipcMain.handle('users:update', async (_, { id, data }) => {
    return dbManager.updateUser(id, data);
});
electron_1.ipcMain.handle('users:getById', async (_, id) => {
    return dbManager.getUserById(id);
});
electron_1.ipcMain.handle('users:getByUsername', async (_, username) => {
    return dbManager.getUserByUsername(username);
});
electron_1.ipcMain.handle('users:getByEmail', async (_, email) => {
    return dbManager.getUserByEmail(email);
});
electron_1.ipcMain.handle('users:resetPassword', async (_, { id, newPasswordHash, originalPassword }) => {
    return dbManager.resetUserPassword(id, newPasswordHash, originalPassword);
});
electron_1.ipcMain.handle('users:delete', async (_, id) => {
    return dbManager.deleteUser(id);
});
electron_1.ipcMain.handle('users:hashPassword', async (_, password) => {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
});
// User Sync Management (Gerenciamento de Sincronização de Usuários)
electron_1.ipcMain.handle('users:getSyncStats', async () => {
    return dbManager.getUserSyncStats();
});
electron_1.ipcMain.handle('users:getUnsyncedUsers', async () => {
    return dbManager.getUnsyncedUsers();
});
electron_1.ipcMain.handle('users:queueForSync', async (_, { userId, password }) => {
    return dbManager.queueUserForSync(userId, password);
});
electron_1.ipcMain.handle('users:queueAllPendingForSync', async () => {
    return dbManager.queueAllPendingUsersForSync();
});
electron_1.ipcMain.handle('users:syncNow', async (_, { userId, password }) => {
    // Adiciona à fila e força sync imediato
    const result = dbManager.queueUserForSync(userId, password);
    if (syncManager) {
        await syncManager.syncNow();
    }
    return result;
});
// Debts (Dívidas/Vales)
electron_1.ipcMain.handle('debts:create', async (_, data) => {
    return dbManager.createDebt(data);
});
electron_1.ipcMain.handle('debts:list', async (_, filters) => {
    // CORREÇÃO: Antes de listar dívidas, sincronizar com o servidor
    // Isso garante que vendas VALE do Mobile apareçam imediatamente
    try {
        if (syncManager) {
            await syncManager.syncDebtsFromServer();
        }
    }
    catch (syncError) {
        console.warn('⚠️ Não foi possível sincronizar dívidas do servidor:', syncError.message);
        // Continua mesmo com erro de sync - retorna dados locais
    }
    return dbManager.getDebts(filters);
});
electron_1.ipcMain.handle('debts:getById', async (_, id) => {
    return dbManager.getDebtById(id);
});
electron_1.ipcMain.handle('debts:pay', async (_, data) => {
    return dbManager.payDebt(data);
});
electron_1.ipcMain.handle('debts:cancel', async (_, { debtId, reason }) => {
    return dbManager.cancelDebt(debtId, reason);
});
electron_1.ipcMain.handle('debts:getCustomerStats', async (_, customerId) => {
    return dbManager.getCustomerDebtStats(customerId);
});
electron_1.ipcMain.handle('debts:getTablePendingDebts', async (_, tableNumber) => {
    const debtMap = dbManager.getTablePendingDebts(tableNumber);
    // Converter Map para objeto simples para IPC
    return Object.fromEntries(debtMap);
});
electron_1.ipcMain.handle('debts:getCustomersPendingDebts', async (_, customerIds) => {
    return dbManager.getCustomersPendingDebts(customerIds);
});
// Inventory
electron_1.ipcMain.handle('inventory:list', async (_, filters) => {
    return dbManager.getInventory(filters);
});
electron_1.ipcMain.handle('inventory:update', async (_, { productId, branchId, quantity, reason }) => {
    return dbManager.updateInventory(productId, branchId, quantity, reason);
});
// Inventory Advanced
electron_1.ipcMain.handle('inventory:registerLoss', async (_, { productId, branchId, quantity, reason, responsible, notes }) => {
    return dbManager.registerLoss(productId, branchId, quantity, reason, responsible, notes);
});
electron_1.ipcMain.handle('inventory:registerBreakage', async (_, { productId, branchId, quantity, reason, responsible, notes }) => {
    return dbManager.registerBreakage(productId, branchId, quantity, reason, responsible, notes);
});
electron_1.ipcMain.handle('inventory:manualAdjustment', async (_, { productId, branchId, quantity, reason, responsible, notes }) => {
    return dbManager.manualAdjustment(productId, branchId, quantity, reason, responsible, notes);
});
electron_1.ipcMain.handle('inventory:calculateConsumption', async (_, { productId, branchId }) => {
    return dbManager.calculateConsumptionAndForecast(productId, branchId);
});
electron_1.ipcMain.handle('inventory:getMovements', async (_, filters) => {
    return dbManager.getStockMovements(filters);
});
electron_1.ipcMain.handle('inventory:validateConsistency', async (_, { productId, branchId }) => {
    return dbManager.validateInventoryConsistency(productId, branchId);
});
// Cash Box
electron_1.ipcMain.handle('cashbox:open', async (_, data) => {
    return dbManager.openCashBox(data);
});
electron_1.ipcMain.handle('cashbox:close', async (_, { cashBoxId, closingData }) => {
    return dbManager.closeCashBox(cashBoxId, closingData);
});
electron_1.ipcMain.handle('cashbox:getCurrent', async () => {
    return dbManager.getCurrentCashBox();
});
electron_1.ipcMain.handle('cashbox:getHistory', async (_, filters) => {
    return dbManager.getCashBoxHistory(filters);
});
// Tables Management (Gestão de Mesas)
electron_1.ipcMain.handle('tables:create', async (_, data) => {
    return dbManager.createTable(data);
});
electron_1.ipcMain.handle('tables:update', async (_, { id, data }) => {
    return dbManager.updateTable(id, data);
});
electron_1.ipcMain.handle('tables:list', async (_, filters) => {
    return dbManager.getTables(filters);
});
electron_1.ipcMain.handle('tables:getById', async (_, id) => {
    return dbManager.getTableById(id);
});
electron_1.ipcMain.handle('tables:getOverview', async (_, branchId) => {
    return dbManager.getTablesOverview(branchId);
});
// Table Sessions
electron_1.ipcMain.handle('tableSessions:open', async (_, data) => {
    return dbManager.openTableSession(data);
});
electron_1.ipcMain.handle('tableSessions:close', async (_, data) => {
    return dbManager.closeTableSession(data);
});
electron_1.ipcMain.handle('tableSessions:getById', async (_, id) => {
    return dbManager.getTableSessionById(id);
});
electron_1.ipcMain.handle('tableSessions:list', async (_, filters) => {
    return dbManager.getTableSessions(filters);
});
electron_1.ipcMain.handle('tableSessions:transfer', async (_, data) => {
    return dbManager.transferTableSession(data);
});
electron_1.ipcMain.handle('tableSessions:transferCustomers', async (_, data) => {
    return dbManager.transferTableCustomers(data);
});
electron_1.ipcMain.handle('tableSessions:merge', async (_, data) => {
    return dbManager.mergeTableSessions(data);
});
electron_1.ipcMain.handle('tableSessions:split', async (_, data) => {
    return dbManager.splitMergedTable(data);
});
electron_1.ipcMain.handle('tableSessions:getActions', async (_, sessionId) => {
    return dbManager.getTableSessionActions(sessionId);
});
// Table Customers
electron_1.ipcMain.handle('tableCustomers:add', async (_, data) => {
    return dbManager.addCustomerToTable(data);
});
// Table Orders
electron_1.ipcMain.handle('tableOrders:add', async (_, data) => {
    console.log('[IPC main.ts] tableOrders:add recebido:', data);
    const result = dbManager.addTableOrder(data);
    console.log('[IPC main.ts] tableOrders:add retornando:', result);
    return result;
});
electron_1.ipcMain.handle('tableOrders:cancel', async (_, data) => {
    return dbManager.cancelTableOrder(data);
});
electron_1.ipcMain.handle('tableOrders:transfer', async (_, data) => {
    return dbManager.transferTableOrder(data);
});
electron_1.ipcMain.handle('tableOrders:split', async (_, data) => {
    return dbManager.splitTableOrder(data);
});
// Table Payments
electron_1.ipcMain.handle('tablePayments:processCustomer', async (_, data) => {
    return dbManager.processTableCustomerPayment(data);
});
electron_1.ipcMain.handle('tablePayments:processSession', async (_, data) => {
    return dbManager.processTableSessionPayment(data);
});
electron_1.ipcMain.handle('tablePayments:clearPaidOrders', async (_, data) => {
    return dbManager.clearPaidOrders(data);
});
electron_1.ipcMain.handle('cashbox:getById', async (_, id) => {
    return dbManager.getCashBoxById(id);
});
electron_1.ipcMain.handle('cashbox:updateTotals', async (_, { cashBoxId, saleTotal, paymentMethod }) => {
    return dbManager.updateCashBoxTotals(cashBoxId, saleTotal, paymentMethod);
});
// Database Migrations
electron_1.ipcMain.handle('database:fixUnitCost', async () => {
    return dbManager.fixUnitCostInSaleItems();
});
// Sync
electron_1.ipcMain.handle('sync:start', async () => {
    await syncManager.start();
    return { success: true };
});
electron_1.ipcMain.handle('sync:stop', async () => {
    await syncManager.stop();
    return { success: true };
});
electron_1.ipcMain.handle('sync:status', async () => {
    return syncManager.getStatus();
});
electron_1.ipcMain.handle('sync:checkConnection', async () => {
    return await syncManager.checkConnection();
});
electron_1.ipcMain.handle('sync:tryReauthenticate', async () => {
    return await syncManager.tryReauthenticate();
});
electron_1.ipcMain.handle('sync:forcePush', async () => {
    await syncManager.forcePush();
    return { success: true };
});
// Re-sincronizar mesas não sincronizadas e re-tentar vendas falhadas
electron_1.ipcMain.handle('sync:resyncTablesAndRetryFailedSales', async () => {
    // 1. Adicionar mesas não sincronizadas à fila
    const tablesResynced = dbManager.resyncUnsyncedTables();
    // 2. Re-tentar vendas de mesa que falharam
    const failedSales = dbManager.retryFailedTableSales();
    // 3. Forçar push
    await syncManager.forcePush();
    return {
        success: true,
        tablesResynced,
        salesRetried: failedSales
    };
});
// Push inicial completo - envia TODOS os dados existentes para o servidor
electron_1.ipcMain.handle('sync:pushFullInitialSync', async () => {
    return await syncManager.pushFullInitialSync();
});
// Pull completo do servidor - baixa TODOS os dados do Railway
electron_1.ipcMain.handle('sync:fullPullFromServer', async () => {
    return await syncManager.fullPullFromServer();
});
// Adiciona TODAS as entidades locais à fila de sincronização (para Railway vazio)
electron_1.ipcMain.handle('sync:queueFullResync', async () => {
    const result = dbManager.queueFullResync();
    // Iniciar sincronização imediata após enfileirar
    syncManager.syncNow();
    return result;
});
// Obter estatísticas da fila de sincronização
electron_1.ipcMain.handle('sync:getQueueStats', async () => {
    return dbManager.getSyncQueueStats();
});
// 🔍 Obter relatório de saúde da sincronização
electron_1.ipcMain.handle('sync:getHealthReport', async () => {
    return dbManager.getSyncHealthReport();
});
// 🔍 Obter validação de sincronização de produtos
electron_1.ipcMain.handle('sync:getProductValidation', async () => {
    return dbManager.getProductSyncValidation();
});
// Verifica se banco local está vazio
electron_1.ipcMain.handle('sync:isLocalDatabaseEmpty', async () => {
    return syncManager.isLocalDatabaseEmpty();
});
// Obter status detalhado da conexão
electron_1.ipcMain.handle('sync:getConnectionStatus', async () => {
    return syncManager.getStatus();
});
// Obter estatísticas detalhadas do sync (para monitoramento Railway Free)
electron_1.ipcMain.handle('sync:getStats', async () => {
    return syncManager.getSyncStats();
});
// Forçar sincronização imediata
electron_1.ipcMain.handle('sync:now', async () => {
    await syncManager.syncNow();
    return { success: true };
});
// Connection Monitor - iniciar monitoramento de conexão
electron_1.ipcMain.handle('sync:startConnectionMonitor', async () => {
    syncManager.startConnectionMonitor();
    return { success: true };
});
// Connection Monitor - parar monitoramento de conexão
electron_1.ipcMain.handle('sync:stopConnectionMonitor', async () => {
    syncManager.stopConnectionMonitor();
    return { success: true };
});
// Detailed sync status for admin UI
electron_1.ipcMain.handle('sync:getDetailedStatus', async () => {
    try {
        const status = await syncManager.getStatus();
        const lastSync = store.get('lastFullSync');
        // Get counts from database for each entity
        const entities = [
            { name: 'customers', label: 'Clientes' },
            { name: 'products', label: 'Produtos' },
            { name: 'categories', label: 'Categorias' },
            { name: 'suppliers', label: 'Fornecedores' },
            { name: 'tables', label: 'Mesas' },
            { name: 'sales', label: 'Vendas' },
            { name: 'purchases', label: 'Compras' },
            { name: 'cash_boxes', label: 'Caixas' },
            { name: 'inventory_movements', label: 'Mov. Estoque' },
            { name: 'settings', label: 'Configurações' },
        ];
        const entityStatus = entities.map((entity) => {
            try {
                const count = dbManager?.count(entity.name) || 0;
                const pendingCount = dbManager?.getPendingSyncCount(entity.name) || 0;
                return {
                    entity: entity.name,
                    label: entity.label,
                    localCount: count || 0,
                    pendingSync: pendingCount,
                    lastSynced: lastSync,
                    status: pendingCount > 0 ? 'pending' : 'synced',
                };
            }
            catch (err) {
                return {
                    entity: entity.name,
                    label: entity.label,
                    localCount: 0,
                    pendingSync: 0,
                    lastSynced: null,
                    status: 'error',
                };
            }
        });
        return {
            success: true,
            data: {
                isOnline: status.isOnline,
                isRunning: status.isRunning,
                lastFullSync: lastSync,
                pendingItems: status.pendingItems,
                entities: entityStatus,
            },
        };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Get device ID
electron_1.ipcMain.handle('sync:getDeviceId', async () => {
    try {
        const deviceId = dbManager?.getDeviceId() || 'unknown';
        return { success: true, deviceId };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// FASE 3: Sync Audit Log
electron_1.ipcMain.handle('sync:getAuditLog', async (_, options) => {
    try {
        const logs = dbManager?.getSyncAuditLog(options) || [];
        return { success: true, data: logs };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// FASE 3: Sync Conflicts
electron_1.ipcMain.handle('sync:getConflicts', async () => {
    try {
        const conflicts = dbManager?.getPendingConflicts() || [];
        return { success: true, data: conflicts };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:resolveConflict', async (_, conflictId, resolution) => {
    try {
        dbManager?.resolveConflict(conflictId, resolution);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// FASE 3: Device Registry
electron_1.ipcMain.handle('sync:getActiveDevices', async () => {
    try {
        const devices = dbManager?.getActiveDevices() || [];
        return { success: true, data: devices };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:getAllDevices', async () => {
    try {
        const devices = dbManager?.getAllDevices() || [];
        return { success: true, data: devices };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:updateHeartbeat', async () => {
    try {
        dbManager?.updateDeviceHeartbeat();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Dead Letter Queue Management
electron_1.ipcMain.handle('sync:getDeadLetterStats', async () => {
    try {
        const rawStats = dbManager?.getDeadLetterStats() || [];
        // Transformar array de resultados em formato esperado pelo dashboard
        const byEntityType = {};
        let total = 0;
        if (Array.isArray(rawStats)) {
            for (const stat of rawStats) {
                byEntityType[stat.entity] = stat.pending || 0;
                total += stat.pending || 0;
            }
        }
        return { total, byEntityType };
    }
    catch (error) {
        console.error('Erro ao buscar DLQ stats:', error);
        return { total: 0, byEntityType: {}, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:getDeadLetterItems', async (_, limit) => {
    try {
        const items = dbManager?.getDeadLetterItems(limit || 50) || [];
        // Transformar snake_case para camelCase para o dashboard
        return items.map(item => ({
            id: item.id,
            originalId: item.original_id,
            entityType: item.entity,
            entityId: item.entity_id,
            action: item.operation,
            error: item.last_error || 'Erro desconhecido',
            retryCount: item.retry_count || 0,
            movedAt: item.moved_at
        }));
    }
    catch (error) {
        console.error('Erro ao buscar DLQ items:', error);
        return [];
    }
});
electron_1.ipcMain.handle('sync:retryDeadLetterItem', async (_, id) => {
    try {
        const result = dbManager?.retryDeadLetterItem(id);
        return { success: true, result };
    }
    catch (error) {
        console.error('Erro ao reprocessar DLQ item:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:discardDeadLetterItem', async (_, { id, resolvedBy, reason }) => {
    try {
        const result = dbManager?.discardDeadLetterItem(id, resolvedBy || 'system', reason || 'Descartado manualmente');
        return { success: true, result };
    }
    catch (error) {
        console.error('Erro ao descartar DLQ item:', error);
        return { success: false, error: error.message };
    }
});
// Dashboard de Monitoramento - Fetch do Servidor
electron_1.ipcMain.handle('sync:getDashboardStats', async () => {
    try {
        if (!syncManager) {
            return { success: false, error: 'SyncManager não inicializado' };
        }
        const result = await syncManager.fetchFromServer('/sync/dashboard');
        return result;
    }
    catch (error) {
        console.error('Erro ao buscar dashboard stats:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:getDashboardAlerts', async () => {
    try {
        if (!syncManager) {
            return { success: false, error: 'SyncManager não inicializado' };
        }
        const result = await syncManager.fetchFromServer('/sync/dashboard/alerts');
        return result;
    }
    catch (error) {
        console.error('Erro ao buscar dashboard alerts:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sync:getDashboardHistory', async (_, limit) => {
    try {
        if (!syncManager) {
            return { success: false, error: 'SyncManager não inicializado' };
        }
        const result = await syncManager.fetchFromServer(`/sync/dashboard/history?limit=${limit || 20}`);
        return result;
    }
    catch (error) {
        console.error('Erro ao buscar dashboard history:', error);
        return { success: false, error: error.message };
    }
});
// Settings
electron_1.ipcMain.handle('settings:get', async (_, key) => {
    return store.get(key);
});
electron_1.ipcMain.handle('settings:set', async (_, { key, value }) => {
    store.set(key, value);
    return { success: true };
});
electron_1.ipcMain.handle('settings:getAll', async () => {
    return store.store;
});
// Backup
electron_1.ipcMain.handle('backup:create', async (_, options) => {
    const backupPath = options?.backupDir || path.join(electron_1.app.getPath('documents'), 'BarManager-Backups');
    const backupType = options?.backupType || 'manual';
    const createdBy = options?.createdBy || 'system';
    return await dbManager.createBackup(backupPath, backupType, createdBy);
});
electron_1.ipcMain.handle('backup:restore', async (_, filePath) => {
    return await dbManager.restoreBackup(filePath);
});
electron_1.ipcMain.handle('backup:history', async (_, limit) => {
    return dbManager.getBackupHistory(limit || 20);
});
electron_1.ipcMain.handle('backup:delete', async (_, { id, deleteFile }) => {
    return dbManager.deleteBackup(id, deleteFile !== false);
});
electron_1.ipcMain.handle('backup:selectFile', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar Arquivo de Backup',
        filters: [
            { name: 'Arquivos de Backup', extensions: ['db', 'bkp', 'sqlite'] }
        ],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    return { success: true, filePath: result.filePaths[0] };
});
electron_1.ipcMain.handle('backup:selectDirectory', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar Pasta para Backups',
        properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    return { success: true, directory: result.filePaths[0] };
});
// URL padrão do Railway
const DEFAULT_API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
// Reports - Usando API online do backend com fallback para dados locais
electron_1.ipcMain.handle('reports:sales', async (_, { startDate, endDate, branchId }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = store.get('token');
    try {
        const response = await axios_1.default.get(`${apiUrl}/reports/sales`, {
            params: { startDate, endDate, branchId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000,
        });
        return response.data;
    }
    catch (error) {
        console.warn('⚠️ Backend indisponível, usando dados locais do SQLite');
        console.log('📅 Período:', { startDate, endDate, branchId });
        // Fallback: usar dados locais
        try {
            // Verificar se dbManager está inicializado
            if (!dbManager) {
                throw new Error('DatabaseManager não está inicializado');
            }
            // Criar vendas de exemplo se necessário (apenas para testes)
            dbManager.seedSampleSales();
            // Converter strings de data para objetos Date
            const start = new Date(startDate);
            const end = new Date(endDate);
            console.log('📅 Datas convertidas:', { start: start.toISOString(), end: end.toISOString() });
            // Método síncrono, não precisa de await
            const localData = dbManager.getSalesReport(start, end, branchId);
            console.log('📊 Dados locais encontrados:', localData.length, 'registros');
            if (localData.length > 0) {
                console.log('📋 Primeira linha:', JSON.stringify(localData[0]));
            }
            // Transformar dados do SQLite para formato esperado
            const totalSales = localData.reduce((sum, row) => sum + (row.total_amount || 0), 0);
            const salesCount = localData.reduce((sum, row) => sum + (row.total_sales || 0), 0);
            const totalSavings = localData.reduce((sum, row) => sum + (row.total_savings || 0), 0);
            console.log('💰 Totalizadores:', { totalSales, salesCount, totalSavings });
            return {
                period: { startDate, endDate },
                summary: {
                    totalSales,
                    salesCount,
                    averageTicket: salesCount > 0 ? totalSales / salesCount : 0,
                    muntuSavings: totalSavings,
                },
                dailySales: localData.map((row) => ({
                    date: row.date,
                    sales: row.total_sales || 0,
                    total: row.total_amount || 0,
                    savings: row.total_savings || 0,
                })),
            };
        }
        catch (localError) {
            console.error('❌ Erro ao buscar dados locais:', localError);
            console.error('❌ Stack trace:', localError.stack);
            throw new Error(`Backend indisponível e não foi possível acessar dados locais: ${localError.message}`);
        }
    }
});
electron_1.ipcMain.handle('reports:purchases', async (_, { startDate, endDate, branchId }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = store.get('token');
    try {
        const response = await axios_1.default.get(`${apiUrl}/reports/purchases`, {
            params: { startDate, endDate, branchId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000,
        });
        return response.data;
    }
    catch (error) {
        console.warn('⚠️ Backend indisponível para relatório de compras');
        // Retornar estrutura vazia para compras (não implementado no dbManager)
        return {
            period: { startDate, endDate },
            summary: {
                totalPurchases: 0,
                purchasesCount: 0,
                averageTicket: 0,
            },
            suppliers: [],
            topProducts: [],
            dailyPurchases: [],
        };
    }
});
electron_1.ipcMain.handle('reports:inventory', async (_, { branchId }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = store.get('token');
    try {
        const response = await axios_1.default.get(`${apiUrl}/reports/inventory`, {
            params: { branchId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000,
        });
        return response.data;
    }
    catch (error) {
        console.warn('⚠️ Backend indisponível, usando dados locais do SQLite');
        // Fallback: usar dados locais
        try {
            // Verificar se dbManager está inicializado
            if (!dbManager) {
                throw new Error('DatabaseManager não está inicializado');
            }
            // Método síncrono, não precisa de await
            const localData = dbManager.getInventoryReport(branchId);
            console.log('📦 Itens de estoque encontrados:', localData.length);
            // Transformar dados do SQLite para formato esperado
            const totalItems = localData.length;
            const lowStockItems = localData.filter((row) => row.status === 'low').length;
            const totalValue = localData.reduce((sum, row) => {
                // Assumir custo padrão se não disponível
                const unitCost = 1000; // Placeholder
                return sum + (row.qty_units || 0) * unitCost;
            }, 0);
            console.log('📊 Resumo do estoque:', { totalItems, lowStockItems, totalValue });
            return {
                summary: {
                    totalItems,
                    totalValue,
                    lowStockItems,
                },
                items: localData.map((row) => ({
                    name: row.name || '',
                    sku: row.sku || '',
                    quantity: row.qty_units || 0,
                    lowStockAlert: row.low_stock_alert || 0,
                    status: row.status || 'ok',
                })),
            };
        }
        catch (localError) {
            console.error('❌ Erro ao buscar dados locais:', localError);
            console.error('❌ Stack trace:', localError.stack);
            throw new Error(`Backend indisponível e não foi possível acessar dados locais: ${localError.message}`);
        }
    }
});
electron_1.ipcMain.handle('reports:customers', async (_, { branchId }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = store.get('token');
    try {
        const response = await axios_1.default.get(`${apiUrl}/reports/customers`, {
            params: { branchId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000,
        });
        return response.data;
    }
    catch (error) {
        console.warn('⚠️ Backend indisponível para relatório de clientes');
        // Retornar estrutura vazia (não implementado no dbManager)
        return {
            summary: {
                totalCustomers: 0,
                customersWithDebt: 0,
                totalDebt: 0,
                averageDebt: 0,
            },
            topDebtors: [],
        };
    }
});
electron_1.ipcMain.handle('reports:debts', async (_, { branchId }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = store.get('token');
    try {
        const response = await axios_1.default.get(`${apiUrl}/reports/debts`, {
            params: { branchId },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 3000,
        });
        return response.data;
    }
    catch (error) {
        console.warn('⚠️ Backend indisponível para relatório de dívidas');
        // Retornar estrutura vazia (não implementado no dbManager)
        return {
            summary: {
                totalDebts: 0,
                pending: { count: 0, total: 0 },
                partial: { count: 0, total: 0 },
                paid: { count: 0 },
                overdue: { count: 0, total: 0 },
            },
            overdueList: [],
        };
    }
});
// Select directory for reports
electron_1.ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Selecione o diretório para salvar relatórios',
    });
    if (result.canceled) {
        return { success: false, path: null };
    }
    return { success: true, path: result.filePaths[0] };
});
// Save report file
electron_1.ipcMain.handle('reports:saveFile', async (_, { filePath, content, type }) => {
    try {
        if (type === 'json') {
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        }
        else if (type === 'pdf') {
            // Content vem em base64
            const buffer = Buffer.from(content, 'base64');
            fs.writeFileSync(filePath, buffer);
        }
        else {
            fs.writeFileSync(filePath, content);
        }
        return { success: true, filePath };
    }
    catch (error) {
        console.error('Erro ao salvar relatório:', error);
        return { success: false, error: error?.message || 'Erro desconhecido' };
    }
});
// Printer
electron_1.ipcMain.handle('printer:print', async (_, { type, data }) => {
    // TODO: Implementar impressão térmica
    console.log('Print:', type, data);
    return { success: true };
});
// ============================================
// ADMIN - Reset de Dados
// ============================================
// Obter contagem de dados para preview
electron_1.ipcMain.handle('admin:getLocalDataCounts', async () => {
    return dbManager.getDataCountsForReset();
});
// Zerar dados locais (Electron)
electron_1.ipcMain.handle('admin:resetLocalData', async (_, { adminUserId, confirmationCode }) => {
    // Verificar código de confirmação
    if (confirmationCode !== 'CONFIRMAR_RESET_LOCAL') {
        return { success: false, error: 'Código de confirmação inválido' };
    }
    console.log(`🔐 Reset local solicitado por: ${adminUserId}`);
    return dbManager.resetLocalData(adminUserId);
});
// Obter contagem de dados do servidor
electron_1.ipcMain.handle('admin:getServerDataCounts', async () => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    // Usar token do syncManager ao invés do store
    const token = syncManager?.getToken();
    if (!token || token === 'offline-token') {
        console.error('❌ Token não encontrado para obter contagem');
        return { error: 'Usuário não autenticado. Faça login novamente.' };
    }
    try {
        const response = await axios_1.default.get(`${apiUrl}/admin/data-counts`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
        });
        return response.data;
    }
    catch (error) {
        console.error('Erro ao obter contagem do servidor:', error?.message);
        if (error?.response?.status === 401) {
            return { error: 'Sessão expirada. Faça logout e login novamente.' };
        }
        if (error?.response?.status === 403) {
            return { error: 'Sem permissão. Apenas administradores podem ver estes dados.' };
        }
        return { error: error?.response?.data?.message || error?.message };
    }
});
// Zerar dados do servidor (Railway)
electron_1.ipcMain.handle('admin:resetServerData', async (_, { confirmationCode }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    // Usar token do syncManager ao invés do store
    const token = syncManager?.getToken();
    if (!token || token === 'offline-token') {
        console.error('❌ Token não encontrado para reset servidor');
        return { success: false, error: 'Usuário não autenticado. Faça login novamente.' };
    }
    console.log(`🗄️ Reset servidor solicitado`);
    console.log(`🔑 Token presente: Sim`);
    try {
        const response = await axios_1.default.post(`${apiUrl}/admin/reset-server-data`, { confirmationCode }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60000,
        });
        return response.data;
    }
    catch (error) {
        console.error('Erro ao resetar servidor:', error?.message);
        console.error('Status:', error?.response?.status);
        let errorMsg = 'Erro desconhecido';
        if (error?.response?.status === 401) {
            errorMsg = 'Sessão expirada. Faça logout e login novamente.';
        }
        else if (error?.response?.status === 403) {
            errorMsg = 'Sem permissão. Apenas administradores podem executar esta ação.';
        }
        else if (error?.response?.data?.message) {
            errorMsg = error.response.data.message;
        }
        else if (error?.message) {
            errorMsg = error.message;
        }
        return { success: false, error: errorMsg };
    }
});
// Zerar dados do mobile (envia comando via API)
electron_1.ipcMain.handle('admin:resetMobileData', async (_, { deviceId, confirmationCode }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    // Usar token do syncManager ao invés do store
    const token = syncManager?.getToken();
    // Verificar se tem token válido
    if (!token || token === 'offline-token') {
        console.error('❌ Token não encontrado para reset mobile');
        return {
            success: false,
            message: 'Usuário não autenticado. Faça login novamente.'
        };
    }
    console.log(`📱 Reset mobile solicitado - deviceId: ${deviceId}`);
    console.log(`🔑 Token válido presente`);
    try {
        const response = await axios_1.default.post(`${apiUrl}/admin/reset-mobile-data`, { deviceId, confirmationCode }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 30000,
        });
        return response.data;
    }
    catch (error) {
        console.error('Erro ao resetar mobile:', error?.message);
        console.error('Status:', error?.response?.status);
        console.error('Data:', error?.response?.data);
        // Mensagem mais específica baseada no erro
        let message = 'Erro desconhecido';
        if (error?.response?.status === 401) {
            message = 'Sessão expirada. Faça logout e login novamente.';
        }
        else if (error?.response?.status === 403) {
            message = 'Sem permissão. Apenas administradores podem executar esta ação.';
        }
        else if (error?.response?.data?.message) {
            message = error.response.data.message;
        }
        else if (error?.message) {
            message = error.message;
        }
        return { success: false, message };
    }
});
// ========== BACKUP DO SERVIDOR ==========
// Criar backup do servidor
electron_1.ipcMain.handle('backup:createServerBackup', async () => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = syncManager?.getToken();
    if (!token || token === 'offline-token') {
        return { success: false, error: 'Usuário não autenticado' };
    }
    console.log('📦 Criando backup do servidor...');
    try {
        const response = await axios_1.default.post(`${apiUrl}/backup/download`, {}, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 120000, // 2 minutos para backups grandes
        });
        return { success: true, data: response.data };
    }
    catch (error) {
        console.error('Erro ao criar backup:', error?.message);
        return {
            success: false,
            error: error?.response?.data?.message || error?.message
        };
    }
});
// Salvar backup em arquivo
electron_1.ipcMain.handle('backup:saveToFile', async (_, { backupData }) => {
    const { dialog } = require('electron');
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `backup-servidor-${timestamp}.json`;
        const result = await dialog.showSaveDialog({
            title: 'Salvar Backup do Servidor',
            defaultPath: defaultFilename,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true };
        }
        const fs = require('fs');
        fs.writeFileSync(result.filePath, JSON.stringify(backupData, null, 2));
        const stats = fs.statSync(result.filePath);
        console.log(`✅ Backup salvo: ${result.filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return {
            success: true,
            filePath: result.filePath,
            size: stats.size,
        };
    }
    catch (error) {
        console.error('Erro ao salvar backup:', error?.message);
        return { success: false, error: error?.message };
    }
});
// Carregar backup de arquivo
electron_1.ipcMain.handle('backup:loadFromFile', async () => {
    const { dialog } = require('electron');
    const fs = require('fs');
    try {
        const result = await dialog.showOpenDialog({
            title: 'Selecionar Arquivo de Backup',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        const backupData = JSON.parse(content);
        // Validar estrutura básica
        if (!backupData.metadata || !backupData.metadata.version) {
            return { success: false, error: 'Arquivo de backup inválido: falta metadata' };
        }
        console.log(`📂 Backup carregado: ${filePath}`);
        console.log(`   Versão: ${backupData.metadata.version}`);
        console.log(`   Data: ${backupData.metadata.timestamp}`);
        console.log(`   Registros: ${backupData.metadata.totalRecords}`);
        return {
            success: true,
            filePath,
            backupData,
            metadata: backupData.metadata,
        };
    }
    catch (error) {
        console.error('Erro ao carregar backup:', error?.message);
        return { success: false, error: error?.message };
    }
});
// Restaurar backup no servidor
electron_1.ipcMain.handle('backup:restoreServerBackup', async (_, { backupData, confirmationCode }) => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = syncManager?.getToken();
    if (!token || token === 'offline-token') {
        return { success: false, error: 'Usuário não autenticado' };
    }
    if (confirmationCode !== 'CONFIRMAR_RESTAURACAO') {
        return { success: false, error: 'Código de confirmação inválido' };
    }
    console.log('🔄 Restaurando backup no servidor...');
    try {
        const response = await axios_1.default.post(`${apiUrl}/backup/restore`, { backupData, confirmationCode }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 180000, // 3 minutos para restaurações grandes
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });
        console.log('✅ Restauração concluída:', response.data);
        return response.data;
    }
    catch (error) {
        console.error('Erro ao restaurar backup:', error?.message);
        return {
            success: false,
            error: error?.response?.data?.message || error?.message,
            details: error?.response?.data,
        };
    }
});
// Obter status do backup
electron_1.ipcMain.handle('backup:getStatus', async () => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = syncManager?.getToken();
    if (!token || token === 'offline-token') {
        return { success: false, error: 'Usuário não autenticado' };
    }
    try {
        const response = await axios_1.default.get(`${apiUrl}/backup/status`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
        });
        return { success: true, ...response.data };
    }
    catch (error) {
        return { success: false, error: error?.message };
    }
});
// Listar backups no servidor
electron_1.ipcMain.handle('backup:listServerBackups', async () => {
    const apiUrl = store.get('apiUrl', DEFAULT_API_URL);
    const token = syncManager?.getToken();
    if (!token || token === 'offline-token') {
        return { success: false, error: 'Usuário não autenticado' };
    }
    try {
        const response = await axios_1.default.get(`${apiUrl}/backup/list`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
        });
        return { success: true, backups: response.data };
    }
    catch (error) {
        return { success: false, error: error?.message };
    }
});
//# sourceMappingURL=main.js.map