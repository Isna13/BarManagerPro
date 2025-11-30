import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import axios from 'axios';
import { DatabaseManager } from './database/manager';
import { SyncManager } from './sync/manager';

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let dbManager: DatabaseManager;
let syncManager: SyncManager;

function createWindow() {
  mainWindow = new BrowserWindow({
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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Inicializar banco de dados local SQLite
  const dbPath = path.join(app.getPath('userData'), 'barmanager.db');
  dbManager = new DatabaseManager(dbPath);
  await dbManager.initialize();

  // Inicializar sincronização
  // URL do Railway para produção, com fallback para local em desenvolvimento
  const defaultApiUrl = 'https://barmanagerbackend-production.up.railway.app/api/v1';
  const apiUrl = store.get('apiUrl', defaultApiUrl) as string;
  console.log('🌐 API URL configurada:', apiUrl);
  syncManager = new SyncManager(dbManager, apiUrl);

  createWindow();
  
  // Passar referência da janela para o SyncManager (para emitir eventos)
  if (mainWindow) {
    syncManager.setMainWindow(mainWindow);
    
    // Configurar listeners para repassar eventos de sync para o renderer
    // Nota: SyncManager já emite os eventos através de mainWindow.webContents.send()
    // então não precisamos adicionar listeners extras aqui
    console.log('✅ SyncManager configurado para emitir eventos para renderer');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (syncManager) {
    try {
      await syncManager.stop();
    } catch (error) {
      console.error('Erro ao parar sincronização:', error);
    }
  }
  if (dbManager) {
    try {
      dbManager.close();
    } catch (error) {
      console.error('Erro ao fechar banco:', error);
    }
  }
});

// ============================================
// IPC Handlers
// ============================================

// Auth
ipcMain.handle('auth:login', async (_, credentials) => {
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
  } catch (error) {
    console.error('Erro no login:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('auth:logout', async () => {
  await syncManager.logout();
  return { success: true };
});

// Sales
ipcMain.handle('sales:create', async (_, saleData) => {
  return dbManager.createSale(saleData);
});

ipcMain.handle('sales:addItem', async (_, { saleId, itemData }) => {
  return dbManager.addSaleItem(saleId, itemData);
});

ipcMain.handle('sales:addPayment', async (_, { saleId, paymentData }) => {
  return dbManager.addSalePayment(saleId, paymentData);
});

ipcMain.handle('sales:list', async (_, filters) => {
  return dbManager.getSales(filters);
});

ipcMain.handle('sales:getById', async (_, saleId) => {
  return dbManager.getSaleById(saleId);
});

// Products
ipcMain.handle('products:list', async (_, filters) => {
  return dbManager.getProducts(filters);
});

ipcMain.handle('products:search', async (_, query) => {
  return dbManager.searchProducts(query);
});

ipcMain.handle('products:create', async (_, productData) => {
  return dbManager.createProduct(productData);
});

ipcMain.handle('products:update', async (_, { id, data }) => {
  return dbManager.updateProduct(id, data);
});

ipcMain.handle('products:getById', async (_, id) => {
  return dbManager.getProductById(id);
});

// Categories
ipcMain.handle('categories:list', async (_, filters) => {
  return dbManager.getCategories(filters);
});

ipcMain.handle('categories:create', async (_, categoryData) => {
  return dbManager.createCategory(categoryData);
});

ipcMain.handle('categories:update', async (_, { id, data }) => {
  return dbManager.updateCategory(id, data);
});

ipcMain.handle('categories:delete', async (_, id) => {
  return dbManager.deleteCategory(id);
});

// Suppliers
ipcMain.handle('suppliers:list', async () => {
  return dbManager.getSuppliers();
});

ipcMain.handle('suppliers:create', async (_, supplierData) => {
  return dbManager.createSupplier(supplierData);
});

ipcMain.handle('suppliers:update', async (_, { id, data }) => {
  return dbManager.updateSupplier(id, data);
});

ipcMain.handle('suppliers:delete', async (_, id) => {
  return dbManager.deleteSupplier(id);
});

// Purchases
ipcMain.handle('purchases:list', async (_, filters) => {
  return dbManager.getPurchases(filters);
});

ipcMain.handle('purchases:getById', async (_, id) => {
  return dbManager.getPurchaseById(id);
});

ipcMain.handle('purchases:create', async (_, purchaseData) => {
  return dbManager.createPurchase(purchaseData);
});

ipcMain.handle('purchases:addItem', async (_, { purchaseId, itemData }) => {
  return dbManager.addPurchaseItem(purchaseId, itemData);
});

ipcMain.handle('purchases:complete', async (_, { purchaseId, receivedBy }) => {
  return dbManager.completePurchase(purchaseId, receivedBy);
});

// Customers
ipcMain.handle('customers:list', async (_, filters) => {
  return dbManager.getCustomers(filters);
});

ipcMain.handle('customers:create', async (_, customerData) => {
  return dbManager.createCustomer(customerData);
});

ipcMain.handle('customers:update', async (_, { id, data }) => {
  return dbManager.updateCustomer(id, data);
});

ipcMain.handle('customers:getById', async (_, id) => {
  return dbManager.getCustomerById(id);
});

ipcMain.handle('customers:delete', async (_, id) => {
  return dbManager.deleteCustomer(id);
});

ipcMain.handle('customers:getPurchaseHistory', async (_, { customerId, filters }) => {
  return dbManager.getCustomerPurchaseHistory(customerId, filters);
});

ipcMain.handle('customers:getStats', async (_, customerId) => {
  return dbManager.getCustomerStats(customerId);
});

// Loyalty Points (Fidelidade)
ipcMain.handle('loyalty:addPoints', async (_, { customerId, saleAmount, saleId }) => {
  return dbManager.addLoyaltyPoints(customerId, saleAmount, saleId);
});

ipcMain.handle('loyalty:getCustomerLoyalty', async (_, customerId) => {
  return dbManager.getCustomerLoyalty(customerId);
});

ipcMain.handle('loyalty:fixCustomerPoints', async (_, customerCode) => {
  return dbManager.fixCustomerLoyaltyPoints(customerCode);
});

ipcMain.handle('loyalty:setCustomerPoints', async (_, { customerCode, points }) => {
  return dbManager.setCustomerLoyaltyPoints(customerCode, points);
});

// Users (Usuários)
ipcMain.handle('users:list', async (_, filters) => {
  return dbManager.getUsers(filters);
});

ipcMain.handle('users:create', async (_, userData) => {
  return dbManager.createUser(userData);
});

ipcMain.handle('users:update', async (_, { id, data }) => {
  return dbManager.updateUser(id, data);
});

ipcMain.handle('users:getById', async (_, id) => {
  return dbManager.getUserById(id);
});

ipcMain.handle('users:getByUsername', async (_, username) => {
  return dbManager.getUserByUsername(username);
});

ipcMain.handle('users:getByEmail', async (_, email) => {
  return dbManager.getUserByEmail(email);
});

ipcMain.handle('users:resetPassword', async (_, { id, newPasswordHash }) => {
  return dbManager.resetUserPassword(id, newPasswordHash);
});

ipcMain.handle('users:delete', async (_, id) => {
  return dbManager.deleteUser(id);
});

ipcMain.handle('users:hashPassword', async (_, password) => {
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
});

// Debts (Dívidas/Vales)
ipcMain.handle('debts:create', async (_, data) => {
  return dbManager.createDebt(data);
});

ipcMain.handle('debts:list', async (_, filters) => {
  return dbManager.getDebts(filters);
});

ipcMain.handle('debts:getById', async (_, id) => {
  return dbManager.getDebtById(id);
});

ipcMain.handle('debts:pay', async (_, data) => {
  return dbManager.payDebt(data);
});

ipcMain.handle('debts:cancel', async (_, { debtId, reason }) => {
  return dbManager.cancelDebt(debtId, reason);
});

ipcMain.handle('debts:getCustomerStats', async (_, customerId) => {
  return dbManager.getCustomerDebtStats(customerId);
});

ipcMain.handle('debts:getTablePendingDebts', async (_, tableNumber) => {
  const debtMap = dbManager.getTablePendingDebts(tableNumber);
  // Converter Map para objeto simples para IPC
  return Object.fromEntries(debtMap);
});

ipcMain.handle('debts:getCustomersPendingDebts', async (_, customerIds) => {
  return dbManager.getCustomersPendingDebts(customerIds);
});

// Inventory
ipcMain.handle('inventory:list', async (_, filters) => {
  return dbManager.getInventory(filters);
});

ipcMain.handle('inventory:update', async (_, { productId, branchId, quantity, reason }) => {
  return dbManager.updateInventory(productId, branchId, quantity, reason);
});

// Inventory Advanced
ipcMain.handle('inventory:registerLoss', async (_, { productId, branchId, quantity, reason, responsible, notes }) => {
  return dbManager.registerLoss(productId, branchId, quantity, reason, responsible, notes);
});

ipcMain.handle('inventory:registerBreakage', async (_, { productId, branchId, quantity, reason, responsible, notes }) => {
  return dbManager.registerBreakage(productId, branchId, quantity, reason, responsible, notes);
});

ipcMain.handle('inventory:manualAdjustment', async (_, { productId, branchId, quantity, reason, responsible, notes }) => {
  return dbManager.manualAdjustment(productId, branchId, quantity, reason, responsible, notes);
});

ipcMain.handle('inventory:calculateConsumption', async (_, { productId, branchId }) => {
  return dbManager.calculateConsumptionAndForecast(productId, branchId);
});

ipcMain.handle('inventory:getMovements', async (_, filters) => {
  return dbManager.getStockMovements(filters);
});

ipcMain.handle('inventory:validateConsistency', async (_, { productId, branchId }) => {
  return dbManager.validateInventoryConsistency(productId, branchId);
});

// Cash Box
ipcMain.handle('cashbox:open', async (_, data) => {
  return dbManager.openCashBox(data);
});

ipcMain.handle('cashbox:close', async (_, { cashBoxId, closingData }) => {
  return dbManager.closeCashBox(cashBoxId, closingData);
});

ipcMain.handle('cashbox:getCurrent', async () => {
  return dbManager.getCurrentCashBox();
});

ipcMain.handle('cashbox:getHistory', async (_, filters) => {
  return dbManager.getCashBoxHistory(filters);
});

// Tables Management (Gestão de Mesas)
ipcMain.handle('tables:create', async (_, data) => {
  return dbManager.createTable(data);
});

ipcMain.handle('tables:list', async (_, filters) => {
  return dbManager.getTables(filters);
});

ipcMain.handle('tables:getById', async (_, id) => {
  return dbManager.getTableById(id);
});

ipcMain.handle('tables:getOverview', async (_, branchId) => {
  return dbManager.getTablesOverview(branchId);
});

// Table Sessions
ipcMain.handle('tableSessions:open', async (_, data) => {
  return dbManager.openTableSession(data);
});

ipcMain.handle('tableSessions:close', async (_, data) => {
  return dbManager.closeTableSession(data);
});

ipcMain.handle('tableSessions:getById', async (_, id) => {
  return dbManager.getTableSessionById(id);
});

ipcMain.handle('tableSessions:list', async (_, filters) => {
  return dbManager.getTableSessions(filters);
});

ipcMain.handle('tableSessions:transfer', async (_, data) => {
  return dbManager.transferTableSession(data);
});

ipcMain.handle('tableSessions:transferCustomers', async (_, data) => {
  return dbManager.transferTableCustomers(data);
});

ipcMain.handle('tableSessions:merge', async (_, data) => {
  return dbManager.mergeTableSessions(data);
});

ipcMain.handle('tableSessions:split', async (_, data) => {
  return dbManager.splitMergedTable(data);
});

ipcMain.handle('tableSessions:getActions', async (_, sessionId) => {
  return dbManager.getTableSessionActions(sessionId);
});

// Table Customers
ipcMain.handle('tableCustomers:add', async (_, data) => {
  return dbManager.addCustomerToTable(data);
});

// Table Orders
ipcMain.handle('tableOrders:add', async (_, data) => {
  console.log('[IPC main.ts] tableOrders:add recebido:', data);
  const result = dbManager.addTableOrder(data);
  console.log('[IPC main.ts] tableOrders:add retornando:', result);
  return result;
});

ipcMain.handle('tableOrders:cancel', async (_, data) => {
  return dbManager.cancelTableOrder(data);
});

ipcMain.handle('tableOrders:transfer', async (_, data) => {
  return dbManager.transferTableOrder(data);
});

ipcMain.handle('tableOrders:split', async (_, data) => {
  return dbManager.splitTableOrder(data);
});

// Table Payments
ipcMain.handle('tablePayments:processCustomer', async (_, data) => {
  return dbManager.processTableCustomerPayment(data);
});

ipcMain.handle('tablePayments:processSession', async (_, data) => {
  return dbManager.processTableSessionPayment(data);
});

ipcMain.handle('cashbox:getById', async (_, id) => {
  return dbManager.getCashBoxById(id);
});

ipcMain.handle('cashbox:updateTotals', async (_, { cashBoxId, saleTotal, paymentMethod }) => {
  return dbManager.updateCashBoxTotals(cashBoxId, saleTotal, paymentMethod);
});

// Database Migrations
ipcMain.handle('database:fixUnitCost', async () => {
  return dbManager.fixUnitCostInSaleItems();
});

// Sync
ipcMain.handle('sync:start', async () => {
  await syncManager.start();
  return { success: true };
});

ipcMain.handle('sync:stop', async () => {
  await syncManager.stop();
  return { success: true };
});

ipcMain.handle('sync:status', async () => {
  return syncManager.getStatus();
});

ipcMain.handle('sync:checkConnection', async () => {
  return await syncManager.checkConnection();
});

ipcMain.handle('sync:tryReauthenticate', async () => {
  return await syncManager.tryReauthenticate();
});

ipcMain.handle('sync:forcePush', async () => {
  await syncManager.forcePush();
  return { success: true };
});

// Push inicial completo - envia TODOS os dados existentes para o servidor
ipcMain.handle('sync:pushFullInitialSync', async () => {
  return await syncManager.pushFullInitialSync();
});

// Settings
ipcMain.handle('settings:get', async (_, key) => {
  return store.get(key);
});

ipcMain.handle('settings:set', async (_, { key, value }) => {
  store.set(key, value);
  return { success: true };
});

ipcMain.handle('settings:getAll', async () => {
  return store.store;
});

// Backup
ipcMain.handle('backup:create', async () => {
  const backupPath = path.join(app.getPath('documents'), 'BarManager-Backups');
  return dbManager.createBackup(backupPath);
});

ipcMain.handle('backup:restore', async (_, filePath) => {
  return dbManager.restoreBackup(filePath);
});

// URL padrão do Railway
const DEFAULT_API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

// Reports - Usando API online do backend com fallback para dados locais
ipcMain.handle('reports:sales', async (_, { startDate, endDate, branchId }) => {
  const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
  const token = store.get('token') as string;
  
  try {
    const response = await axios.get(`${apiUrl}/reports/sales`, {
      params: { startDate, endDate, branchId },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });
    return response.data;
  } catch (error: any) {
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
      const totalSales = localData.reduce((sum: number, row: any) => sum + (row.total_amount || 0), 0);
      const salesCount = localData.reduce((sum: number, row: any) => sum + (row.total_sales || 0), 0);
      const totalSavings = localData.reduce((sum: number, row: any) => sum + (row.total_savings || 0), 0);
      
      console.log('💰 Totalizadores:', { totalSales, salesCount, totalSavings });
      
      return {
        period: { startDate, endDate },
        summary: {
          totalSales,
          salesCount,
          averageTicket: salesCount > 0 ? totalSales / salesCount : 0,
          muntuSavings: totalSavings,
        },
        dailySales: localData.map((row: any) => ({
          date: row.date,
          sales: row.total_sales || 0,
          total: row.total_amount || 0,
          savings: row.total_savings || 0,
        })),
      };
    } catch (localError: any) {
      console.error('❌ Erro ao buscar dados locais:', localError);
      console.error('❌ Stack trace:', localError.stack);
      throw new Error(`Backend indisponível e não foi possível acessar dados locais: ${localError.message}`);
    }
  }
});

ipcMain.handle('reports:purchases', async (_, { startDate, endDate, branchId }) => {
  const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
  const token = store.get('token') as string;
  
  try {
    const response = await axios.get(`${apiUrl}/reports/purchases`, {
      params: { startDate, endDate, branchId },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });
    return response.data;
  } catch (error: any) {
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

ipcMain.handle('reports:inventory', async (_, { branchId }) => {
  const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
  const token = store.get('token') as string;
  
  try {
    const response = await axios.get(`${apiUrl}/reports/inventory`, {
      params: { branchId },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });
    return response.data;
  } catch (error: any) {
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
      const lowStockItems = localData.filter((row: any) => row.status === 'low').length;
      const totalValue = localData.reduce((sum: number, row: any) => {
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
        items: localData.map((row: any) => ({
          name: row.name || '',
          sku: row.sku || '',
          quantity: row.qty_units || 0,
          lowStockAlert: row.low_stock_alert || 0,
          status: row.status || 'ok',
        })),
      };
    } catch (localError: any) {
      console.error('❌ Erro ao buscar dados locais:', localError);
      console.error('❌ Stack trace:', localError.stack);
      throw new Error(`Backend indisponível e não foi possível acessar dados locais: ${localError.message}`);
    }
  }
});

ipcMain.handle('reports:customers', async (_, { branchId }) => {
  const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
  const token = store.get('token') as string;
  
  try {
    const response = await axios.get(`${apiUrl}/reports/customers`, {
      params: { branchId },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });
    return response.data;
  } catch (error: any) {
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

ipcMain.handle('reports:debts', async (_, { branchId }) => {
  const apiUrl = store.get('apiUrl', DEFAULT_API_URL) as string;
  const token = store.get('token') as string;
  
  try {
    const response = await axios.get(`${apiUrl}/reports/debts`, {
      params: { branchId },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 3000,
    });
    return response.data;
  } catch (error: any) {
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
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Selecione o diretório para salvar relatórios',
  });

  if (result.canceled) {
    return { success: false, path: null };
  }

  return { success: true, path: result.filePaths[0] };
});

// Save report file
ipcMain.handle('reports:saveFile', async (_, { filePath, content, type }) => {
  try {
    if (type === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    } else if (type === 'pdf') {
      // Content vem em base64
      const buffer = Buffer.from(content, 'base64');
      fs.writeFileSync(filePath, buffer);
    } else {
      fs.writeFileSync(filePath, content);
    }
    return { success: true, filePath };
  } catch (error: any) {
    console.error('Erro ao salvar relatório:', error);
    return { success: false, error: error?.message || 'Erro desconhecido' };
  }
});

// Printer
ipcMain.handle('printer:print', async (_, { type, data }) => {
  // TODO: Implementar impressão térmica
  console.log('Print:', type, data);
  return { success: true };
});
