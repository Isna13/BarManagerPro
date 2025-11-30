import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('import')
export class ImportController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Delete('reset-database')
  async resetDatabase() {
    console.log('🗑️  Limpando banco Railway...');
    
    try {
      // Ordem de deleção respeitando foreign keys
      // Novas tabelas do desktop
      await this.prisma.tableAction.deleteMany({});
      await this.prisma.tablePayment.deleteMany({});
      await this.prisma.tableOrder.deleteMany({});
      await this.prisma.tableCustomer.deleteMany({});
      await this.prisma.tableSession.deleteMany({});
      await this.prisma.debtPayment.deleteMany({});
      await this.prisma.stockMovement.deleteMany({});
      await this.prisma.inventory.deleteMany({});
      await this.prisma.setting.deleteMany({});
      
      // Tabelas existentes
      await this.prisma.payment.deleteMany({});
      await this.prisma.saleItem.deleteMany({});
      await this.prisma.debt.deleteMany({});
      await this.prisma.sale.deleteMany({});
      await this.prisma.cashBox.deleteMany({});
      await this.prisma.inventoryMovement.deleteMany({});
      await this.prisma.inventoryItem.deleteMany({});
      await this.prisma.purchaseItem.deleteMany({});
      await this.prisma.purchase.deleteMany({});
      await this.prisma.productPriceHistory.deleteMany({});
      await this.prisma.product.deleteMany({});
      await this.prisma.category.deleteMany({});
      await this.prisma.customer.deleteMany({});
      await this.prisma.supplier.deleteMany({});
      await this.prisma.table.deleteMany({});
      await this.prisma.session.deleteMany({});
      await this.prisma.auditLog.deleteMany({});
      await this.prisma.notification.deleteMany({});
      // NÃO deletar users e branches para manter acesso admin
      
      console.log('✅ Banco limpo com sucesso!');
      return { success: true, message: 'Banco de dados limpo com sucesso' };
    } catch (error: any) {
      console.error('❌ Erro ao limpar banco:', error.message);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('sqlite-data')
  async importSqliteData(@Body() data: any) {
    try {
      console.log('🚀 Iniciando importação...');

      // Importar Branches
      for (const b of data.branches || []) {
        await this.prisma.branch.upsert({
          where: { id: b.id },
          create: {
            id: b.id,
            name: b.name,
            code: b.code,
            address: b.address,
            phone: b.phone,
            isActive: b.is_active === 1,
          },
          update: {},
        });
      }

      // Importar Categorias
      for (const c of data.categories || []) {
        await this.prisma.category.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            name: c.name,
            nameKriol: c.name_kriol,
            nameFr: c.name_fr,
            description: c.description,
            isActive: c.is_active === 1,
            sortOrder: c.sort_order || 0,
          },
          update: {},
        });
      }

      // Importar Produtos
      for (const p of data.products || []) {
        await this.prisma.product.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            sku: p.sku || `SKU-${Date.now()}`,
            name: p.name,
            nameKriol: p.name_kriol,
            nameFr: p.name_fr,
            categoryId: p.category_id,
            priceUnit: parseInt(p.unit_price) || parseInt(p.price_unit) || 0,
            priceBox: parseInt(p.box_price) || parseInt(p.price_box) || 0,
            costUnit: parseInt(p.cost_unit) || 0,
            costBox: parseInt(p.cost_box) || 0,
            unitsPerBox: p.units_per_box || 1,
            minMarginPercent: parseFloat(p.min_margin_percent) || 0,
            maxDiscountMuntu: parseFloat(p.max_discount_muntu) || 0,
            taxRate: parseFloat(p.tax_rate) || 0,
            isActive: p.is_active === 1,
          },
          update: {},
        });
      }

      // Importar Clientes
      for (const c of data.customers || []) {
        await this.prisma.customer.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            code: c.code,
            fullName: c.full_name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            creditLimit: parseInt(c.credit_limit) || 0,
            isActive: c.is_active === 1,
          },
          update: {},
        });
      }

      // Importar Estoque
      for (const i of data.inventory_items || []) {
        if (!i.branch_id) continue; // branchId é obrigatório
        await this.prisma.inventoryItem.upsert({
          where: { id: i.id },
          create: {
            id: i.id,
            productId: i.product_id,
            branchId: i.branch_id,
            qtyBoxes: i.qty_boxes || 0,
            qtyUnits: i.qty_units || 0,
            minStock: i.min_stock || 0,
          },
          update: {
            qtyBoxes: i.qty_boxes || 0,
            qtyUnits: i.qty_units || 0,
          },
        });
      }

      // Importar Vendas
      for (const s of data.sales || []) {
        if (!s.branch_id) continue; // branchId é obrigatório
        await this.prisma.sale.upsert({
          where: { id: s.id },
          create: {
            id: s.id,
            saleNumber: s.sale_number || `SALE-${Date.now()}`,
            customerId: s.customer_id || null,
            cashierId: s.user_id || s.cashier_id,
            branchId: s.branch_id,
            status: s.status || 'closed',
            total: parseInt(s.total_amount) || parseInt(s.total) || 0,
            subtotal: parseInt(s.subtotal) || parseInt(s.total_amount) || 0,
          },
          update: {},
        });
      }

      // Importar Itens de Venda
      for (const item of data.sale_items || []) {
        const unitPrice = parseInt(item.unit_price) || 0;
        const qtyUnits = item.quantity || item.qty_units || 0;
        const subtotal = parseInt(item.subtotal) || (unitPrice * qtyUnits);
        await this.prisma.saleItem.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            saleId: item.sale_id,
            productId: item.product_id,
            qtyUnits: qtyUnits,
            unitPrice: unitPrice,
            unitCost: parseInt(item.unit_cost) || 0,
            subtotal: subtotal,
            tax: parseInt(item.tax) || 0,
            taxAmount: parseInt(item.tax_amount) || parseInt(item.tax) || 0,
            total: parseInt(item.total) || subtotal,
            muntuSavings: parseInt(item.muntu_discount) || parseInt(item.muntu_savings) || 0,
          },
          update: {},
        });
      }

      // Importar Caixas
      for (const box of data.cash_boxes || []) {
        await this.prisma.cashBox.upsert({
          where: { id: box.id },
          create: {
            id: box.id,
            boxNumber: box.box_number,
            branchId: box.branch_id,
            openedBy: box.opened_by,
            status: box.status,
          },
          update: {},
        });
      }

      // Importar Dívidas
      for (const debt of data.debts || []) {
        await this.prisma.debt.upsert({
          where: { id: debt.id },
          create: {
            id: debt.id,
            debtNumber: debt.debt_number,
            customerId: debt.customer_id,
            saleId: debt.sale_id,
            originalAmount: parseInt(debt.original_amount) || 0,
            paidAmount: parseInt(debt.paid_amount) || 0,
            balance: parseInt(debt.balance) || 0,
            amount: parseInt(debt.original_amount) || 0,
            paid: parseInt(debt.paid_amount) || 0,
            status: debt.status,
            createdBy: debt.created_by,
          },
          update: {},
        });
      }

      // Importar Suppliers
      for (const s of data.suppliers || []) {
        await this.prisma.supplier.upsert({
          where: { id: s.id },
          create: {
            id: s.id,
            code: s.code,
            name: s.name,
            contactPerson: s.contact_person,
            phone: s.phone,
            email: s.email,
            address: s.address,
            taxId: s.tax_id,
            paymentTerms: s.payment_terms,
            notes: s.notes,
            isActive: s.is_active === 1,
          },
          update: {},
        });
      }

      // Importar Tables (mesas)
      for (const t of data.tables || []) {
        await this.prisma.table.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            branchId: t.branch_id,
            number: t.number,
            seats: t.seats || 4,
            area: t.area,
            qrCode: t.qr_code,
            isActive: t.is_active === 1,
          },
          update: {},
        });
      }

      // Importar Payments
      for (const p of data.payments || []) {
        await this.prisma.payment.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            saleId: p.sale_id,
            debtId: p.debt_id,
            method: p.method,
            provider: p.provider,
            amount: parseInt(p.amount) || 0,
            referenceNumber: p.reference_number,
            transactionId: p.transaction_id,
            status: p.status || 'completed',
            notes: p.notes,
          },
          update: {},
        });
      }

      // ========== NOVAS TABELAS DO DESKTOP ==========

      // Importar StockMovements
      for (const sm of data.stock_movements || []) {
        await this.prisma.stockMovement.upsert({
          where: { id: sm.id },
          create: {
            id: sm.id,
            productId: sm.product_id,
            branchId: sm.branch_id,
            movementType: sm.movement_type,
            quantity: parseInt(sm.quantity) || 0,
            quantityBefore: parseInt(sm.quantity_before) || 0,
            quantityAfter: parseInt(sm.quantity_after) || 0,
            closedBoxesBefore: parseInt(sm.closed_boxes_before) || 0,
            closedBoxesAfter: parseInt(sm.closed_boxes_after) || 0,
            openBoxBefore: parseInt(sm.open_box_before) || 0,
            openBoxAfter: parseInt(sm.open_box_after) || 0,
            boxOpenedAutomatically: sm.box_opened_automatically === 1,
            reason: sm.reason,
            responsible: sm.responsible,
            terminal: sm.terminal,
            saleId: sm.sale_id,
            purchaseId: sm.purchase_id,
            notes: sm.notes,
            synced: sm.synced === 1,
          },
          update: {},
        });
      }

      // Importar TableSessions
      for (const ts of data.table_sessions || []) {
        await this.prisma.tableSession.upsert({
          where: { id: ts.id },
          create: {
            id: ts.id,
            tableId: ts.table_id,
            branchId: ts.branch_id,
            sessionNumber: ts.session_number,
            status: ts.status || 'open',
            openedBy: ts.opened_by,
            closedBy: ts.closed_by,
            openedAt: ts.opened_at ? new Date(ts.opened_at) : new Date(),
            closedAt: ts.closed_at ? new Date(ts.closed_at) : null,
            totalAmount: parseInt(ts.total_amount) || 0,
            paidAmount: parseInt(ts.paid_amount) || 0,
            notes: ts.notes,
            synced: ts.synced === 1,
          },
          update: {},
        });
      }

      // Importar TableCustomers
      for (const tc of data.table_customers || []) {
        await this.prisma.tableCustomer.upsert({
          where: { id: tc.id },
          create: {
            id: tc.id,
            sessionId: tc.session_id,
            customerName: tc.customer_name,
            customerId: tc.customer_id,
            orderSequence: tc.order_sequence || 1,
            subtotal: parseInt(tc.subtotal) || 0,
            discount: parseInt(tc.discount) || 0,
            total: parseInt(tc.total) || 0,
            paidAmount: parseInt(tc.paid_amount) || 0,
            paymentStatus: tc.payment_status || 'pending',
          },
          update: {},
        });
      }

      // Importar TableOrders
      for (const to of data.table_orders || []) {
        await this.prisma.tableOrder.upsert({
          where: { id: to.id },
          create: {
            id: to.id,
            sessionId: to.session_id,
            tableCustomerId: to.table_customer_id,
            productId: to.product_id,
            qtyUnits: to.qty_units || 1,
            isMuntu: to.is_muntu === 1,
            unitPrice: parseInt(to.unit_price) || 0,
            unitCost: parseInt(to.unit_cost) || 0,
            subtotal: parseInt(to.subtotal) || 0,
            discount: parseInt(to.discount) || 0,
            total: parseInt(to.total) || 0,
            status: to.status || 'pending',
            notes: to.notes,
            orderedBy: to.ordered_by,
            orderedAt: to.ordered_at ? new Date(to.ordered_at) : new Date(),
            cancelledAt: to.cancelled_at ? new Date(to.cancelled_at) : null,
            cancelledBy: to.cancelled_by,
            synced: to.synced === 1,
          },
          update: {},
        });
      }

      // Importar TablePayments
      for (const tp of data.table_payments || []) {
        await this.prisma.tablePayment.upsert({
          where: { id: tp.id },
          create: {
            id: tp.id,
            sessionId: tp.session_id,
            tableCustomerId: tp.table_customer_id,
            paymentId: tp.payment_id,
            method: tp.method,
            amount: parseInt(tp.amount) || 0,
            referenceNumber: tp.reference_number,
            status: tp.status || 'completed',
            processedBy: tp.processed_by,
            processedAt: tp.processed_at ? new Date(tp.processed_at) : null,
            notes: tp.notes,
            synced: tp.synced === 1,
          },
          update: {},
        });
      }

      // Importar TableActions
      for (const ta of data.table_actions || []) {
        await this.prisma.tableAction.upsert({
          where: { id: ta.id },
          create: {
            id: ta.id,
            sessionId: ta.session_id,
            actionType: ta.action_type,
            performedBy: ta.performed_by,
            description: ta.description,
            metadata: ta.metadata,
            performedAt: ta.performed_at ? new Date(ta.performed_at) : new Date(),
          },
          update: {},
        });
      }

      // Importar DebtPayments
      for (const dp of data.debt_payments || []) {
        await this.prisma.debtPayment.upsert({
          where: { id: dp.id },
          create: {
            id: dp.id,
            debtId: dp.debt_id,
            paymentId: dp.payment_id,
            amount: parseInt(dp.amount) || 0,
            method: dp.method,
            reference: dp.reference,
            notes: dp.notes,
            receivedBy: dp.received_by,
            synced: dp.synced === 1,
          },
          update: {},
        });
      }

      // Importar Inventory (tabela separada do InventoryItem)
      for (const inv of data.inventory || []) {
        await this.prisma.inventory.upsert({
          where: { id: inv.id },
          create: {
            id: inv.id,
            productId: inv.product_id,
            branchId: inv.branch_id,
            quantityUnits: parseInt(inv.quantity_units) || 0,
            quantityBoxes: parseInt(inv.quantity_boxes) || 0,
            minStockUnits: parseInt(inv.min_stock_units) || 10,
            lastCountDate: inv.last_count_date ? new Date(inv.last_count_date) : null,
            synced: inv.synced === 1,
          },
          update: {},
        });
      }

      // Importar Settings
      for (const s of data.settings || []) {
        await this.prisma.setting.upsert({
          where: { key: s.key },
          create: {
            key: s.key,
            value: s.value,
          },
          update: {
            value: s.value,
          },
        });
      }

      return {
        success: true,
        message: 'Dados importados com sucesso',
        stats: {
          branches: data.branches?.length || 0,
          categories: data.categories?.length || 0,
          products: data.products?.length || 0,
          customers: data.customers?.length || 0,
          suppliers: data.suppliers?.length || 0,
          inventory_items: data.inventory_items?.length || 0,
          inventory: data.inventory?.length || 0,
          sales: data.sales?.length || 0,
          sale_items: data.sale_items?.length || 0,
          payments: data.payments?.length || 0,
          cash_boxes: data.cash_boxes?.length || 0,
          debts: data.debts?.length || 0,
          tables: data.tables?.length || 0,
          table_sessions: data.table_sessions?.length || 0,
          table_customers: data.table_customers?.length || 0,
          table_orders: data.table_orders?.length || 0,
          table_payments: data.table_payments?.length || 0,
          table_actions: data.table_actions?.length || 0,
          stock_movements: data.stock_movements?.length || 0,
          debt_payments: data.debt_payments?.length || 0,
          settings: data.settings?.length || 0,
        },
      };
    } catch (error) {
      console.error('❌ Erro na importação:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
