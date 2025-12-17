declare const api: {
    auth: {
        login: (credentials: any) => Promise<any>;
        logout: () => Promise<any>;
    };
    sales: {
        create: (data: any) => Promise<any>;
        addItem: (saleId: string, itemData: any) => Promise<any>;
        addPayment: (saleId: string, paymentData: any) => Promise<any>;
        list: (filters: any) => Promise<any>;
        getById: (saleId: string) => Promise<any>;
    };
    products: {
        list: (filters: any) => Promise<any>;
        search: (query: string) => Promise<any>;
        create: (productData: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
    };
    categories: {
        list: (filters?: any) => Promise<any>;
        create: (categoryData: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
    };
    suppliers: {
        list: () => Promise<any>;
        create: (supplierData: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
    };
    purchases: {
        list: (filters: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        create: (purchaseData: any) => Promise<any>;
        addItem: (purchaseId: string, itemData: any) => Promise<any>;
        complete: (purchaseId: string, receivedBy: string) => Promise<any>;
    };
    customers: {
        list: (filters: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
        getPurchaseHistory: (customerId: string, filters?: any) => Promise<any>;
        getStats: (customerId: string) => Promise<any>;
    };
    loyalty: {
        addPoints: (customerId: string, saleAmount: number, saleId: string) => Promise<any>;
        getCustomerLoyalty: (customerId: string) => Promise<any>;
        fixCustomerPoints: (customerCode: string) => Promise<any>;
        setCustomerPoints: (customerCode: string, points: number) => Promise<any>;
    };
    debts: {
        create: (data: any) => Promise<any>;
        list: (filters?: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        pay: (data: any) => Promise<any>;
        cancel: (debtId: string, reason: string) => Promise<any>;
        getCustomerStats: (customerId: string) => Promise<any>;
        getTablePendingDebts: (tableNumber: string) => Promise<any>;
        getCustomersPendingDebts: (customerIds: string[]) => Promise<any>;
    };
    users: {
        list: (filters?: any) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        getByUsername: (username: string) => Promise<any>;
        getByEmail: (email: string) => Promise<any>;
        resetPassword: (id: string, newPasswordHash: string) => Promise<any>;
        delete: (id: string) => Promise<any>;
        hashPassword: (password: string) => Promise<any>;
    };
    inventory: {
        list: (filters: any) => Promise<any>;
        update: (productId: string, branchId: string, quantity: number, reason: string) => Promise<any>;
        registerLoss: (productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) => Promise<any>;
        registerBreakage: (productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) => Promise<any>;
        manualAdjustment: (productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) => Promise<any>;
        calculateConsumption: (productId: string, branchId: string) => Promise<any>;
        getMovements: (filters: any) => Promise<any>;
        validateConsistency: (productId: string, branchId: string) => Promise<any>;
    };
    cashBox: {
        open: (data: any) => Promise<any>;
        close: (cashBoxId: string, closingData: any) => Promise<any>;
        getCurrent: () => Promise<any>;
        getHistory: (filters?: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        updateTotals: (cashBoxId: string, saleTotal: number, paymentMethod: string) => Promise<any>;
    };
    tables: {
        create: (data: any) => Promise<any>;
        list: (filters?: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        getOverview: (branchId: string) => Promise<any>;
    };
    tableSessions: {
        open: (data: any) => Promise<any>;
        close: (data: any) => Promise<any>;
        getById: (id: string) => Promise<any>;
        list: (filters?: any) => Promise<any>;
        transfer: (data: any) => Promise<any>;
        transferCustomers: (data: any) => Promise<any>;
        merge: (data: any) => Promise<any>;
        split: (data: any) => Promise<any>;
        getActions: (sessionId: string) => Promise<any>;
    };
    tableCustomers: {
        add: (data: any) => Promise<any>;
    };
    tableOrders: {
        add: (data: any) => Promise<any>;
        cancel: (data: any) => Promise<any>;
        transfer: (data: any) => Promise<any>;
        split: (data: any) => Promise<any>;
    };
    tablePayments: {
        processCustomer: (data: any) => Promise<any>;
        processSession: (data: any) => Promise<any>;
        clearPaidOrders: (data: any) => Promise<any>;
    };
    database: {
        fixUnitCost: () => Promise<any>;
    };
    sync: {
        start: () => Promise<any>;
        stop: () => Promise<any>;
        status: () => Promise<any>;
        forcePush: () => Promise<any>;
        pushFullInitialSync: () => Promise<any>;
        checkConnection: () => Promise<any>;
        tryReauthenticate: () => Promise<any>;
        queueFullResync: () => Promise<any>;
        getQueueStats: () => Promise<any>;
        onSyncStart: (callback: () => void) => () => Electron.IpcRenderer;
        onSyncProgress: (callback: (data: any) => void) => () => Electron.IpcRenderer;
        onSyncComplete: (callback: (data: any) => void) => () => Electron.IpcRenderer;
        onSyncError: (callback: (error: string) => void) => () => Electron.IpcRenderer;
        onReauthenticated: (callback: (data: any) => void) => () => Electron.IpcRenderer;
        getConnectionStatus: () => Promise<any>;
        fullPullFromServer: () => Promise<any>;
        startConnectionMonitor: () => Promise<any>;
        stopConnectionMonitor: () => Promise<any>;
        getDetailedStatus: () => Promise<any>;
        getDeviceId: () => Promise<any>;
        getAuditLog: (options?: {
            limit?: number;
            entity?: string;
            status?: string;
        }) => Promise<any>;
        getConflicts: () => Promise<any>;
        resolveConflict: (conflictId: string, resolution: "keep_local" | "keep_server" | "merge") => Promise<any>;
        getActiveDevices: () => Promise<any>;
        getAllDevices: () => Promise<any>;
        updateHeartbeat: () => Promise<any>;
        onConflict: (callback: (data: {
            entity: string;
            entityId: string;
            localTimestamp: Date;
            serverTimestamp: Date;
        }) => void) => () => Electron.IpcRenderer;
        onConnectionChange: (callback: (data: {
            isOnline: boolean;
        }) => void) => () => Electron.IpcRenderer;
    };
    settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
        getAll: () => Promise<any>;
    };
    backup: {
        create: () => Promise<any>;
        restore: (filePath: string) => Promise<any>;
    };
    reports: {
        sales: (startDate: string, endDate: string, branchId?: string) => Promise<any>;
        purchases: (startDate: string, endDate: string, branchId?: string) => Promise<any>;
        inventory: (branchId?: string) => Promise<any>;
        customers: (branchId?: string) => Promise<any>;
        debts: (branchId?: string) => Promise<any>;
        saveFile: (filePath: string, content: any, type: string) => Promise<any>;
    };
    dialog: {
        selectDirectory: () => Promise<any>;
    };
    printer: {
        print: (type: string, data: any) => Promise<any>;
    };
};
export type ElectronAPI = typeof api;
export {};
//# sourceMappingURL=preload.d.ts.map