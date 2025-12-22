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
        // Ordem de deleção respeitando foreign keys (de dependentes para principais)

        // 1. Pagamentos de vendas
        const payments = await tx.payment.deleteMany({});
        stats['payments'] = payments.count;
        this.logger.log(`   Deletados: ${payments.count} payments`);

        // 2. Itens de vendas
        const saleItems = await tx.saleItem.deleteMany({});
        stats['sale_items'] = saleItems.count;
        this.logger.log(`   Deletados: ${saleItems.count} sale_items`);

        // 3. Vendas
        const sales = await tx.sale.deleteMany({});
        stats['sales'] = sales.count;
        this.logger.log(`   Deletados: ${sales.count} sales`);

        // 4. Pagamentos de dívidas
        const debtPayments = await tx.debtPayment.deleteMany({});
        stats['debt_payments'] = debtPayments.count;
        this.logger.log(`   Deletados: ${debtPayments.count} debt_payments`);

        // 5. Dívidas
        const debts = await tx.debt.deleteMany({});
        stats['debts'] = debts.count;
        this.logger.log(`   Deletados: ${debts.count} debts`);

        // 6. Itens de compras
        const purchaseItems = await tx.purchaseItem.deleteMany({});
        stats['purchase_items'] = purchaseItems.count;
        this.logger.log(`   Deletados: ${purchaseItems.count} purchase_items`);

        // 7. Compras
        const purchases = await tx.purchase.deleteMany({});
        stats['purchases'] = purchases.count;
        this.logger.log(`   Deletados: ${purchases.count} purchases`);

        // 8. Caixas
        const cashBoxes = await tx.cashBox.deleteMany({});
        stats['cash_boxes'] = cashBoxes.count;
        this.logger.log(`   Deletados: ${cashBoxes.count} cash_boxes`);

        // 9. Movimentações de inventário
        const inventoryMovements = await tx.inventoryMovement.deleteMany({});
        stats['inventory_movements'] = inventoryMovements.count;
        this.logger.log(`   Deletados: ${inventoryMovements.count} inventory_movements`);

        // 10. Inventário
        const inventory = await tx.inventory.deleteMany({});
        stats['inventory'] = inventory.count;
        this.logger.log(`   Deletados: ${inventory.count} inventory`);

        // 11. Pedidos de mesa
        const tableOrders = await tx.tableOrder.deleteMany({});
        stats['table_orders'] = tableOrders.count;
        this.logger.log(`   Deletados: ${tableOrders.count} table_orders`);

        // 12. Clientes de sessão de mesa
        const tableCustomers = await tx.tableCustomer.deleteMany({});
        stats['table_customers'] = tableCustomers.count;
        this.logger.log(`   Deletados: ${tableCustomers.count} table_customers`);

        // 13. Sessões de mesa
        const tableSessions = await tx.tableSession.deleteMany({});
        stats['table_sessions'] = tableSessions.count;
        this.logger.log(`   Deletados: ${tableSessions.count} table_sessions`);

        // 14. Mesas
        const tables = await tx.table.deleteMany({});
        stats['tables'] = tables.count;
        this.logger.log(`   Deletados: ${tables.count} tables`);

        // 15. Transações de fidelidade (loyalty) - ANTES de customers
        const loyaltyTransactions = await tx.loyaltyTransaction.deleteMany({});
        stats['loyalty_transactions'] = loyaltyTransactions.count;
        this.logger.log(`   Deletados: ${loyaltyTransactions.count} loyalty_transactions`);

        // 16. Clientes
        const customers = await tx.customer.deleteMany({});
        stats['customers'] = customers.count;
        this.logger.log(`   Deletados: ${customers.count} customers`);

        // 17. Produtos
        const products = await tx.product.deleteMany({});
        stats['products'] = products.count;
        this.logger.log(`   Deletados: ${products.count} products`);

        // 18. Categorias
        const categories = await tx.category.deleteMany({});
        stats['categories'] = categories.count;
        this.logger.log(`   Deletados: ${categories.count} categories`);

        // 19. Fornecedores
        const suppliers = await tx.supplier.deleteMany({});
        stats['suppliers'] = suppliers.count;
        this.logger.log(`   Deletados: ${suppliers.count} suppliers`);

        // NOTA: NÃO deletar:
        // - users
        // - branches  
        // - sessions (auth)
        // - settings (configurações globais)
      }, {
        timeout: 60000, // 60 segundos para operação grande
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

    counts['sales'] = await this.prisma.sale.count();
    counts['sale_items'] = await this.prisma.saleItem.count();
    counts['payments'] = await this.prisma.payment.count();
    counts['purchases'] = await this.prisma.purchase.count();
    counts['purchase_items'] = await this.prisma.purchaseItem.count();
    counts['products'] = await this.prisma.product.count();
    counts['categories'] = await this.prisma.category.count();
    counts['suppliers'] = await this.prisma.supplier.count();
    counts['customers'] = await this.prisma.customer.count();
    counts['loyalty_transactions'] = await this.prisma.loyaltyTransaction.count();
    counts['debts'] = await this.prisma.debt.count();
    counts['debt_payments'] = await this.prisma.debtPayment.count();
    counts['inventory'] = await this.prisma.inventory.count();
    counts['inventory_movements'] = await this.prisma.inventoryMovement.count();
    counts['tables'] = await this.prisma.table.count();
    counts['table_sessions'] = await this.prisma.tableSession.count();
    counts['cash_boxes'] = await this.prisma.cashBox.count();

    // Dados preservados
    counts['_preserved_users'] = await this.prisma.user.count();
    counts['_preserved_branches'] = await this.prisma.branch.count();

    return counts;
  }
}
