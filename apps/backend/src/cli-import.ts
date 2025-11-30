import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  try {
    console.log('📂 Lendo dados exportados...');
    const data = JSON.parse(fs.readFileSync('./prisma/sqlite-data.json', 'utf-8'));

    console.log('🚀 Iniciando importação...');

    // Importar Branches
    console.log('🏢 Importando filiais...');
    for (const b of data.branches || []) {
      await prisma.branch.upsert({
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
    console.log('📁 Importando categorias...');
    for (const c of data.categories || []) {
      await prisma.category.upsert({
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
    console.log('📦 Importando produtos...');
    for (const p of data.products || []) {
      await prisma.product.upsert({
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
    console.log('👥 Importando clientes...');
    for (const c of data.customers || []) {
      await prisma.customer.upsert({
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
    console.log('📊 Importando estoque...');
    for (const i of data.inventory_items || []) {
      if (!i.branch_id) continue; // branchId é obrigatório
      await prisma.inventoryItem.upsert({
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
    console.log('🛒 Importando vendas...');
    for (const s of data.sales || []) {
      if (!s.branch_id) continue; // branchId é obrigatório
      await prisma.sale.upsert({
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
    console.log('📝 Importando itens de venda...');
    for (const item of data.sale_items || []) {
      const unitPrice = parseInt(item.unit_price) || 0;
      const qtyUnits = item.quantity || item.qty_units || 0;
      const subtotal = parseInt(item.subtotal) || (unitPrice * qtyUnits);
      await prisma.saleItem.upsert({
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
    console.log('💰 Importando caixas...');
    for (const box of data.cash_boxes || []) {
      await prisma.cashBox.upsert({
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
    console.log('💳 Importando dívidas...');
    for (const debt of data.debts || []) {
      await prisma.debt.upsert({
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

    console.log('\n✅ Importação concluída com sucesso!');
    console.log('📊 Resumo:');
    console.log(`   🏢 Filiais: ${data.branches?.length || 0}`);
    console.log(`   📁 Categorias: ${data.categories?.length || 0}`);
    console.log(`   📦 Produtos: ${data.products?.length || 0}`);
    console.log(`   👥 Clientes: ${data.customers?.length || 0}`);
    console.log(`   📊 Estoque: ${data.inventory_items?.length || 0}`);
    console.log(`   🛒 Vendas: ${data.sales?.length || 0}`);
    console.log(`   📝 Itens: ${data.sale_items?.length || 0}`);
    console.log(`   💰 Caixas: ${data.cash_boxes?.length || 0}`);
    console.log(`   💳 Dívidas: ${data.debts?.length || 0}`);
  } catch (error) {
    console.error('❌ Erro na importação:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
