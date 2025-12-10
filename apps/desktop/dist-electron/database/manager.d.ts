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
    private createTables;
    private runMigrations;
    createSale(data: any): {
        items: unknown[];
        payments: unknown[];
    } | null;
    addSaleItem(saleId: string, itemData: any): any;
    addSalePayment(saleId: string, paymentData: any): any;
    getSales(filters?: any): unknown[];
    getSaleById(id: string): {
        items: unknown[];
        payments: unknown[];
    } | null;
    getProducts(filters?: any): unknown[];
    searchProducts(query: string): unknown[];
    createProduct(productData: any, skipSyncQueue?: boolean): any;
    updateProduct(id: string, productData: any, skipSyncQueue?: boolean): any;
    getProductById(id: string): unknown;
    getCategories(filters?: any): unknown[];
    createCategory(categoryData: any, skipSyncQueue?: boolean): any;
    updateCategory(id: string, categoryData: any, skipSyncQueue?: boolean): any;
    deleteCategory(id: string): {
        success: boolean;
    };
    getSuppliers(): unknown[];
    createSupplier(supplierData: any, skipSyncQueue?: boolean): any;
    updateSupplier(id: string, supplierData: any, skipSyncQueue?: boolean): unknown;
    deleteSupplier(id: string): {
        success: boolean;
    };
    getPurchases(filters?: any): unknown[];
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
    getInventory(filters?: any): unknown[];
    updateInventory(productId: string, branchId: string, quantity: number, reason: string): void;
    private addInventory;
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
    getStockMovements(filters?: any): unknown[];
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
    getCustomers(filters?: any): unknown[];
    getCustomerById(id: string): unknown;
    createCustomer(data: any, skipSyncQueue?: boolean): unknown;
    updateCustomer(id: string, data: any, skipSyncQueue?: boolean): unknown;
    deleteCustomer(id: string): {
        success: boolean;
    };
    getCustomerPurchaseHistory(customerId: string, filters?: any): unknown[];
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
        role: string;
        branchId?: string;
        phone?: string;
    }): {
        username: string;
        email: string;
        fullName: string;
        passwordHash: string;
        role: string;
        branchId?: string;
        phone?: string;
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
    }): unknown[];
    /**
     * Busca um usuário por ID
     */
    getUserById(id: string): unknown;
    /**
     * Busca um usuário por username
     */
    getUserByUsername(username: string): unknown;
    /**
     * Busca um usuário por email
     */
    getUserByEmail(email: string): unknown;
    /**
     * Atualiza um usuário
     */
    updateUser(id: string, data: {
        fullName?: string;
        email?: string;
        role?: string;
        branchId?: string;
        phone?: string;
        isActive?: boolean;
    }): unknown;
    /**
     * Reseta a senha de um usuário
     */
    resetUserPassword(id: string, newPasswordHash: string): {
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
    }): unknown[];
    /**
     * Busca uma dívida por ID
     */
    getDebtById(id: string): {
        payments: unknown[];
    } | null;
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
    getCurrentCashBox(): unknown;
    getCashBoxHistory(filters?: any): unknown[];
    getCashBoxById(id: string): any;
    calculateCashBoxProfitMetrics(cashBoxId: string, cashBox: any): {
        totalRevenue: number;
        totalCOGS: number;
        grossProfit: number;
        profitMargin: number;
        salesItems: {
            productId: any;
            productName: any;
            qtySold: any;
            revenue: any;
            cost: any;
            profit: number;
            margin: number;
        }[];
        restockSuggestions: {
            productId: any;
            productName: any;
            sku: any;
            currentStock: any;
            qtySoldInPeriod: any;
            suggestedRestockQty: number;
            restockCost: number;
            unitsPerBox: any;
            suggestedBoxes: number;
        }[];
        totalRestockCost: number;
    };
    updateCashBoxTotals(cashBoxId: string, saleTotal: number, paymentMethod: string): void;
    private addToSyncQueue;
    getPendingSyncItems(): unknown[];
    markSyncItemCompleted(id: string): void;
    markSyncItemFailed(id: string, error: string): void;
    /**
     * Marca itens falhados como pendentes para re-tentativa
     * Útil após sincronizar dependências (ex: clientes antes de vendas)
     */
    retryFailedSyncItems(maxRetries?: number): number;
    /**
     * Obtém contagem de itens falhados por entidade
     */
    getFailedSyncStats(): unknown[];
    getSalesReport(startDate: Date, endDate: Date, branchId?: string): unknown[];
    getInventoryReport(branchId?: string): unknown[];
    /**
     * Criar/Cadastrar mesas
     */
    createTable(data: {
        branchId: string;
        number: string;
        seats: number;
        area?: string;
    }): unknown;
    /**
     * Listar mesas
     */
    getTables(filters?: {
        branchId?: string;
        isActive?: boolean;
    }): unknown[];
    /**
     * Buscar mesa por ID
     */
    getTableById(id: string): unknown;
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
    getTablesOverview(branchId: string): any[];
    createBackup(backupDir: string): string;
    restoreBackup(backupFile: string): {
        success: boolean;
    };
    private seedInitialData;
    /**
     * Corrige unit_cost nos sale_items existentes usando cost_unit dos produtos
     * Esta migration deve ser executada uma vez após atualização do código
     */
    fixUnitCostInSaleItems(): {
        success: boolean;
        recordsBefore: number;
        recordsUpdated: number;
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
    getBranchById(id: string): unknown;
    /**
     * Cria uma nova filial
     */
    createBranch(data: any): any;
    /**
     * Atualiza uma filial existente
     */
    updateBranch(id: string, data: any): unknown;
    /**
     * Obtém um fornecedor pelo ID
     */
    getSupplierById(id: string): unknown;
    /**
     * Obtém uma categoria pelo ID
     */
    getCategoryById(id: string): unknown;
    /**
     * Atualiza usuário a partir de dados do servidor (sem sobrescrever senha)
     */
    updateUserFromServer(id: string, data: any): unknown;
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
    close(): void;
}
export {};
//# sourceMappingURL=manager.d.ts.map