import { contextBridge, ipcRenderer } from 'electron';

// API exposta para o renderer (React)
const api = {
  // Auth
  auth: {
    login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },
  
  // Sales
  sales: {
    create: (data: any) => ipcRenderer.invoke('sales:create', data),
    addItem: (saleId: string, itemData: any) => ipcRenderer.invoke('sales:addItem', { saleId, itemData }),
    list: (filters: any) => ipcRenderer.invoke('sales:list', filters),
    getById: (saleId: string) => ipcRenderer.invoke('sales:getById', saleId),
  },
  
  // Products
  products: {
    list: (filters: any) => ipcRenderer.invoke('products:list', filters),
    search: (query: string) => ipcRenderer.invoke('products:search', query),
  },
  
  // Inventory
  inventory: {
    list: (filters: any) => ipcRenderer.invoke('inventory:list', filters),
    update: (productId: string, quantity: number, reason: string) =>
      ipcRenderer.invoke('inventory:update', { productId, quantity, reason }),
  },
  
  // Cash Box
  cashBox: {
    open: (data: any) => ipcRenderer.invoke('cashbox:open', data),
    close: (cashBoxId: string, closingData: any) =>
      ipcRenderer.invoke('cashbox:close', { cashBoxId, closingData }),
    getCurrent: () => ipcRenderer.invoke('cashbox:getCurrent'),
  },
  
  // Sync
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    stop: () => ipcRenderer.invoke('sync:stop'),
    status: () => ipcRenderer.invoke('sync:status'),
    forcePush: () => ipcRenderer.invoke('sync:forcePush'),
    
    // Listeners
    onSyncStart: (callback: () => void) => {
      ipcRenderer.on('sync:started', callback);
      return () => ipcRenderer.removeListener('sync:started', callback);
    },
    onSyncComplete: (callback: (data: any) => void) => {
      ipcRenderer.on('sync:completed', (_, data) => callback(data));
      return () => ipcRenderer.removeListener('sync:completed', callback);
    },
    onSyncError: (callback: (error: string) => void) => {
      const handler = (_: any, error: string) => callback(error);
      ipcRenderer.on('sync:error', handler);
      return () => ipcRenderer.removeListener('sync:error', handler);
    },
  },
  
  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', { key, value }),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  
  // Backup
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
  },
  
  // Reports
  reports: {
    sales: (startDate: Date, endDate: Date, branchId?: string) =>
      ipcRenderer.invoke('reports:sales', { startDate, endDate, branchId }),
    inventory: (branchId?: string) => ipcRenderer.invoke('reports:inventory', { branchId }),
  },
  
  // Printer
  printer: {
    print: (type: string, data: any) => ipcRenderer.invoke('printer:print', { type, data }),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
