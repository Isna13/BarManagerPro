"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// API exposta para o renderer (React)
const api = {
    // Auth
    auth: {
        login: (credentials) => electron_1.ipcRenderer.invoke('auth:login', credentials),
        logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    },
    // Sales
    sales: {
        create: (data) => electron_1.ipcRenderer.invoke('sales:create', data),
        addItem: (saleId, itemData) => electron_1.ipcRenderer.invoke('sales:addItem', { saleId, itemData }),
        list: (filters) => electron_1.ipcRenderer.invoke('sales:list', filters),
        getById: (saleId) => electron_1.ipcRenderer.invoke('sales:getById', saleId),
    },
    // Products
    products: {
        list: (filters) => electron_1.ipcRenderer.invoke('products:list', filters),
        search: (query) => electron_1.ipcRenderer.invoke('products:search', query),
    },
    // Inventory
    inventory: {
        list: (filters) => electron_1.ipcRenderer.invoke('inventory:list', filters),
        update: (productId, quantity, reason) => electron_1.ipcRenderer.invoke('inventory:update', { productId, quantity, reason }),
    },
    // Cash Box
    cashBox: {
        open: (data) => electron_1.ipcRenderer.invoke('cashbox:open', data),
        close: (cashBoxId, closingData) => electron_1.ipcRenderer.invoke('cashbox:close', { cashBoxId, closingData }),
        getCurrent: () => electron_1.ipcRenderer.invoke('cashbox:getCurrent'),
    },
    // Sync
    sync: {
        start: () => electron_1.ipcRenderer.invoke('sync:start'),
        stop: () => electron_1.ipcRenderer.invoke('sync:stop'),
        status: () => electron_1.ipcRenderer.invoke('sync:status'),
        forcePush: () => electron_1.ipcRenderer.invoke('sync:forcePush'),
        // Listeners
        onSyncStart: (callback) => {
            electron_1.ipcRenderer.on('sync:started', callback);
            return () => electron_1.ipcRenderer.removeListener('sync:started', callback);
        },
        onSyncComplete: (callback) => {
            electron_1.ipcRenderer.on('sync:completed', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeListener('sync:completed', callback);
        },
        onSyncError: (callback) => {
            const handler = (_, error) => callback(error);
            electron_1.ipcRenderer.on('sync:error', handler);
            return () => electron_1.ipcRenderer.removeListener('sync:error', handler);
        },
    },
    // Settings
    settings: {
        get: (key) => electron_1.ipcRenderer.invoke('settings:get', key),
        set: (key, value) => electron_1.ipcRenderer.invoke('settings:set', { key, value }),
        getAll: () => electron_1.ipcRenderer.invoke('settings:getAll'),
    },
    // Backup
    backup: {
        create: () => electron_1.ipcRenderer.invoke('backup:create'),
        restore: (filePath) => electron_1.ipcRenderer.invoke('backup:restore', filePath),
    },
    // Reports
    reports: {
        sales: (startDate, endDate, branchId) => electron_1.ipcRenderer.invoke('reports:sales', { startDate, endDate, branchId }),
        inventory: (branchId) => electron_1.ipcRenderer.invoke('reports:inventory', { branchId }),
    },
    // Printer
    printer: {
        print: (type, data) => electron_1.ipcRenderer.invoke('printer:print', { type, data }),
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
//# sourceMappingURL=preload.js.map