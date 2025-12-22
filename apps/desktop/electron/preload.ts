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
    addPayment: (saleId: string, paymentData: any) => ipcRenderer.invoke('sales:addPayment', { saleId, paymentData }),
    list: (filters: any) => ipcRenderer.invoke('sales:list', filters),
    getById: (saleId: string) => ipcRenderer.invoke('sales:getById', saleId),
  },
  
  // Products
  products: {
    list: (filters: any) => ipcRenderer.invoke('products:list', filters),
    search: (query: string) => ipcRenderer.invoke('products:search', query),
    create: (productData: any) => ipcRenderer.invoke('products:create', productData),
    update: (id: string, data: any) => ipcRenderer.invoke('products:update', { id, data }),
    getById: (id: string) => ipcRenderer.invoke('products:getById', id),
  },
  
  // Categories
  categories: {
    list: (filters?: any) => ipcRenderer.invoke('categories:list', filters),
    create: (categoryData: any) => ipcRenderer.invoke('categories:create', categoryData),
    update: (id: string, data: any) => ipcRenderer.invoke('categories:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('categories:delete', id),
  },
  
  // Suppliers
  suppliers: {
    list: () => ipcRenderer.invoke('suppliers:list'),
    create: (supplierData: any) => ipcRenderer.invoke('suppliers:create', supplierData),
    update: (id: string, data: any) => ipcRenderer.invoke('suppliers:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('suppliers:delete', id),
  },
  
  // Purchases
  purchases: {
    list: (filters: any) => ipcRenderer.invoke('purchases:list', filters),
    getById: (id: string) => ipcRenderer.invoke('purchases:getById', id),
    create: (purchaseData: any) => ipcRenderer.invoke('purchases:create', purchaseData),
    addItem: (purchaseId: string, itemData: any) => ipcRenderer.invoke('purchases:addItem', { purchaseId, itemData }),
    complete: (purchaseId: string, receivedBy: string) => ipcRenderer.invoke('purchases:complete', { purchaseId, receivedBy }),
  },
  
  // Customers
  customers: {
    list: (filters: any) => ipcRenderer.invoke('customers:list', filters),
    getById: (id: string) => ipcRenderer.invoke('customers:getById', id),
    create: (data: any) => ipcRenderer.invoke('customers:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('customers:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('customers:delete', id),
    getPurchaseHistory: (customerId: string, filters?: any) => 
      ipcRenderer.invoke('customers:getPurchaseHistory', { customerId, filters }),
    getStats: (customerId: string) => ipcRenderer.invoke('customers:getStats', customerId),
  },

  // Loyalty Points (Fidelidade)
  loyalty: {
    addPoints: (customerId: string, saleAmount: number, saleId: string) => 
      ipcRenderer.invoke('loyalty:addPoints', { customerId, saleAmount, saleId }),
    getCustomerLoyalty: (customerId: string) => 
      ipcRenderer.invoke('loyalty:getCustomerLoyalty', customerId),
    fixCustomerPoints: (customerCode: string) =>
      ipcRenderer.invoke('loyalty:fixCustomerPoints', customerCode),
    setCustomerPoints: (customerCode: string, points: number) =>
      ipcRenderer.invoke('loyalty:setCustomerPoints', { customerCode, points }),
  },

  // Debts (Dívidas/Vales)
  debts: {
    create: (data: any) => ipcRenderer.invoke('debts:create', data),
    list: (filters?: any) => ipcRenderer.invoke('debts:list', filters),
    getById: (id: string) => ipcRenderer.invoke('debts:getById', id),
    pay: (data: any) => ipcRenderer.invoke('debts:pay', data),
    cancel: (debtId: string, reason: string) => ipcRenderer.invoke('debts:cancel', { debtId, reason }),
    getCustomerStats: (customerId: string) => ipcRenderer.invoke('debts:getCustomerStats', customerId),
    getTablePendingDebts: (tableNumber: string) => ipcRenderer.invoke('debts:getTablePendingDebts', tableNumber),
    getCustomersPendingDebts: (customerIds: string[]) => ipcRenderer.invoke('debts:getCustomersPendingDebts', customerIds),
  },

  // Users (Usuários)
  users: {
    list: (filters?: any) => ipcRenderer.invoke('users:list', filters),
    create: (data: any) => ipcRenderer.invoke('users:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('users:update', { id, data }),
    getById: (id: string) => ipcRenderer.invoke('users:getById', id),
    getByUsername: (username: string) => ipcRenderer.invoke('users:getByUsername', username),
    getByEmail: (email: string) => ipcRenderer.invoke('users:getByEmail', email),
    resetPassword: (id: string, newPasswordHash: string, originalPassword?: string) => 
      ipcRenderer.invoke('users:resetPassword', { id, newPasswordHash, originalPassword }),
    delete: (id: string) => ipcRenderer.invoke('users:delete', id),
    hashPassword: (password: string) => ipcRenderer.invoke('users:hashPassword', password),
  },
  
  // Inventory
  inventory: {
    list: (filters: any) => ipcRenderer.invoke('inventory:list', filters),
    update: (productId: string, branchId: string, quantity: number, reason: string) =>
      ipcRenderer.invoke('inventory:update', { productId, branchId, quantity, reason }),
    
    // Advanced Stock Management
    registerLoss: (productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) =>
      ipcRenderer.invoke('inventory:registerLoss', { productId, branchId, quantity, reason, responsible, notes }),
    registerBreakage: (productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) =>
      ipcRenderer.invoke('inventory:registerBreakage', { productId, branchId, quantity, reason, responsible, notes }),
    manualAdjustment: (productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) =>
      ipcRenderer.invoke('inventory:manualAdjustment', { productId, branchId, quantity, reason, responsible, notes }),
    calculateConsumption: (productId: string, branchId: string) =>
      ipcRenderer.invoke('inventory:calculateConsumption', { productId, branchId }),
    getMovements: (filters: any) =>
      ipcRenderer.invoke('inventory:getMovements', filters),
    validateConsistency: (productId: string, branchId: string) =>
      ipcRenderer.invoke('inventory:validateConsistency', { productId, branchId }),
  },
  
  // Cash Box
  cashBox: {
    open: (data: any) => ipcRenderer.invoke('cashbox:open', data),
    close: (cashBoxId: string, closingData: any) =>
      ipcRenderer.invoke('cashbox:close', { cashBoxId, closingData }),
    getCurrent: () => ipcRenderer.invoke('cashbox:getCurrent'),
    getHistory: (filters?: any) => ipcRenderer.invoke('cashbox:getHistory', filters),
    getById: (id: string) => ipcRenderer.invoke('cashbox:getById', id),
    updateTotals: (cashBoxId: string, saleTotal: number, paymentMethod: string) =>
      ipcRenderer.invoke('cashbox:updateTotals', { cashBoxId, saleTotal, paymentMethod }),
  },

  // Tables Management (Gestão de Mesas)
  tables: {
    create: (data: any) => ipcRenderer.invoke('tables:create', data),
    list: (filters?: any) => ipcRenderer.invoke('tables:list', filters),
    getById: (id: string) => ipcRenderer.invoke('tables:getById', id),
    getOverview: (branchId: string) => ipcRenderer.invoke('tables:getOverview', branchId),
  },

  // Table Sessions
  tableSessions: {
    open: (data: any) => ipcRenderer.invoke('tableSessions:open', data),
    close: (data: any) => ipcRenderer.invoke('tableSessions:close', data),
    getById: (id: string) => ipcRenderer.invoke('tableSessions:getById', id),
    list: (filters?: any) => ipcRenderer.invoke('tableSessions:list', filters),
    transfer: (data: any) => ipcRenderer.invoke('tableSessions:transfer', data),
    transferCustomers: (data: any) => ipcRenderer.invoke('tableSessions:transferCustomers', data),
    merge: (data: any) => ipcRenderer.invoke('tableSessions:merge', data),
    split: (data: any) => ipcRenderer.invoke('tableSessions:split', data),
    getActions: (sessionId: string) => ipcRenderer.invoke('tableSessions:getActions', sessionId),
  },

  // Table Customers
  tableCustomers: {
    add: (data: any) => ipcRenderer.invoke('tableCustomers:add', data),
  },

  // Table Orders
  tableOrders: {
    add: (data: any) => ipcRenderer.invoke('tableOrders:add', data),
    cancel: (data: any) => ipcRenderer.invoke('tableOrders:cancel', data),
    transfer: (data: any) => ipcRenderer.invoke('tableOrders:transfer', data),
    split: (data: any) => ipcRenderer.invoke('tableOrders:split', data),
  },

  // Table Payments
  tablePayments: {
    processCustomer: (data: any) => ipcRenderer.invoke('tablePayments:processCustomer', data),
    processSession: (data: any) => ipcRenderer.invoke('tablePayments:processSession', data),
    clearPaidOrders: (data: any) => ipcRenderer.invoke('tablePayments:clearPaidOrders', data),
  },
  
  // Database Migrations
  database: {
    fixUnitCost: () => ipcRenderer.invoke('database:fixUnitCost'),
  },
  
  // Sync
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    stop: () => ipcRenderer.invoke('sync:stop'),
    status: () => ipcRenderer.invoke('sync:status'),
    forcePush: () => ipcRenderer.invoke('sync:forcePush'),
    pushFullInitialSync: () => ipcRenderer.invoke('sync:pushFullInitialSync'),
    checkConnection: () => ipcRenderer.invoke('sync:checkConnection'),
    tryReauthenticate: () => ipcRenderer.invoke('sync:tryReauthenticate'),
    queueFullResync: () => ipcRenderer.invoke('sync:queueFullResync'),
    getQueueStats: () => ipcRenderer.invoke('sync:getQueueStats'),
    
    // Listeners
    onSyncStart: (callback: () => void) => {
      ipcRenderer.on('sync:started', callback);
      return () => ipcRenderer.removeListener('sync:started', callback);
    },
    onSyncProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('sync:progress', (_, data) => callback(data));
      return () => ipcRenderer.removeListener('sync:progress', callback);
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
    onReauthenticated: (callback: (data: any) => void) => {
      ipcRenderer.on('sync:reauthenticated', (_, data) => callback(data));
      return () => ipcRenderer.removeListener('sync:reauthenticated', callback);
    },
    
    // Smart Sync - Connection monitoring
    getConnectionStatus: () => ipcRenderer.invoke('sync:getConnectionStatus'),
    fullPullFromServer: () => ipcRenderer.invoke('sync:fullPullFromServer'),
    startConnectionMonitor: () => ipcRenderer.invoke('sync:startConnectionMonitor'),
    stopConnectionMonitor: () => ipcRenderer.invoke('sync:stopConnectionMonitor'),
    
    // Sync status and device info
    getDetailedStatus: () => ipcRenderer.invoke('sync:getDetailedStatus'),
    getDeviceId: () => ipcRenderer.invoke('sync:getDeviceId'),
    
    // FASE 3: Audit log
    getAuditLog: (options?: { limit?: number; entity?: string; status?: string }) => 
      ipcRenderer.invoke('sync:getAuditLog', options),
    
    // FASE 3: Conflict management
    getConflicts: () => ipcRenderer.invoke('sync:getConflicts'),
    resolveConflict: (conflictId: string, resolution: 'keep_local' | 'keep_server' | 'merge') =>
      ipcRenderer.invoke('sync:resolveConflict', conflictId, resolution),
    
    // FASE 3: Device registry
    getActiveDevices: () => ipcRenderer.invoke('sync:getActiveDevices'),
    getAllDevices: () => ipcRenderer.invoke('sync:getAllDevices'),
    updateHeartbeat: () => ipcRenderer.invoke('sync:updateHeartbeat'),
    
    // FASE 3: Conflict event listener
    onConflict: (callback: (data: { entity: string; entityId: string; localTimestamp: Date; serverTimestamp: Date }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('sync:conflict', handler);
      return () => ipcRenderer.removeListener('sync:conflict', handler);
    },
    
    onConnectionChange: (callback: (data: { isOnline: boolean }) => void) => {
      const handler = (_: any, data: { isOnline: boolean }) => callback(data);
      ipcRenderer.on('sync:connectionChange', handler);
      return () => ipcRenderer.removeListener('sync:connectionChange', handler);
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
    create: (options?: { backupDir?: string; backupType?: string; createdBy?: string }) => 
      ipcRenderer.invoke('backup:create', options),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    history: (limit?: number) => ipcRenderer.invoke('backup:history', limit),
    delete: (id: string, deleteFile?: boolean) => 
      ipcRenderer.invoke('backup:delete', { id, deleteFile }),
    selectFile: () => ipcRenderer.invoke('backup:selectFile'),
    selectDirectory: () => ipcRenderer.invoke('backup:selectDirectory'),
  },
  
  // Reports
  reports: {
    sales: (startDate: string, endDate: string, branchId?: string) =>
      ipcRenderer.invoke('reports:sales', { startDate, endDate, branchId }),
    purchases: (startDate: string, endDate: string, branchId?: string) =>
      ipcRenderer.invoke('reports:purchases', { startDate, endDate, branchId }),
    inventory: (branchId?: string) => ipcRenderer.invoke('reports:inventory', { branchId }),
    customers: (branchId?: string) => ipcRenderer.invoke('reports:customers', { branchId }),
    debts: (branchId?: string) => ipcRenderer.invoke('reports:debts', { branchId }),
    saveFile: (filePath: string, content: any, type: string) =>
      ipcRenderer.invoke('reports:saveFile', { filePath, content, type }),
  },
  
  // Dialog
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  },
  
  // Printer
  printer: {
    print: (type: string, data: any) => ipcRenderer.invoke('printer:print', { type, data }),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
