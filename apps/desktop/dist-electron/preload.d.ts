declare const api: {
    auth: {
        login: (credentials: any) => Promise<any>;
        logout: () => Promise<any>;
    };
    sales: {
        create: (data: any) => Promise<any>;
        addItem: (saleId: string, itemData: any) => Promise<any>;
        list: (filters: any) => Promise<any>;
        getById: (saleId: string) => Promise<any>;
    };
    products: {
        list: (filters: any) => Promise<any>;
        search: (query: string) => Promise<any>;
    };
    inventory: {
        list: (filters: any) => Promise<any>;
        update: (productId: string, quantity: number, reason: string) => Promise<any>;
    };
    cashBox: {
        open: (data: any) => Promise<any>;
        close: (cashBoxId: string, closingData: any) => Promise<any>;
        getCurrent: () => Promise<any>;
    };
    sync: {
        start: () => Promise<any>;
        stop: () => Promise<any>;
        status: () => Promise<any>;
        forcePush: () => Promise<any>;
        onSyncStart: (callback: () => void) => () => Electron.IpcRenderer;
        onSyncComplete: (callback: (data: any) => void) => () => Electron.IpcRenderer;
        onSyncError: (callback: (error: string) => void) => () => Electron.IpcRenderer;
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
        sales: (startDate: Date, endDate: Date, branchId?: string) => Promise<any>;
        inventory: (branchId?: string) => Promise<any>;
    };
    printer: {
        print: (type: string, data: any) => Promise<any>;
    };
};
export type ElectronAPI = typeof api;
export {};
//# sourceMappingURL=preload.d.ts.map