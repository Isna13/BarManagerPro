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
        addPayment: (saleId, paymentData) => electron_1.ipcRenderer.invoke('sales:addPayment', { saleId, paymentData }),
        list: (filters) => electron_1.ipcRenderer.invoke('sales:list', filters),
        getById: (saleId) => electron_1.ipcRenderer.invoke('sales:getById', saleId),
    },
    // Products
    products: {
        list: (filters) => electron_1.ipcRenderer.invoke('products:list', filters),
        search: (query) => electron_1.ipcRenderer.invoke('products:search', query),
        create: (productData) => electron_1.ipcRenderer.invoke('products:create', productData),
        update: (id, data) => electron_1.ipcRenderer.invoke('products:update', { id, data }),
        getById: (id) => electron_1.ipcRenderer.invoke('products:getById', id),
    },
    // Categories
    categories: {
        list: (filters) => electron_1.ipcRenderer.invoke('categories:list', filters),
        create: (categoryData) => electron_1.ipcRenderer.invoke('categories:create', categoryData),
        update: (id, data) => electron_1.ipcRenderer.invoke('categories:update', { id, data }),
        delete: (id) => electron_1.ipcRenderer.invoke('categories:delete', id),
    },
    // Suppliers
    suppliers: {
        list: () => electron_1.ipcRenderer.invoke('suppliers:list'),
        create: (supplierData) => electron_1.ipcRenderer.invoke('suppliers:create', supplierData),
        update: (id, data) => electron_1.ipcRenderer.invoke('suppliers:update', { id, data }),
        delete: (id) => electron_1.ipcRenderer.invoke('suppliers:delete', id),
    },
    // Purchases
    purchases: {
        list: (filters) => electron_1.ipcRenderer.invoke('purchases:list', filters),
        getById: (id) => electron_1.ipcRenderer.invoke('purchases:getById', id),
        create: (purchaseData) => electron_1.ipcRenderer.invoke('purchases:create', purchaseData),
        addItem: (purchaseId, itemData) => electron_1.ipcRenderer.invoke('purchases:addItem', { purchaseId, itemData }),
        complete: (purchaseId, receivedBy) => electron_1.ipcRenderer.invoke('purchases:complete', { purchaseId, receivedBy }),
    },
    // Customers
    customers: {
        list: (filters) => electron_1.ipcRenderer.invoke('customers:list', filters),
        getById: (id) => electron_1.ipcRenderer.invoke('customers:getById', id),
        create: (data) => electron_1.ipcRenderer.invoke('customers:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('customers:update', { id, data }),
        delete: (id) => electron_1.ipcRenderer.invoke('customers:delete', id),
        getPurchaseHistory: (customerId, filters) => electron_1.ipcRenderer.invoke('customers:getPurchaseHistory', { customerId, filters }),
        getStats: (customerId) => electron_1.ipcRenderer.invoke('customers:getStats', customerId),
    },
    // Loyalty Points (Fidelidade)
    loyalty: {
        addPoints: (customerId, saleAmount, saleId) => electron_1.ipcRenderer.invoke('loyalty:addPoints', { customerId, saleAmount, saleId }),
        getCustomerLoyalty: (customerId) => electron_1.ipcRenderer.invoke('loyalty:getCustomerLoyalty', customerId),
        fixCustomerPoints: (customerCode) => electron_1.ipcRenderer.invoke('loyalty:fixCustomerPoints', customerCode),
        setCustomerPoints: (customerCode, points) => electron_1.ipcRenderer.invoke('loyalty:setCustomerPoints', { customerCode, points }),
    },
    // Debts (Dívidas/Vales)
    debts: {
        create: (data) => electron_1.ipcRenderer.invoke('debts:create', data),
        list: (filters) => electron_1.ipcRenderer.invoke('debts:list', filters),
        getById: (id) => electron_1.ipcRenderer.invoke('debts:getById', id),
        pay: (data) => electron_1.ipcRenderer.invoke('debts:pay', data),
        cancel: (debtId, reason) => electron_1.ipcRenderer.invoke('debts:cancel', { debtId, reason }),
        getCustomerStats: (customerId) => electron_1.ipcRenderer.invoke('debts:getCustomerStats', customerId),
        getTablePendingDebts: (tableNumber) => electron_1.ipcRenderer.invoke('debts:getTablePendingDebts', tableNumber),
        getCustomersPendingDebts: (customerIds) => electron_1.ipcRenderer.invoke('debts:getCustomersPendingDebts', customerIds),
    },
    // Users (Usuários)
    users: {
        list: (filters) => electron_1.ipcRenderer.invoke('users:list', filters),
        create: (data) => electron_1.ipcRenderer.invoke('users:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('users:update', { id, data }),
        getById: (id) => electron_1.ipcRenderer.invoke('users:getById', id),
        getByUsername: (username) => electron_1.ipcRenderer.invoke('users:getByUsername', username),
        getByEmail: (email) => electron_1.ipcRenderer.invoke('users:getByEmail', email),
        resetPassword: (id, newPasswordHash) => electron_1.ipcRenderer.invoke('users:resetPassword', { id, newPasswordHash }),
        delete: (id) => electron_1.ipcRenderer.invoke('users:delete', id),
        hashPassword: (password) => electron_1.ipcRenderer.invoke('users:hashPassword', password),
    },
    // Inventory
    inventory: {
        list: (filters) => electron_1.ipcRenderer.invoke('inventory:list', filters),
        update: (productId, branchId, quantity, reason) => electron_1.ipcRenderer.invoke('inventory:update', { productId, branchId, quantity, reason }),
        // Advanced Stock Management
        registerLoss: (productId, branchId, quantity, reason, responsible, notes) => electron_1.ipcRenderer.invoke('inventory:registerLoss', { productId, branchId, quantity, reason, responsible, notes }),
        registerBreakage: (productId, branchId, quantity, reason, responsible, notes) => electron_1.ipcRenderer.invoke('inventory:registerBreakage', { productId, branchId, quantity, reason, responsible, notes }),
        manualAdjustment: (productId, branchId, quantity, reason, responsible, notes) => electron_1.ipcRenderer.invoke('inventory:manualAdjustment', { productId, branchId, quantity, reason, responsible, notes }),
        calculateConsumption: (productId, branchId) => electron_1.ipcRenderer.invoke('inventory:calculateConsumption', { productId, branchId }),
        getMovements: (filters) => electron_1.ipcRenderer.invoke('inventory:getMovements', filters),
        validateConsistency: (productId, branchId) => electron_1.ipcRenderer.invoke('inventory:validateConsistency', { productId, branchId }),
    },
    // Cash Box
    cashBox: {
        open: (data) => electron_1.ipcRenderer.invoke('cashbox:open', data),
        close: (cashBoxId, closingData) => electron_1.ipcRenderer.invoke('cashbox:close', { cashBoxId, closingData }),
        getCurrent: () => electron_1.ipcRenderer.invoke('cashbox:getCurrent'),
        getHistory: (filters) => electron_1.ipcRenderer.invoke('cashbox:getHistory', filters),
        getById: (id) => electron_1.ipcRenderer.invoke('cashbox:getById', id),
        updateTotals: (cashBoxId, saleTotal, paymentMethod) => electron_1.ipcRenderer.invoke('cashbox:updateTotals', { cashBoxId, saleTotal, paymentMethod }),
    },
    // Tables Management (Gestão de Mesas)
    tables: {
        create: (data) => electron_1.ipcRenderer.invoke('tables:create', data),
        list: (filters) => electron_1.ipcRenderer.invoke('tables:list', filters),
        getById: (id) => electron_1.ipcRenderer.invoke('tables:getById', id),
        getOverview: (branchId) => electron_1.ipcRenderer.invoke('tables:getOverview', branchId),
    },
    // Table Sessions
    tableSessions: {
        open: (data) => electron_1.ipcRenderer.invoke('tableSessions:open', data),
        close: (data) => electron_1.ipcRenderer.invoke('tableSessions:close', data),
        getById: (id) => electron_1.ipcRenderer.invoke('tableSessions:getById', id),
        list: (filters) => electron_1.ipcRenderer.invoke('tableSessions:list', filters),
        transfer: (data) => electron_1.ipcRenderer.invoke('tableSessions:transfer', data),
        transferCustomers: (data) => electron_1.ipcRenderer.invoke('tableSessions:transferCustomers', data),
        merge: (data) => electron_1.ipcRenderer.invoke('tableSessions:merge', data),
        split: (data) => electron_1.ipcRenderer.invoke('tableSessions:split', data),
        getActions: (sessionId) => electron_1.ipcRenderer.invoke('tableSessions:getActions', sessionId),
    },
    // Table Customers
    tableCustomers: {
        add: (data) => electron_1.ipcRenderer.invoke('tableCustomers:add', data),
    },
    // Table Orders
    tableOrders: {
        add: (data) => electron_1.ipcRenderer.invoke('tableOrders:add', data),
        cancel: (data) => electron_1.ipcRenderer.invoke('tableOrders:cancel', data),
        transfer: (data) => electron_1.ipcRenderer.invoke('tableOrders:transfer', data),
        split: (data) => electron_1.ipcRenderer.invoke('tableOrders:split', data),
    },
    // Table Payments
    tablePayments: {
        processCustomer: (data) => electron_1.ipcRenderer.invoke('tablePayments:processCustomer', data),
        processSession: (data) => electron_1.ipcRenderer.invoke('tablePayments:processSession', data),
    },
    // Database Migrations
    database: {
        fixUnitCost: () => electron_1.ipcRenderer.invoke('database:fixUnitCost'),
    },
    // Sync
    sync: {
        start: () => electron_1.ipcRenderer.invoke('sync:start'),
        stop: () => electron_1.ipcRenderer.invoke('sync:stop'),
        status: () => electron_1.ipcRenderer.invoke('sync:status'),
        forcePush: () => electron_1.ipcRenderer.invoke('sync:forcePush'),
        checkConnection: () => electron_1.ipcRenderer.invoke('sync:checkConnection'),
        tryReauthenticate: () => electron_1.ipcRenderer.invoke('sync:tryReauthenticate'),
        // Listeners
        onSyncStart: (callback) => {
            electron_1.ipcRenderer.on('sync:started', callback);
            return () => electron_1.ipcRenderer.removeListener('sync:started', callback);
        },
        onSyncProgress: (callback) => {
            electron_1.ipcRenderer.on('sync:progress', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeListener('sync:progress', callback);
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
        onReauthenticated: (callback) => {
            electron_1.ipcRenderer.on('sync:reauthenticated', (_, data) => callback(data));
            return () => electron_1.ipcRenderer.removeListener('sync:reauthenticated', callback);
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
        purchases: (startDate, endDate, branchId) => electron_1.ipcRenderer.invoke('reports:purchases', { startDate, endDate, branchId }),
        inventory: (branchId) => electron_1.ipcRenderer.invoke('reports:inventory', { branchId }),
        customers: (branchId) => electron_1.ipcRenderer.invoke('reports:customers', { branchId }),
        debts: (branchId) => electron_1.ipcRenderer.invoke('reports:debts', { branchId }),
        saveFile: (filePath, content, type) => electron_1.ipcRenderer.invoke('reports:saveFile', { filePath, content, type }),
    },
    // Dialog
    dialog: {
        selectDirectory: () => electron_1.ipcRenderer.invoke('dialog:selectDirectory'),
    },
    // Printer
    printer: {
        print: (type, data) => electron_1.ipcRenderer.invoke('printer:print', { type, data }),
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
//# sourceMappingURL=preload.js.map