import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ResetDataResult {
  success: boolean;
  error?: string;
  stats?: Record<string, number>;
  timestamp?: string;
  executedBy?: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Zera todos os dados do servidor Railway, EXCETO usuários, branches e sessions de auth
   * @param adminUserId - ID do usuário admin executando a operação
   * @param adminRole - Role do usuário (deve ser 'admin' ou 'owner')
   */
  async resetServerData(adminUserId: string, adminRole: string): Promise<ResetDataResult> {
    // Verificar permissão
    if (!['admin', 'owner'].includes(adminRole)) {
      throw new ForbiddenException('Apenas administradores podem executar reset de dados');
    }

    this.logger.warn(`🗑️ INICIANDO RESET DE DADOS DO SERVIDOR`);
    this.logger.warn(`   Executado por: ${adminUserId} (${adminRole})`);
    this.logger.warn(`   Data/Hora: ${new Date().toISOString()}`);

    const stats: Record<string, number> = {};

    try {
      // Executar dentro de uma transação Prisma
      await this.prisma.$transaction(async (tx) => {
        // ============================================================
        // ORDEM DE DELEÇÃO (respeitando FKs - filhos antes de pais)
        // 
        // Cadeia principal de vendas/dívidas/pagamentos:
        // DebtPayment -> Payment, Debt
        // Payment -> Sale, Debt
        // Debt -> Sale, Customer
        // SaleItem -> Sale
        // Sale -> Customer, Table
        //
        // Outras dependências:
        // StockMovement -> Product, Sale, Purchase
        // InventoryMovement -> InventoryItem
        // InventoryItem -> Product
        // TableOrder -> Product, TableCustomer, TableSession
        // TablePayment -> TableSession, TableCustomer, Payment
        // TableAction -> TableSession
        // TableCustomer -> TableSession, Customer
        // TableSession -> Table
        // ProductPriceHistory -> Product
        // Feedback -> Customer, Sale
        // LoyaltyTransaction -> Customer
        // ============================================================

        // Nível 0: Tabelas de ação/pagamento de mesa
        const tablePayments = await tx.tablePayment.deleteMany({});
        stats['table_payments'] = tablePayments.count;
        this.logger.log(`   Deletados: ${tablePayments.count} table_payments`);

        const tableActions = await tx.tableAction.deleteMany({});
        stats['table_actions'] = tableActions.count;
        this.logger.log(`   Deletados: ${tableActions.count} table_actions`);

        // Nível 1: DebtPayment (depende de Debt e Payment)
        const debtPayments = await tx.debtPayment.deleteMany({});
        stats['debt_payments'] = debtPayments.count;
        this.logger.log(`   Deletados: ${debtPayments.count} debt_payments`);

        // Nível 2: Payment (depende de Sale e Debt)
        const payments = await tx.payment.deleteMany({});
        stats['payments'] = payments.count;
        this.logger.log(`   Deletados: ${payments.count} payments`);

        // Nível 3: Debt (depende de Sale e Customer)
        const debts = await tx.debt.deleteMany({});
        stats['debts'] = debts.count;
        this.logger.log(`   Deletados: ${debts.count} debts`);

        // Nível 4: SaleItem (depende de Sale)
        const saleItems = await tx.saleItem.deleteMany({});
        stats['sale_items'] = saleItems.count;
        this.logger.log(`   Deletados: ${saleItems.count} sale_items`);

        // Nível 5: Sale (depende de Customer e Table)
        const sales = await tx.sale.deleteMany({});
        stats['sales'] = sales.count;
        this.logger.log(`   Deletados: ${sales.count} sales`);

        // Nível 6: LoyaltyTransaction (depende de Customer)
        const loyaltyTransactions = await tx.loyaltyTransaction.deleteMany({});
        stats['loyalty_transactions'] = loyaltyTransactions.count;
        this.logger.log(`   Deletados: ${loyaltyTransactions.count} loyalty_transactions`);

        // Nível 7: PurchaseItem e Purchase
        const purchaseItems = await tx.purchaseItem.deleteMany({});
        stats['purchase_items'] = purchaseItems.count;
        this.logger.log(`   Deletados: ${purchaseItems.count} purchase_items`);

        const purchases = await tx.purchase.deleteMany({});
        stats['purchases'] = purchases.count;
        this.logger.log(`   Deletados: ${purchases.count} purchases`);

        // Nível 8: CashBox
        const cashBoxes = await tx.cashBox.deleteMany({});
        stats['cash_boxes'] = cashBoxes.count;
        this.logger.log(`   Deletados: ${cashBoxes.count} cash_boxes`);

        // Nível 9: StockMovement (depende de Product, Sale, Purchase)
        const stockMovements = await tx.stockMovement.deleteMany({});
        stats['stock_movements'] = stockMovements.count;
        this.logger.log(`   Deletados: ${stockMovements.count} stock_movements`);

        // Nível 10: InventoryMovement (depende de InventoryItem)
        const inventoryMovements = await tx.inventoryMovement.deleteMany({});
        stats['inventory_movements'] = inventoryMovements.count;
        this.logger.log(`   Deletados: ${inventoryMovements.count} inventory_movements`);

        // Nível 11: InventoryItem (depende de Product) ⚠️ ESTA ERA A FALTANTE!
        const inventoryItems = await tx.inventoryItem.deleteMany({});
        stats['inventory_items'] = inventoryItems.count;
        this.logger.log(`   Deletados: ${inventoryItems.count} inventory_items`);

        // Nível 12: Inventory (depende de Product)
        const inventory = await tx.inventory.deleteMany({});
        stats['inventory'] = inventory.count;
        this.logger.log(`   Deletados: ${inventory.count} inventory`);

        // Nível 13: TableOrder (depende de Product, TableCustomer, TableSession)
        const tableOrders = await tx.tableOrder.deleteMany({});
        stats['table_orders'] = tableOrders.count;
        this.logger.log(`   Deletados: ${tableOrders.count} table_orders`);

        // Nível 14: ProductPriceHistory (depende de Product)
        const productPriceHistory = await tx.productPriceHistory.deleteMany({});
        stats['product_price_history'] = productPriceHistory.count;
        this.logger.log(`   Deletados: ${productPriceHistory.count} product_price_history`);

        // Nível 15: Feedback (depende de Customer, Sale)
        const feedbacks = await tx.feedback.deleteMany({});
        stats['feedbacks'] = feedbacks.count;
        this.logger.log(`   Deletados: ${feedbacks.count} feedbacks`);

        // Nível 16: TableCustomer (depende de TableSession e Customer)
        const tableCustomers = await tx.tableCustomer.deleteMany({});
        stats['table_customers'] = tableCustomers.count;
        this.logger.log(`   Deletados: ${tableCustomers.count} table_customers`);

        // Nível 17: TableSession (depende de Table)
        const tableSessions = await tx.tableSession.deleteMany({});
        stats['table_sessions'] = tableSessions.count;
        this.logger.log(`   Deletados: ${tableSessions.count} table_sessions`);

        // Nível 18: Table (depende de Branch)
        const tables = await tx.table.deleteMany({});
        stats['tables'] = tables.count;
        this.logger.log(`   Deletados: ${tables.count} tables`);

        // Nível 19: Product (tabela raiz)
        const products = await tx.product.deleteMany({});
        stats['products'] = products.count;
        this.logger.log(`   Deletados: ${products.count} products`);

        // Nível 20: Category, Supplier, Customer (tabelas raiz)
        const categories = await tx.category.deleteMany({});
        stats['categories'] = categories.count;
        this.logger.log(`   Deletados: ${categories.count} categories`);

        const suppliers = await tx.supplier.deleteMany({});
        stats['suppliers'] = suppliers.count;
        this.logger.log(`   Deletados: ${suppliers.count} suppliers`);

        const customers = await tx.customer.deleteMany({});
        stats['customers'] = customers.count;
        this.logger.log(`   Deletados: ${customers.count} customers`);

        // NOTA: NÃO deletar:
        // - users
        // - branches  
        // - sessions (auth)
        // - settings (configurações globais)
      }, {
        timeout: 120000, // 2 minutos para operação grande
      });

      this.logger.warn(`✅ RESET DE DADOS DO SERVIDOR CONCLUÍDO!`);
      this.logger.warn(`📊 Total de registros deletados: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);

      return {
        success: true,
        stats,
        timestamp: new Date().toISOString(),
        executedBy: adminUserId,
      };

    } catch (error: any) {
      this.logger.error(`❌ ERRO NO RESET DE DADOS DO SERVIDOR: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        executedBy: adminUserId,
      };
    }
  }

  /**
   * Obtém contagem de registros para preview do reset
   */
  async getDataCountsForReset(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    // Tabelas operacionais que serão deletadas
    counts['sales'] = await this.prisma.sale.count();
    counts['sale_items'] = await this.prisma.saleItem.count();
    counts['payments'] = await this.prisma.payment.count();
    counts['debts'] = await this.prisma.debt.count();
    counts['debt_payments'] = await this.prisma.debtPayment.count();
    counts['purchases'] = await this.prisma.purchase.count();
    counts['purchase_items'] = await this.prisma.purchaseItem.count();
    counts['products'] = await this.prisma.product.count();
    counts['categories'] = await this.prisma.category.count();
    counts['suppliers'] = await this.prisma.supplier.count();
    counts['customers'] = await this.prisma.customer.count();
    counts['loyalty_transactions'] = await this.prisma.loyaltyTransaction.count();
    counts['inventory'] = await this.prisma.inventory.count();
    counts['inventory_items'] = await this.prisma.inventoryItem.count();
    counts['inventory_movements'] = await this.prisma.inventoryMovement.count();
    counts['stock_movements'] = await this.prisma.stockMovement.count();
    counts['product_price_history'] = await this.prisma.productPriceHistory.count();
    counts['tables'] = await this.prisma.table.count();
    counts['table_sessions'] = await this.prisma.tableSession.count();
    counts['table_customers'] = await this.prisma.tableCustomer.count();
    counts['table_orders'] = await this.prisma.tableOrder.count();
    counts['table_payments'] = await this.prisma.tablePayment.count();
    counts['table_actions'] = await this.prisma.tableAction.count();
    counts['cash_boxes'] = await this.prisma.cashBox.count();
    counts['feedbacks'] = await this.prisma.feedback.count();

    // Dados preservados
    counts['_preserved_users'] = await this.prisma.user.count();
    counts['_preserved_branches'] = await this.prisma.branch.count();

    return counts;
  }

  // ============================================================
  // COMANDOS REMOTOS PARA MOBILE
  // ============================================================

  /**
   * Cria um comando de reset para o mobile
   * O mobile irá verificar comandos pendentes durante o sync
   */
  async createMobileResetCommand(
    createdBy: string,
    targetDeviceId: string,
  ): Promise<{ success: boolean; message: string; commandId?: string }> {
    try {
      const commandId = `reset-mobile-${Date.now()}`;
      const command = {
        id: commandId,
        type: 'RESET_LOCAL_DATA',
        targetDeviceId,
        createdBy,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      // Salvar na tabela settings como JSON
      await this.prisma.setting.upsert({
        where: { key: 'pending_mobile_commands' },
        create: {
          key: 'pending_mobile_commands',
          value: JSON.stringify([command]),
        },
        update: {
          value: JSON.stringify([
            ...await this.getExistingCommands(),
            command,
          ]),
        },
      });

      this.logger.warn(`📱 Comando de reset mobile criado: ${commandId}`);
      this.logger.warn(`   Target: ${targetDeviceId}`);
      this.logger.warn(`   Criado por: ${createdBy}`);

      return {
        success: true,
        message: 'Comando de reset criado. O app mobile executará na próxima sincronização.',
        commandId,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao criar comando de reset mobile: ${error.message}`);
      return {
        success: false,
        message: `Erro ao criar comando: ${error.message}`,
      };
    }
  }

  /**
   * Obtém comandos pendentes para um dispositivo
   */
  async getPendingMobileCommands(
    deviceId: string,
  ): Promise<{ commands: Array<{ id: string; type: string; createdAt: string; createdBy: string }> }> {
    try {
      const commands = await this.getExistingCommands();
      
      // Filtrar comandos pendentes para este dispositivo ou 'all'
      const pendingCommands = commands.filter(cmd => 
        cmd.status === 'pending' && 
        (cmd.targetDeviceId === deviceId || cmd.targetDeviceId === 'all')
      );

      return {
        commands: pendingCommands.map(cmd => ({
          id: cmd.id,
          type: cmd.type,
          createdAt: cmd.createdAt,
          createdBy: cmd.createdBy,
        })),
      };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao buscar comandos pendentes: ${error.message}`);
      return { commands: [] };
    }
  }

  /**
   * Confirma que um comando foi executado
   */
  async acknowledgeCommand(
    commandId: string,
    success: boolean,
    stats?: Record<string, number>,
  ): Promise<{ success: boolean }> {
    try {
      const commands = await this.getExistingCommands();
      
      const updatedCommands = commands.map(cmd => {
        if (cmd.id === commandId) {
          return {
            ...cmd,
            status: success ? 'completed' : 'failed',
            executedAt: new Date().toISOString(),
            stats,
          };
        }
        return cmd;
      });

      await this.prisma.setting.upsert({
        where: { key: 'pending_mobile_commands' },
        create: {
          key: 'pending_mobile_commands',
          value: JSON.stringify(updatedCommands),
        },
        update: {
          value: JSON.stringify(updatedCommands),
        },
      });

      this.logger.log(`✅ Comando ${commandId} confirmado: ${success ? 'sucesso' : 'falha'}`);
      if (stats) {
        this.logger.log(`   Stats: ${JSON.stringify(stats)}`);
      }

      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao confirmar comando: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Obtém comandos existentes do banco
   */
  private async getExistingCommands(): Promise<any[]> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'pending_mobile_commands' },
      });
      
      if (!setting) return [];
      
      const commands = JSON.parse(setting.value);
      
      // Limpar comandos com mais de 24 horas
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return commands.filter((cmd: any) => 
        new Date(cmd.createdAt).getTime() > oneDayAgo
      );
    } catch {
      return [];
    }
  }
}
