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
const electron_store_1 = __importDefault(require("electron-store"));
const manager_1 = require("./database/manager");
const manager_2 = require("./sync/manager");
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
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5175');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    // Inicializar banco de dados local SQLite
    const dbPath = path.join(electron_1.app.getPath('userData'), 'barmanager.db');
    dbManager = new manager_1.DatabaseManager(dbPath);
    await dbManager.initialize();
    // Inicializar sincronização
    const apiUrl = store.get('apiUrl', 'http://localhost:3000/api/v1');
    syncManager = new manager_2.SyncManager(dbManager, apiUrl);
    createWindow();
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
        console.log('IPC auth:login result:', result);
        return { success: true, data: result };
    }
    catch (error) {
        console.error('IPC auth:login error:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('auth:logout', async () => {
    await syncManager.logout();
    return { success: true };
});
// Sales
electron_1.ipcMain.handle('sales:create', async (_, saleData) => {
    return dbManager.createSale(saleData);
});
electron_1.ipcMain.handle('sales:addItem', async (_, { saleId, itemData }) => {
    return dbManager.addSaleItem(saleId, itemData);
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
// Inventory
electron_1.ipcMain.handle('inventory:list', async (_, filters) => {
    return dbManager.getInventory(filters);
});
electron_1.ipcMain.handle('inventory:update', async (_, { productId, quantity, reason }) => {
    return dbManager.updateInventory(productId, quantity, reason);
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
electron_1.ipcMain.handle('sync:forcePush', async () => {
    await syncManager.forcePush();
    return { success: true };
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
electron_1.ipcMain.handle('backup:create', async () => {
    const backupPath = path.join(electron_1.app.getPath('documents'), 'BarManager-Backups');
    return dbManager.createBackup(backupPath);
});
electron_1.ipcMain.handle('backup:restore', async (_, filePath) => {
    return dbManager.restoreBackup(filePath);
});
// Reports
electron_1.ipcMain.handle('reports:sales', async (_, { startDate, endDate, branchId }) => {
    return dbManager.getSalesReport(startDate, endDate, branchId);
});
electron_1.ipcMain.handle('reports:inventory', async (_, { branchId }) => {
    return dbManager.getInventoryReport(branchId);
});
// Printer
electron_1.ipcMain.handle('printer:print', async (_, { type, data }) => {
    // TODO: Implementar impressão térmica
    console.log('Print:', type, data);
    return { success: true };
});
//# sourceMappingURL=main.js.map