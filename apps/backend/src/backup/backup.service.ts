import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

// Versão do schema de backup
const BACKUP_SCHEMA_VERSION = '2.0';

export interface BackupMetadata {
  version: string;
  schemaVersion: string;
  timestamp: string;
  createdBy: string;
  branchId?: string;
  totalRecords: number;
  entities: Record<string, number>;
}

export interface BackupData {
  metadata: BackupMetadata;
  branches: any[];
  categories: any[];
  suppliers: any[];
  products: any[];
  customers: any[];
  tables: any[];
  tableSessions: any[];
  tableCustomers: any[];
  tableOrders: any[];
  tablePayments: any[];     // 🔴 CORREÇÃO: Adicionado (pagamentos de mesa)
  tableActions: any[];      // 🔴 CORREÇÃO: Adicionado (log de ações de mesa)
  inventory: any[];
  inventoryItems: any[];
  inventoryMovements: any[];
  stockMovements: any[];
  purchases: any[];
  purchaseItems: any[];
  sales: any[];
  saleItems: any[];
  payments: any[];
  cashBoxes: any[];
  debts: any[];
  debtPayments: any[];
  loyaltyTransactions: any[];
  productPriceHistory: any[]; // 🔴 CORREÇÃO: Adicionado (histórico de preços)
  feedback: any[];            // 🔴 CORREÇÃO: Adicionado (feedbacks de clientes)
  settings: any[];
}

export interface RestoreResult {
  success: boolean;
  message: string;
  stats: Record<string, number>;
  errors: string[];
  duration: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private backupDir = path.join(process.cwd(), 'backups');
  private isRestoring = false;
  private isBackingUp = false;

  constructor(private readonly prisma: PrismaService) {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Cria um backup completo do servidor
   */
  async createFullBackup(userId: string, branchId?: string): Promise<{
    filename: string;
    data: BackupData;
    size: number;
    timestamp: string;
  }> {
    if (this.isBackingUp) {
      throw new ConflictException('Um backup já está em andamento');
    }

    this.isBackingUp = true;
    this.logger.log(`📦 Iniciando backup completo - Usuário: ${userId}`);

    try {
      const startTime = Date.now();

      // Exportar todas as entidades
      const [
        branches,
        categories,
        suppliers,
        products,
        customers,
        tables,
        tableSessions,
        tableCustomers,
        tableOrders,
        tablePayments,      // 🔴 CORREÇÃO: Adicionado
        tableActions,       // 🔴 CORREÇÃO: Adicionado
        inventory,
        inventoryItems,
        inventoryMovements,
        stockMovements,
        purchases,
        purchaseItems,
        sales,
        saleItems,
        payments,
        cashBoxes,
        debts,
        debtPayments,
        loyaltyTransactions,
        productPriceHistory, // 🔴 CORREÇÃO: Adicionado
        feedback,            // 🔴 CORREÇÃO: Adicionado
        settings,
      ] = await Promise.all([
        this.prisma.branch.findMany(),
        this.prisma.category.findMany(),
        this.prisma.supplier.findMany(),
        this.prisma.product.findMany(),
        this.prisma.customer.findMany(),
        this.prisma.table.findMany(),
        this.prisma.tableSession.findMany({ include: { customers: true, orders: true } }),
        this.prisma.tableCustomer.findMany(),
        this.prisma.tableOrder.findMany(),
        this.prisma.tablePayment.findMany(),     // 🔴 CORREÇÃO: Adicionado
        this.prisma.tableAction.findMany(),      // 🔴 CORREÇÃO: Adicionado
        this.prisma.inventory.findMany(),
        this.prisma.inventoryItem.findMany(),
        this.prisma.inventoryMovement.findMany(),
        this.prisma.stockMovement.findMany(),
        this.prisma.purchase.findMany({ include: { items: true } }),
        this.prisma.purchaseItem.findMany(),
        this.prisma.sale.findMany({ include: { items: true, payments: true } }),
        this.prisma.saleItem.findMany(),
        this.prisma.payment.findMany(),
        this.prisma.cashBox.findMany(),
        this.prisma.debt.findMany({ include: { payments: true } }),
        this.prisma.debtPayment.findMany(),
        this.prisma.loyaltyTransaction.findMany(),
        this.prisma.productPriceHistory.findMany(), // 🔴 CORREÇÃO: Adicionado
        this.prisma.feedback.findMany(),            // 🔴 CORREÇÃO: Adicionado
        this.prisma.setting.findMany(),
      ]);

      // Calcular totais
      const entities: Record<string, number> = {
        branches: branches.length,
        categories: categories.length,
        suppliers: suppliers.length,
        products: products.length,
        customers: customers.length,
        tables: tables.length,
        tableSessions: tableSessions.length,
        tableCustomers: tableCustomers.length,
        tableOrders: tableOrders.length,
        tablePayments: tablePayments.length,       // 🔴 CORREÇÃO: Adicionado
        tableActions: tableActions.length,         // 🔴 CORREÇÃO: Adicionado
        inventory: inventory.length,
        inventoryItems: inventoryItems.length,
        inventoryMovements: inventoryMovements.length,
        stockMovements: stockMovements.length,
        purchases: purchases.length,
        purchaseItems: purchaseItems.length,
        sales: sales.length,
        saleItems: saleItems.length,
        payments: payments.length,
        cashBoxes: cashBoxes.length,
        debts: debts.length,
        debtPayments: debtPayments.length,
        loyaltyTransactions: loyaltyTransactions.length,
        productPriceHistory: productPriceHistory.length, // 🔴 CORREÇÃO: Adicionado
        feedback: feedback.length,                       // 🔴 CORREÇÃO: Adicionado
        settings: settings.length,
      };

      const totalRecords = Object.values(entities).reduce((a, b) => a + b, 0);

      const timestamp = new Date().toISOString();
      const backupData: BackupData = {
        metadata: {
          version: '2.0',
          schemaVersion: BACKUP_SCHEMA_VERSION,
          timestamp,
          createdBy: userId,
          branchId,
          totalRecords,
          entities,
        },
        branches,
        categories,
        suppliers,
        products,
        customers,
        tables,
        tableSessions,
        tableCustomers,
        tableOrders,
        tablePayments,       // 🔴 CORREÇÃO: Adicionado
        tableActions,        // 🔴 CORREÇÃO: Adicionado
        inventory,
        inventoryItems,
        inventoryMovements,
        stockMovements,
        purchases,
        purchaseItems,
        sales,
        saleItems,
        payments,
        cashBoxes,
        debts,
        debtPayments,
        loyaltyTransactions,
        productPriceHistory, // 🔴 CORREÇÃO: Adicionado
        feedback,            // 🔴 CORREÇÃO: Adicionado
        settings,
      };

      // Salvar arquivo
      const filename = `backup-${timestamp.replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(this.backupDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
      const size = fs.statSync(filepath).size;

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Backup concluído em ${duration}ms - ${totalRecords} registros - ${(size / 1024 / 1024).toFixed(2)}MB`);

      // Log de auditoria
      await this.logBackupAction('CREATE_BACKUP', userId, { filename, totalRecords, size, duration });

      return { filename, data: backupData, size, timestamp };
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Retorna o backup como JSON para download direto (sem salvar no servidor)
   */
  async createBackupForDownload(userId: string): Promise<BackupData> {
    if (this.isBackingUp) {
      throw new ConflictException('Um backup já está em andamento');
    }

    this.isBackingUp = true;
    this.logger.log(`📦 Gerando backup para download - Usuário: ${userId}`);

    try {
      const result = await this.createFullBackup(userId);
      return result.data;
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Restaura um backup completo
   * ATENÇÃO: Esta operação apaga todos os dados (exceto usuários/auth)
   */
  async restoreBackup(
    backupData: BackupData,
    userId: string,
    userRole: string,
  ): Promise<RestoreResult> {
    // Validar permissão
    if (!['admin', 'owner'].includes(userRole)) {
      throw new BadRequestException('Apenas administradores podem restaurar backups');
    }

    // Verificar se já há uma restauração em andamento
    if (this.isRestoring) {
      throw new ConflictException('Uma restauração já está em andamento');
    }

    this.isRestoring = true;
    const startTime = Date.now();
    const errors: string[] = [];
    const stats: Record<string, number> = {};

    this.logger.warn(`🔄 INICIANDO RESTAURAÇÃO DE BACKUP`);
    this.logger.warn(`   Usuário: ${userId} (${userRole})`);
    this.logger.warn(`   Backup de: ${backupData.metadata.timestamp}`);
    this.logger.warn(`   Total de registros: ${backupData.metadata.totalRecords}`);

    try {
      // Validar versão do schema
      if (backupData.metadata.schemaVersion !== BACKUP_SCHEMA_VERSION) {
        this.logger.warn(`⚠️ Versão do schema diferente: ${backupData.metadata.schemaVersion} vs ${BACKUP_SCHEMA_VERSION}`);
      }

      // Executar dentro de uma transação
      await this.prisma.$transaction(async (tx) => {
        // ====== FASE 1: LIMPAR DADOS EXISTENTES ======
        this.logger.log('🗑️ Fase 1: Limpando dados existentes...');

        // ============================================================
        // ORDEM DE DELEÇÃO (FKs - filhos antes de pais):
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
        // ============================================================

        // Nível 0: Tabelas de ação/pagamento de mesa (dependem de TableSession e Payment)
        await tx.tablePayment.deleteMany({});
        await tx.tableAction.deleteMany({});
        
        // Nível 1: DebtPayment (depende de Debt e Payment)
        await tx.debtPayment.deleteMany({});
        
        // Nível 2: Payment (depende de Sale e Debt)
        await tx.payment.deleteMany({});
        
        // Nível 3: Debt (depende de Sale e Customer)
        await tx.debt.deleteMany({});
        
        // Nível 4: SaleItem (depende de Sale)
        await tx.saleItem.deleteMany({});
        
        // Nível 5: Sale (depende de Customer e Table)
        await tx.sale.deleteMany({});
        
        // Nível 6: LoyaltyTransaction (depende de Customer)
        await tx.loyaltyTransaction.deleteMany({});
        
        // Nível 7: PurchaseItem e Purchase
        await tx.purchaseItem.deleteMany({});
        await tx.purchase.deleteMany({});
        
        // Nível 8: CashBox (depende de Branch e User - não deletamos esses)
        await tx.cashBox.deleteMany({});
        
        // Nível 9: StockMovement (depende de Product, Sale, Purchase)
        await tx.stockMovement.deleteMany({});
        
        // Nível 10: InventoryMovement (depende de InventoryItem)
        await tx.inventoryMovement.deleteMany({});
        
        // Nível 11: InventoryItem (depende de Product)
        await tx.inventoryItem.deleteMany({});
        
        // Nível 12: Inventory (depende de Product)
        await tx.inventory.deleteMany({});
        
        // Nível 13: TableOrder (depende de Product, TableCustomer, TableSession)
        await tx.tableOrder.deleteMany({});
        
        // Nível 14: ProductPriceHistory (depende de Product)
        await tx.productPriceHistory.deleteMany({});
        
        // Nível 15: Feedback (depende de Customer, Sale)
        await tx.feedback.deleteMany({});
        
        // Nível 16: TableCustomer (depende de TableSession e Customer)
        await tx.tableCustomer.deleteMany({});
        
        // Nível 17: TableSession (depende de Table)
        await tx.tableSession.deleteMany({});
        
        // Nível 18: Table (depende de Branch)
        await tx.table.deleteMany({});
        
        // Nível 19: Product (tabela raiz)
        await tx.product.deleteMany({});
        
        // Nível 20: Category, Supplier, Customer (tabelas raiz)
        await tx.category.deleteMany({});
        await tx.supplier.deleteMany({});
        await tx.customer.deleteMany({});
        // NÃO deletar: users, branches (manter estrutura), sessions, settings

        this.logger.log('✅ Dados antigos removidos');

        // ====== FASE 2: RESTAURAR DADOS ======
        this.logger.log('📥 Fase 2: Restaurando dados...');

        // 1. Branches (apenas atualizar, não criar novos para evitar conflitos)
        if (backupData.branches?.length > 0) {
          for (const branch of backupData.branches) {
            try {
              await tx.branch.upsert({
                where: { id: branch.id },
                create: branch,
                update: { name: branch.name, code: branch.code, address: branch.address, phone: branch.phone },
              });
            } catch (e: any) {
              errors.push(`Branch ${branch.id}: ${e.message}`);
            }
          }
          stats['branches'] = backupData.branches.length;
        }

        // 2. Categories
        if (backupData.categories?.length > 0) {
          await tx.category.createMany({ data: backupData.categories, skipDuplicates: true });
          stats['categories'] = backupData.categories.length;
        }

        // 3. Suppliers
        if (backupData.suppliers?.length > 0) {
          await tx.supplier.createMany({ data: backupData.suppliers, skipDuplicates: true });
          stats['suppliers'] = backupData.suppliers.length;
        }

        // 4. Products
        if (backupData.products?.length > 0) {
          await tx.product.createMany({ data: backupData.products, skipDuplicates: true });
          stats['products'] = backupData.products.length;
        }

        // 5. Customers
        if (backupData.customers?.length > 0) {
          await tx.customer.createMany({ data: backupData.customers, skipDuplicates: true });
          stats['customers'] = backupData.customers.length;
        }

        // 6. Tables
        if (backupData.tables?.length > 0) {
          await tx.table.createMany({ data: backupData.tables, skipDuplicates: true });
          stats['tables'] = backupData.tables.length;
        }

        // 7. Table Sessions
        if (backupData.tableSessions?.length > 0) {
          // Remover relações aninhadas para createMany
          const sessionsClean = backupData.tableSessions.map(s => {
            const { customers, orders, ...session } = s;
            return session;
          });
          await tx.tableSession.createMany({ data: sessionsClean, skipDuplicates: true });
          stats['tableSessions'] = sessionsClean.length;
        }

        // 8. Table Customers
        if (backupData.tableCustomers?.length > 0) {
          await tx.tableCustomer.createMany({ data: backupData.tableCustomers, skipDuplicates: true });
          stats['tableCustomers'] = backupData.tableCustomers.length;
        }

        // 9. Table Orders
        if (backupData.tableOrders?.length > 0) {
          await tx.tableOrder.createMany({ data: backupData.tableOrders, skipDuplicates: true });
          stats['tableOrders'] = backupData.tableOrders.length;
        }

        // 9.1 Table Payments 🔴 CORREÇÃO: Restaurar pagamentos de mesa
        if (backupData.tablePayments?.length > 0) {
          await tx.tablePayment.createMany({ data: backupData.tablePayments, skipDuplicates: true });
          stats['tablePayments'] = backupData.tablePayments.length;
        }

        // 9.2 Table Actions 🔴 CORREÇÃO: Restaurar log de ações de mesa
        if (backupData.tableActions?.length > 0) {
          await tx.tableAction.createMany({ data: backupData.tableActions, skipDuplicates: true });
          stats['tableActions'] = backupData.tableActions.length;
        }

        // 10. Inventory
        if (backupData.inventory?.length > 0) {
          await tx.inventory.createMany({ data: backupData.inventory, skipDuplicates: true });
          stats['inventory'] = backupData.inventory.length;
        }

        // 10.1 Inventory Items (sem movements aninhados)
        if (backupData.inventoryItems?.length > 0) {
          const itemsClean = backupData.inventoryItems.map(item => {
            const { movements, ...rest } = item;
            return rest;
          });
          await tx.inventoryItem.createMany({ data: itemsClean, skipDuplicates: true });
          stats['inventoryItems'] = itemsClean.length;
        }

        // 11. Inventory Movements
        if (backupData.inventoryMovements?.length > 0) {
          await tx.inventoryMovement.createMany({ data: backupData.inventoryMovements, skipDuplicates: true });
          stats['inventoryMovements'] = backupData.inventoryMovements.length;
        }

        // 11.1 Stock Movements
        if (backupData.stockMovements?.length > 0) {
          await tx.stockMovement.createMany({ data: backupData.stockMovements, skipDuplicates: true });
          stats['stockMovements'] = backupData.stockMovements.length;
        }

        // 12. Purchases (sem items aninhados)
        if (backupData.purchases?.length > 0) {
          const purchasesClean = backupData.purchases.map(p => {
            const { items, ...purchase } = p;
            return purchase;
          });
          await tx.purchase.createMany({ data: purchasesClean, skipDuplicates: true });
          stats['purchases'] = purchasesClean.length;
        }

        // 13. Purchase Items
        if (backupData.purchaseItems?.length > 0) {
          await tx.purchaseItem.createMany({ data: backupData.purchaseItems, skipDuplicates: true });
          stats['purchaseItems'] = backupData.purchaseItems.length;
        }

        // 14. Cash Boxes
        if (backupData.cashBoxes?.length > 0) {
          await tx.cashBox.createMany({ data: backupData.cashBoxes, skipDuplicates: true });
          stats['cashBoxes'] = backupData.cashBoxes.length;
        }

        // ============================================================
        // ORDEM CRÍTICA DE INSERÇÃO (FKs):
        // Sales -> Debts -> Payments -> DebtPayments
        // 
        // Porque:
        // - Debt.saleId -> Sale.id (debts_sale_id_fkey)
        // - Payment.saleId -> Sale.id (payments_sale_id_fkey)  
        // - Payment.debtId -> Debt.id (payments_debt_id_fkey) ⚠️
        // - DebtPayment.debtId -> Debt.id
        // - DebtPayment.paymentId -> Payment.id
        // ============================================================

        // 15. Sales (sem items/payments aninhados)
        if (backupData.sales?.length > 0) {
          const salesClean = backupData.sales.map(s => {
            const { items, payments, ...sale } = s;
            return sale;
          });
          await tx.sale.createMany({ data: salesClean, skipDuplicates: true });
          stats['sales'] = salesClean.length;
        }

        // 16. Sale Items (depende de Sales)
        if (backupData.saleItems?.length > 0) {
          await tx.saleItem.createMany({ data: backupData.saleItems, skipDuplicates: true });
          stats['saleItems'] = backupData.saleItems.length;
        }

        // 17. Debts (depende de Sales via saleId) - ANTES de Payments
        if (backupData.debts?.length > 0) {
          const debtsClean = backupData.debts.map(d => {
            const { payments, ...debt } = d;
            return debt;
          });
          await tx.debt.createMany({ data: debtsClean, skipDuplicates: true });
          stats['debts'] = debtsClean.length;
        }

        // 18. Payments (depende de Sales E Debts) - DEPOIS de Debts
        if (backupData.payments?.length > 0) {
          await tx.payment.createMany({ data: backupData.payments, skipDuplicates: true });
          stats['payments'] = backupData.payments.length;
        }

        // 19. Debt Payments (depende de Debts e Payments)
        if (backupData.debtPayments?.length > 0) {
          await tx.debtPayment.createMany({ data: backupData.debtPayments, skipDuplicates: true });
          stats['debtPayments'] = backupData.debtPayments.length;
        }

        // 20. Loyalty Transactions
        if (backupData.loyaltyTransactions?.length > 0) {
          await tx.loyaltyTransaction.createMany({ data: backupData.loyaltyTransactions, skipDuplicates: true });
          stats['loyaltyTransactions'] = backupData.loyaltyTransactions.length;
        }

        // 20.1 Product Price History 🔴 CORREÇÃO: Restaurar histórico de preços
        if (backupData.productPriceHistory?.length > 0) {
          await tx.productPriceHistory.createMany({ data: backupData.productPriceHistory, skipDuplicates: true });
          stats['productPriceHistory'] = backupData.productPriceHistory.length;
        }

        // 20.2 Feedback 🔴 CORREÇÃO: Restaurar feedbacks de clientes
        if (backupData.feedback?.length > 0) {
          await tx.feedback.createMany({ data: backupData.feedback, skipDuplicates: true });
          stats['feedback'] = backupData.feedback.length;
        }

        // 21. Settings (usa 'key' como chave primária, não 'id')
        if (backupData.settings?.length > 0) {
          for (const setting of backupData.settings) {
            await tx.setting.upsert({
              where: { key: setting.key },
              create: setting,
              update: { value: setting.value },
            });
          }
          stats['settings'] = backupData.settings.length;
        }

        this.logger.log('✅ Dados restaurados com sucesso');
      }, {
        timeout: 120000, // 2 minutos para operações grandes
      });

      const duration = Date.now() - startTime;
      const totalRestored = Object.values(stats).reduce((a, b) => a + b, 0);

      this.logger.warn(`✅ RESTAURAÇÃO CONCLUÍDA!`);
      this.logger.warn(`   Tempo: ${duration}ms`);
      this.logger.warn(`   Registros restaurados: ${totalRestored}`);
      if (errors.length > 0) {
        this.logger.warn(`   Erros: ${errors.length}`);
      }

      // Log de auditoria
      await this.logBackupAction('RESTORE_BACKUP', userId, { 
        originalTimestamp: backupData.metadata.timestamp,
        totalRestored, 
        duration,
        errors: errors.length,
      });

      return {
        success: true,
        message: `Backup restaurado com sucesso! ${totalRestored} registros restaurados em ${duration}ms`,
        stats,
        errors,
        duration,
      };
    } catch (error: any) {
      this.logger.error(`❌ ERRO NA RESTAURAÇÃO: ${error.message}`);
      
      return {
        success: false,
        message: `Erro na restauração: ${error.message}`,
        stats,
        errors: [...errors, error.message],
        duration: Date.now() - startTime,
      };
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Lista backups disponíveis no servidor
   */
  async listBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => {
        const filepath = path.join(this.backupDir, f);
        const stats = fs.statSync(filepath);
        
        // Tentar ler metadata
        let metadata = null;
        try {
          const content = fs.readFileSync(filepath, 'utf-8');
          const data = JSON.parse(content);
          metadata = data.metadata;
        } catch (e) {
          // Ignorar erro de leitura
        }
        
        return {
          filename: f,
          filepath,
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          created: stats.birthtime,
          metadata,
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return files;
  }

  /**
   * Baixa um backup específico
   */
  async downloadBackup(filename: string): Promise<{ filepath: string; data: BackupData }> {
    const filepath = path.join(this.backupDir, filename);
    
    if (!fs.existsSync(filepath)) {
      throw new BadRequestException('Backup não encontrado');
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(content) as BackupData;
    
    return { filepath, data };
  }

  /**
   * Deleta um backup
   */
  async deleteBackup(filename: string): Promise<void> {
    const filepath = path.join(this.backupDir, filename);
    
    if (!fs.existsSync(filepath)) {
      throw new BadRequestException('Backup não encontrado');
    }

    fs.unlinkSync(filepath);
    this.logger.log(`🗑️ Backup deletado: ${filename}`);
  }

  /**
   * Obtém o backup mais recente
   */
  async getLatestBackup() {
    const backups = await this.listBackups();
    if (backups.length === 0) {
      throw new BadRequestException('Nenhum backup encontrado');
    }
    return backups[0];
  }

  /**
   * Status do sistema de backup
   */
  getBackupStatus() {
    return {
      isBackingUp: this.isBackingUp,
      isRestoring: this.isRestoring,
      backupDir: this.backupDir,
      schemaVersion: BACKUP_SCHEMA_VERSION,
    };
  }

  getAutoBackupStatus() {
    return {
      enabled: true,
      schedule: 'Daily at 2 AM',
      lastBackup: fs.existsSync(this.backupDir) 
        ? fs.readdirSync(this.backupDir).length > 0 
          ? 'Available' 
          : 'No backups yet'
        : 'Backup directory not found',
    };
  }

  /**
   * Log de auditoria para ações de backup
   */
  private async logBackupAction(action: string, userId: string, details: any) {
    try {
      // Usar tabela de settings ou criar log simples
      this.logger.log(`📋 AUDIT: ${action} by ${userId} - ${JSON.stringify(details)}`);
    } catch (e) {
      // Ignorar erro de log
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async autoBackup() {
    try {
      await this.createFullBackup('system-auto');
      this.logger.log('✅ Backup automático criado com sucesso');
    } catch (error) {
      this.logger.error('❌ Falha no backup automático:', error);
    }
  }

  // ===== MÉTODOS LEGADOS (compatibilidade) =====
  
  async createBackup(userId: string) {
    return this.createFullBackup(userId);
  }
}

