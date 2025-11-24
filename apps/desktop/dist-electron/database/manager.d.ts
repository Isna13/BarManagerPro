export declare class DatabaseManager {
    private dbPath;
    private db;
    constructor(dbPath: string);
    initialize(): Promise<void>;
    private createTables;
    private runMigrations;
    createSale(data: any): {
        items: unknown[];
        payments: unknown[];
    } | null;
    addSaleItem(saleId: string, itemData: any): any;
    getSales(filters?: any): unknown[];
    getSaleById(id: string): {
        items: unknown[];
        payments: unknown[];
    } | null;
    getProducts(filters?: any): unknown[];
    searchProducts(query: string): unknown[];
    getInventory(filters?: any): unknown[];
    updateInventory(productId: string, quantity: number, reason: string): void;
    private deductInventory;
    private updateSaleTotals;
    openCashBox(data: any): any;
    closeCashBox(cashBoxId: string, closingData: any): void;
    getCurrentCashBox(): unknown;
    private addToSyncQueue;
    getPendingSyncItems(): unknown[];
    markSyncItemCompleted(id: string): void;
    markSyncItemFailed(id: string, error: string): void;
    getSalesReport(startDate: Date, endDate: Date, branchId?: string): unknown[];
    getInventoryReport(branchId?: string): unknown[];
    createBackup(backupDir: string): string;
    restoreBackup(backupFile: string): {
        success: boolean;
    };
    private generateUUID;
    close(): void;
}
//# sourceMappingURL=manager.d.ts.map