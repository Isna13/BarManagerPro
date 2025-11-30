import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('import')
export class ImportController {
  constructor(private prisma: PrismaService) {}

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

      return {
        success: true,
        message: 'Dados importados com sucesso',
        stats: {
          branches: data.branches?.length || 0,
          categories: data.categories?.length || 0,
          products: data.products?.length || 0,
          customers: data.customers?.length || 0,
          inventory: data.inventory_items?.length || 0,
          sales: data.sales?.length || 0,
          saleItems: data.sale_items?.length || 0,
          cashBoxes: data.cash_boxes?.length || 0,
          debts: data.debts?.length || 0,
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
