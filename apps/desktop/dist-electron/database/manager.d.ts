interface SessionRow {
    id: string;
    session_number?: string;
    status?: string;
    table_id?: string;
    branch_id?: string;
    customer_count?: number;
    total_amount?: number;
    paid_amount?: number;
    opened_at?: string;
    [key: string]: any;
}
interface CustomerRow {
    id: string;
    session_id?: string;
    order_sequence?: number;
    total?: number;
    orders?: any[];
    [key: string]: any;
}
interface OrderRow {
    id: string;
    session_id?: string;
    table_customer_id?: string;
    product_id?: string;
    qty_units?: number;
    is_muntu?: number;
    unit_price?: number;
    unit_cost?: number;
    status?: string;
    [key: string]: any;
}
export declare class DatabaseManager {
    private dbPath;
    private db;
    constructor(dbPath: string);
    initialize(): Promise<void>;
    isAvailable(): boolean;
    private createTables;
    private runMigrations;
    createSale(data: any, skipSyncQueue?: boolean): {
        items: any;
        payments: any;
    } | null;
    addSaleItem(saleId: string, itemData: any): any;
    addSalePayment(saleId: string, paymentData: any): any;
    getSales(filters?: any): any;
    getSaleById(id: string): {
        items: any;
        payments: any;
    } | null;
    getProducts(filters?: any): any;
    searchProducts(query: string): any;
    createProduct(productData: any, skipSyncQueue?: boolean): any;
    updateProduct(id: string, productData: any, skipSyncQueue?: boolean): any;
    getProductById(id: string): any;
    getCategories(filters?: any): any;
    createCategory(categoryData: any, skipSyncQueue?: boolean): any;
    updateCategory(id: string, categoryData: any, skipSyncQueue?: boolean): any;
    deleteCategory(id: string): {
        success: boolean;
    };
    getSuppliers(): any;
    createSupplier(supplierData: any, skipSyncQueue?: boolean): any;
    updateSupplier(id: string, supplierData: any, skipSyncQueue?: boolean): any;
    deleteSupplier(id: string): {
        success: boolean;
    };
    getPurchases(filters?: any): any;
    getPurchaseById(id: string): any;
    createPurchase(purchaseData: any): {
        id: string;
        purchaseNumber: string;
    };
    addPurchaseItem(purchaseId: string, itemData: any): any;
    completePurchase(purchaseId: string, receivedBy: string): {
        success: boolean;
    };
    private updatePurchaseTotals;
    private generatePurchaseNumber;
    getInventory(filters?: any): any;
    updateInventory(productId: string, branchId: string, quantity: number, reason: string): void;
    private addInventory;
    /**
     * Buscar item de inventário por ID do produto
     * Usado principalmente pela sincronização para atualizar estoque
     */
    getInventoryItemByProductId(productId: string, branchId?: string): any;
    /**
     * Atualizar item de inventário diretamente
     * Usado pela sincronização para atualizar estoque do servidor
     */
    updateInventoryItemByProductId(productId: string, data: {
        qtyUnits: number;
        closedBoxes?: number;
        openBoxUnits?: number;
    }, skipSyncQueue?: boolean): boolean;
    /**
     * Criar item de inventário para sincronização
     * Usado quando o servidor tem um item que não existe localmente
     */
    createInventoryItemFromSync(productId: string, branchId: string, data: {
        qtyUnits: number;
        closedBoxes?: number;
        openBoxUnits?: number;
    }): string;
    /**
     * Abre uma caixa automaticamente quando necessário
     * Reduz closed_boxes em 1 e adiciona units_per_box em open_box_units
     */
    private openBoxAutomatically;
    /**
     * Dedução inteligente de estoque com abertura automática de caixas
     * Prioridade: open_box_units → abre caixa automaticamente → closed_boxes
     */
    private deductInventoryAdvanced;
    /**
     * Registrar movimento de estoque (auditoria)
     */
    private registerStockMovement;
    /**
     * Registrar perda de produto
     */
    registerLoss(productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string): {
        success: boolean;
        quantityLost: number;
    };
    /**
     * Registrar quebra de produto
     */
    registerBreakage(productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string): {
        success: boolean;
        quantityBroken: number;
    };
    /**
     * Ajuste manual de estoque com log obrigatório
     */
    manualAdjustment(productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string): {
        success: boolean;
        adjusted: number;
    };
    /**
     * Calcular consumo médio e previsões
     */
    calculateConsumptionAndForecast(productId: string, branchId: string): {
        avg7d: number;
        avg15d: number;
        avg30d: number;
        daysUntilStockout: null;
        suggestedReorder: number;
        currentStock?: undefined;
    } | {
        avg7d: number;
        avg15d: number;
        avg30d: number;
        daysUntilStockout: number | null;
        suggestedReorder: number;
        currentStock: any;
    };
    /**
     * Buscar movimentações de estoque com filtros
     */
    getStockMovements(filters?: any): any;
    /**
     * Validador de consistência de estoque
     */
    validateInventoryConsistency(productId: string, branchId: string): {
        valid: boolean;
        errors: string[];
        autoFixed?: undefined;
        inventory?: undefined;
    } | {
        valid: boolean;
        errors: string[];
        autoFixed: boolean;
        inventory: {
            qty_units: any;
            closed_boxes: any;
            open_box_units: any;
            calculated_total: any;
        };
    };
    private deductInventory;
    private updateSaleTotals;
    getCustomers(filters?: any): any;
    getCustomerById(id: string): any;
    createCustomer(data: any, skipSyncQueue?: boolean): any;
    updateCustomer(id: string, data: any, skipSyncQueue?: boolean): any;
    deleteCustomer(id: string): {
        success: boolean;
    };
    getCustomerPurchaseHistory(customerId: string, filters?: any): any;
    getCustomerStats(customerId: string): any;
    /**
     * Adiciona pontos de fidelidade a um cliente após uma compra
     * Regra: 1 ponto para cada 1.000 FCFA gastos (valores em centavos)
     */
    addLoyaltyPoints(customerId: string, saleAmount: number, saleId: string): {
        pointsAdded: number;
        totalPoints: number;
        previousPoints?: undefined;
        customerName?: undefined;
    } | {
        pointsAdded: number;
        previousPoints: any;
        totalPoints: any;
        customerName: any;
    };
    /**
     * Obtém informações de pontos de fidelidade de um cliente
     */
    getCustomerLoyalty(customerId: string): {
        customerId: any;
        customerCode: any;
        customerName: any;
        points: any;
        tier: string;
        tierColor: string;
        pointsToNextTier: number;
    };
    /**
     * Cria um novo usuário
     */
    createUser(data: {
        username: string;
        email: string;
        fullName: string;
        passwordHash: string;
        password?: string;
        role: string;
        branchId?: string;
        phone?: string;
        allowedTabs?: string[];
    }): {
        username: string;
        email: string;
        fullName: string;
        passwordHash: string;
        password?: string;
        role: string;
        branchId?: string;
        phone?: string;
        allowedTabs?: string[];
        id: string;
    };
    /**
     * Lista todos os usuários
     */
    getUsers(filters?: {
        branchId?: string;
        role?: string;
        search?: string;
        isActive?: boolean;
    }): any;
    /**
     * Busca um usuário por ID
     */
    getUserById(id: string): any;
    /**
     * Busca um usuário por username
     */
    getUserByUsername(username: string): any;
    /**
     * Busca um usuário por email
     */
    getUserByEmail(email: string): any;
    /**
     * Atualiza um usuário
     */
    updateUser(id: string, data: {
        username?: string;
        fullName?: string;
        email?: string;
        role?: string;
        branchId?: string;
        phone?: string;
        isActive?: boolean;
        allowedTabs?: string[];
        password?: string;
    }): any;
    /**
     * Reseta a senha de um usuário
     * @param id - ID do usuário
     * @param newPasswordHash - Hash da nova senha para armazenamento local
     * @param originalPassword - Senha original em texto para sincronização com o backend (opcional)
     */
    resetUserPassword(id: string, newPasswordHash: string, originalPassword?: string): {
        success: boolean;
    };
    /**
     * Atualiza o último login do usuário
     */
    updateUserLastLogin(id: string): void;
    /**
     * Deleta (desativa) um usuário
     */
    deleteUser(id: string): {
        success: boolean;
    };
    /**
     * Retorna todos os usuários que ainda não foram sincronizados com o servidor
     */
    getUnsyncedUsers(): any[];
    /**
     * Retorna estatísticas de sincronização de usuários
     */
    getUserSyncStats(): {
        total: number;
        synced: number;
        pending: number;
        error: number;
    };
    /**
     * Marca usuário como sincronizado com sucesso
     */
    markUserSynced(id: string, serverId?: string): void;
    /**
     * Marca usuário com erro de sincronização
     */
    markUserSyncError(id: string, errorMessage: string): void;
    /**
     * Adiciona usuário pendente à fila de sincronização
     * Usado para re-sincronizar usuários que falharam
     */
    queueUserForSync(userId: string, password?: string): {
        queued: boolean;
        userId: string;
    };
    /**
     * Sincroniza todos os usuários pendentes para a fila
     * NOTA: Sem senha disponível, os usuários não poderão ser criados no backend
     * Este método é útil para reprocessar usuários que falharam
     */
    queueAllPendingUsersForSync(): {
        queued: number;
        skipped: number;
        users: string[];
    };
    /**
     * Cria uma nova dívida para um cliente
     */
    createDebt(data: {
        customerId: string;
        saleId?: string;
        branchId: string;
        amount: number;
        dueDate?: string;
        notes?: string;
        createdBy: string;
    }): {
        customerId: string;
        saleId?: string;
        branchId: string;
        amount: number;
        dueDate?: string;
        notes?: string;
        createdBy: string;
        id: string;
        debtNumber: string;
    };
    /**
     * Lista dívidas com filtros
     */
    getDebts(filters?: {
        customerId?: string;
        status?: string;
        branchId?: string;
        search?: string;
    }): any;
    /**
     * Busca uma dívida por ID
     */
    getDebtById(id: string): any;
    /**
     * Busca vales pendentes de uma mesa específica
     * Retorna um mapa com customer_id => total de vales pendentes
     */
    getTablePendingDebts(tableNumber: string): Map<string, number>;
    /**
     * Busca todos os vales pendentes de clientes específicos com detalhes
     * Retorna array com informações de cada vale incluindo mesa de origem
     */
    getCustomersPendingDebts(customerIds: string[]): Array<{
        customer_id: string;
        debt_id: string;
        balance: number;
        table_number: string | null;
        notes: string;
        created_at: string;
    }>;
    /**
     * Registra um pagamento de dívida (quitação ou parcial)
     */
    payDebt(data: {
        debtId: string;
        amount: number;
        method: string;
        reference?: string;
        notes?: string;
        receivedBy: string;
    }): {
        paymentId: string;
        newBalance: number;
        status: string;
        isPaid: boolean;
    };
    /**
     * Cancela uma dívida (apenas se não tiver pagamentos)
     */
    cancelDebt(debtId: string, reason: string): {
        success: boolean;
    };
    /**
     * Busca estatísticas de dívidas de um cliente
     */
    getCustomerDebtStats(customerId: string): any;
    openCashBox(data: any): any;
    closeCashBox(cashBoxId: string, closingData: any): void;
    getCurrentCashBox(): any;
    getCashBoxHistory(filters?: any): any;
    getCashBoxById(id: string): any;
    calculateCashBoxProfitMetrics(cashBoxId: string, cashBox: any): {
        totalRevenue: number;
        totalCOGS: number;
        grossProfit: number;
        profitMargin: number;
        salesItems: any;
        restockSuggestions: any;
        totalRestockCost: any;
    };
    updateCashBoxTotals(cashBoxId: string, saleTotal: number, paymentMethod: string): void;
    private addToSyncQueue;
    getPendingSyncItems(): any;
    markSyncItemCompleted(id: string): void;
    markSyncItemFailed(id: string, error: string): void;
    /**
     * Marca itens falhados como pendentes para re-tentativa
     * Útil após sincronizar dependências (ex: clientes antes de vendas)
     */
    retryFailedSyncItems(maxRetries?: number): any;
    /**
     * Obtém contagem de itens falhados por entidade
     */
    getFailedSyncStats(): any;
    getSalesReport(startDate: Date, endDate: Date, branchId?: string): any;
    getInventoryReport(branchId?: string): any;
    /**
     * Criar/Cadastrar mesas
     */
    createTable(data: {
        branchId: string;
        number: string;
        seats: number;
        area?: string;
    }): any;
    /**
     * Listar mesas
     */
    getTables(filters?: {
        branchId?: string;
        isActive?: boolean;
    }): any;
    /**
     * Buscar mesa por ID
     */
    getTableById(id: string): any;
    /**
     * Atualizar mesa
     */
    updateTable(id: string, data: {
        status?: string;
        seats?: number;
        area?: string;
        isActive?: boolean;
    }): any;
    /**
     * Re-sincronizar todas as mesas não sincronizadas
     * Isso adiciona mesas com synced=0 à fila de sync
     */
    resyncUnsyncedTables(): number;
    /**
     * Re-tentar vendas de mesa que falharam
     * Isso reseta o status das vendas com erro de FK para 'pending'
     */
    retryFailedTableSales(): number;
    /**
     * Abrir uma sessão de mesa
     */
    openTableSession(data: {
        tableId: string;
        branchId: string;
        openedBy: string;
        notes?: string;
    }): SessionRow | null;
    /**
     * Buscar sessão de mesa por ID
     */
    getTableSessionById(id: string): SessionRow | null;
    /**
     * Listar sessões de mesa
     */
    getTableSessions(filters?: {
        branchId?: string;
        status?: string;
        tableId?: string;
    }): SessionRow[];
    /**
     * Adicionar cliente à mesa
     */
    addCustomerToTable(data: {
        sessionId: string;
        customerName: string;
        customerId?: string;
        addedBy: string;
    }): CustomerRow;
    /**
     * Fazer pedido para um cliente da mesa
     */
    addTableOrder(data: {
        sessionId: string;
        tableCustomerId: string;
        productId: string;
        qtyUnits: number;
        isMuntu?: boolean;
        notes?: string;
        orderedBy: string;
    }): OrderRow;
    /**
     * Cancelar pedido de mesa (retorna ao estoque)
     */
    cancelTableOrder(data: {
        orderId: string;
        cancelledBy: string;
        reason?: string;
    }): {
        success: boolean;
        message: string;
    };
    /**
     * Transferir item entre clientes da mesma mesa
     */
    transferTableOrder(data: {
        orderId: string;
        fromCustomerId: string;
        toCustomerId: string;
        qtyUnits?: number;
        transferredBy: string;
    }): {
        success: boolean;
        message: string;
    };
    /**
     * Dividir item entre múltiplos clientes
     */
    splitTableOrder(data: {
        orderId: string;
        splits: Array<{
            customerId: string;
            qtyUnits: number;
        }>;
        splitBy: string;
    }): {
        success: boolean;
        message: string;
    };
    /**
     * Transferir todos os pedidos para outra mesa
     */
    transferTableSession(data: {
        sessionId: string;
        toTableId: string;
        transferredBy: string;
    }): {
        success: boolean;
        message: string;
    };
    /**
     * Transferir clientes específicos para outra mesa
     */
    transferTableCustomers(data: {
        sessionId: string;
        customerIds: string[];
        toTableId: string;
        transferredBy: string;
    }): {
        success: boolean;
        message: string;
        targetSessionId: string;
    };
    /**
     * Unir mesas - consolidar sessões de múltiplas mesas em uma única mesa
     */
    mergeTableSessions(data: {
        sessionIds: string[];
        targetTableId: string;
        mergedBy: string;
    }): {
        success: boolean;
        message: string;
        targetSessionId: string;
        customersTransferred: number;
        ordersTransferred: number;
    };
    /**
     * Separar mesa unida - distribuir clientes entre múltiplas mesas
     */
    splitMergedTable(data: {
        sessionId: string;
        distributions: Array<{
            customerIds: string[];
            tableId: string;
        }>;
        splitBy: string;
    }): {
        success: boolean;
        message: string;
        sessions: {
            tableId: string;
            sessionId: string;
            customerCount: number;
        }[];
    };
    /**
     * Atualizar totais de uma sessão (helper method)
     */
    private updateTableSessionTotals;
    /**
     * Processar pagamento de cliente individual
     * CRIA UMA VENDA COMPLETA NO SISTEMA (como PDV)
     */
    processTableCustomerPayment(data: {
        sessionId: string;
        tableCustomerId: string;
        method: string;
        amount: number;
        referenceNumber?: string;
        processedBy: string;
    }): {
        success: boolean;
        saleId: string;
        saleNumber: string;
        paymentId: string;
        tablePaymentId: string;
        amount: number;
        muntuSavings: number;
    };
    /**
     * Processar pagamento total da mesa
     * CRIA UMA VENDA COMPLETA NO SISTEMA (como PDV)
     */
    processTableSessionPayment(data: {
        sessionId: string;
        method: string;
        amount: number;
        referenceNumber?: string;
        processedBy: string;
    }): {
        success: boolean;
        saleId: string;
        saleNumber: string;
        paymentId: string;
        tablePaymentId: string;
        amount: number;
        muntuSavings: number;
        itemsCount: number;
    };
    /**
     * Limpar pedidos pagos de um cliente
     * Remove pedidos com status 'paid' do histórico da mesa, mantendo apenas pendentes
     */
    clearPaidOrders(data: {
        sessionId: string;
        tableCustomerId: string;
        clearedBy: string;
    }): {
        success: boolean;
        ordersCleared: any;
        totalCleared: any;
        remainingTotal: any;
    };
    /**
     * Fechar sessão de mesa
     */
    closeTableSession(data: {
        sessionId: string;
        closedBy: string;
        notes?: string;
    }): SessionRow | null;
    /**
     * Definir pontos de fidelidade manualmente para um cliente
     */
    setCustomerLoyaltyPoints(customerCode: string, points: number): {
        success: boolean;
        customerName: any;
        customerCode: any;
        previousPoints: any;
        newPoints: number;
        difference: number;
        skipped: boolean;
    } | {
        success: boolean;
        customerName: any;
        customerCode: any;
        previousPoints: any;
        newPoints: number;
        difference: number;
        skipped?: undefined;
    };
    /**
     * Corrigir pontos de fidelidade de um cliente
     * Recalcula baseado no total de vendas (1 ponto = 1.000 FCFA)
     */
    fixCustomerLoyaltyPoints(customerCode: string): {
        success: boolean;
        customerName: any;
        customerCode: any;
        previousPoints: any;
        correctPoints: number;
        difference: number;
        totalSpent: number;
    };
    /**
     * Atualizar totais do cliente
     */
    private updateTableCustomerTotals;
    /**
     * Registrar ação de auditoria
     */
    private logTableAction;
    /**
     * Buscar histórico de ações de uma sessão
     */
    getTableSessionActions(sessionId: string): Record<string, any>[];
    /**
     * Obter resumo de todas as mesas (dashboard)
     */
    getTablesOverview(branchId: string): any;
    /**
     * Cria um backup completo do banco de dados
     */
    createBackup(backupDir: string, backupType?: string, createdBy?: string): Promise<{
        success: boolean;
        filePath?: string;
        fileName?: string;
        fileSize?: number;
        error?: string;
    }>;
    /**
     * Restaura o banco de dados a partir de um backup
     */
    restoreBackup(backupFile: string): Promise<{
        success: boolean;
        error?: string;
        requiresRestart?: boolean;
    }>;
    /**
     * Lista histórico de backups
     */
    getBackupHistory(limit?: number): any[];
    /**
     * Deleta um backup do histórico e opcionalmente o arquivo
     */
    deleteBackup(id: string, deleteFile?: boolean): {
        success: boolean;
        error?: string;
    };
    private seedInitialData;
    /**
     * Corrige unit_cost nos sale_items existentes usando cost_unit dos produtos
     * Esta migration deve ser executada uma vez após atualização do código
     */
    fixUnitCostInSaleItems(): {
        success: boolean;
        recordsBefore: number;
        recordsUpdated: any;
        recordsAfter: number;
    };
    private generateUUID;
    private generateSequentialNumber;
    /**
     * Criar vendas de exemplo para testes de relatórios
     */
    seedSampleSales(): void;
    /**
     * Obtém um valor de configuração genérico
     */
    getSetting(key: string): string | null;
    /**
     * Define um valor de configuração genérico
     */
    setSetting(key: string, value: string): void;
    /**
     * Obtém ou gera um ID único para este dispositivo
     * O ID é persistido e reutilizado em todas as operações
     */
    getDeviceId(): string;
    /**
     * Conta o número de registros em uma tabela
     */
    count(tableName: string): number;
    /**
     * Conta itens pendentes na fila de sincronização para uma entidade específica
     */
    getPendingSyncCount(entity: string): number;
    /**
     * Obtém a última data de sincronização
     */
    getLastSyncDate(): Date | null;
    /**
     * Define a última data de sincronização
     */
    setLastSyncDate(date: Date): void;
    /**
     * Obtém uma filial pelo ID
     */
    getBranchById(id: string): any;
    /**
     * Obtém o ID da primeira filial disponível (útil como default)
     */
    getDefaultBranchId(): string | null;
    /**
     * Cria uma nova filial
     */
    createBranch(data: any): any;
    /**
     * Atualiza uma filial existente
     */
    updateBranch(id: string, data: any): any;
    /**
     * Obtém um fornecedor pelo ID
     */
    getSupplierById(id: string): any;
    /**
     * Obtém uma categoria pelo ID
     */
    getCategoryById(id: string): any;
    /**
     * Atualiza usuário a partir de dados do servidor (sem sobrescrever senha)
     */
    updateUserFromServer(id: string, data: any): any;
    prepare(query: string): any;
    exec(query: string): any;
    /**
     * Adiciona TODAS as entidades locais à fila de sincronização
     * na ordem correta de dependência (entidades base primeiro)
     * Use quando o Railway está vazio e precisa de uma sincronização completa
     */
    queueFullResync(): {
        total: number;
        byEntity: Record<string, number>;
    };
    /**
     * Retorna estatísticas da fila de sincronização
     */
    getSyncQueueStats(): {
        pending: number;
        failed: number;
        completed: number;
        byEntity: any[];
    };
    /**
     * Registra uma entrada no log de auditoria de sync
     */
    logSyncAudit(params: {
        action: string;
        entity: string;
        entityId?: string;
        direction: 'push' | 'pull';
        status: 'success' | 'error' | 'conflict';
        details?: any;
        errorMessage?: string;
    }): string;
    /**
     * Obtém log de auditoria de sync
     */
    getSyncAuditLog(options?: {
        limit?: number;
        entity?: string;
        status?: string;
    }): any[];
    /**
     * Limpa logs antigos de auditoria (mantém últimos 7 dias)
     */
    cleanOldAuditLogs(daysToKeep?: number): any;
    /**
     * Registra um conflito de sincronização
     */
    registerSyncConflict(params: {
        entity: string;
        entityId: string;
        localData: any;
        serverData: any;
        serverDeviceId?: string;
        localTimestamp: Date;
        serverTimestamp: Date;
    }): string;
    /**
     * Obtém conflitos pendentes de resolução
     */
    getPendingConflicts(): any[];
    /**
     * Resolve um conflito
     */
    resolveConflict(conflictId: string, resolution: 'keep_local' | 'keep_server' | 'merge', resolvedBy?: string): void;
    /**
     * Detecta conflito comparando timestamps
     * Retorna true se houver conflito (ambos modificados após último sync)
     */
    detectConflict(entity: string, entityId: string, serverUpdatedAt: Date): {
        hasConflict: boolean;
        localData?: any;
        serverTimestamp: Date;
    };
    /**
     * Atualiza heartbeat do dispositivo atual
     */
    updateDeviceHeartbeat(): void;
    /**
     * Atualiza última sincronização do dispositivo
     */
    updateDeviceLastSync(): void;
    /**
     * Obtém lista de dispositivos ativos (heartbeat nos últimos 5 minutos)
     */
    getActiveDevices(): any[];
    /**
     * Obtém todos os dispositivos registrados
     */
    getAllDevices(): any[];
    /**
     * Marca dispositivos inativos (sem heartbeat por mais de 1 hora)
     */
    markInactiveDevices(): any;
    /**
     * Obtém estatísticas de sync por dispositivo
     */
    getDeviceSyncStats(deviceId?: string): any;
    /**
     * Zera todos os dados do banco local, EXCETO usuários, branches e configurações essenciais
     * @param adminUserId - ID do usuário admin que está executando a operação
     * @returns Resultado da operação com estatísticas
     */
    resetLocalData(adminUserId: string): {
        success: boolean;
        error?: string;
        stats?: Record<string, number>;
        backupPath?: string;
    };
    /**
     * Obtém contagem de registros por tabela para preview do reset
     */
    getDataCountsForReset(): Record<string, number>;
    close(): void;
}
export {};
//# sourceMappingURL=manager.d.ts.map