import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
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
    mainWindow.loadURL('http://localhost:5175');
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
  const apiUrl = store.get('apiUrl', 'http://localhost:3000/api/v1') as string;
  syncManager = new SyncManager(dbManager, apiUrl);

  createWindow();

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

// Inventory
ipcMain.handle('inventory:list', async (_, filters) => {
  return dbManager.getInventory(filters);
});

ipcMain.handle('inventory:update', async (_, { productId, quantity, reason }) => {
  return dbManager.updateInventory(productId, quantity, reason);
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

ipcMain.handle('sync:forcePush', async () => {
  await syncManager.forcePush();
  return { success: true };
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

// Reports
ipcMain.handle('reports:sales', async (_, { startDate, endDate, branchId }) => {
  return dbManager.getSalesReport(startDate, endDate, branchId);
});

ipcMain.handle('reports:inventory', async (_, { branchId }) => {
  return dbManager.getInventoryReport(branchId);
});

// Printer
ipcMain.handle('printer:print', async (_, { type, data }) => {
  // TODO: Implementar impressão térmica
  console.log('Print:', type, data);
  return { success: true };
});
