import { DatabaseManager } from '../database/manager';
export declare class SyncManager {
    private dbManager;
    private apiUrl;
    private apiClient;
    private syncInterval;
    private isRunning;
    private token;
    constructor(dbManager: DatabaseManager, apiUrl: string);
    login(credentials: {
        email: string;
        password: string;
    }): Promise<any>;
    logout(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    syncNow(): Promise<void>;
    private pushLocalChanges;
    private pullServerChanges;
    private getEndpoint;
    forcePush(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        pendingItems: number;
        lastSync: Date;
    };
}
//# sourceMappingURL=manager.d.ts.map