import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

async function importToRailway() {
  try {
    const data = JSON.parse(fs.readFileSync('prisma/sqlite-data.json', 'utf-8'));

    console.log('\n🚀 Importando dados para Railway PostgreSQL...\n');

    // 1. Importar Branches
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
    console.log(`   ✅ ${data.branches?.length || 0} filiais`);

    // 2. Importar Categorias
    console.log('📂 Importando categorias...');
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
    console.log(`   ✅ ${data.categories?.length || 0} categorias`);

    // 3. Importar Produtos
    console.log('📦 Importando produtos...');
    for (const p of data.products || []) {
      await prisma.product.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          nameKriol: p.name_kriol,
          nameFr: p.name_fr,
          categoryId: p.category_id,
          unitPrice: parseInt(p.unit_price) || 0,
          boxPrice: parseInt(p.box_price) || 0,
          unitsPerBox: p.units_per_box || 1,
          minMarginPercent: parseFloat(p.min_margin_percent) || 0,
          maxDiscountMuntu: parseFloat(p.max_discount_muntu) || 0,
          taxRate: parseFloat(p.tax_rate) || 0,
          isActive: p.is_active === 1,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${data.products?.length || 0} produtos`);

    // 4. Importar Clientes
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
    console.log(`   ✅ ${data.customers?.length || 0} clientes`);

    // 5. Importar Estoque
    console.log('📊 Importando estoque...');
    for (const i of data.inventory_items || []) {
      await prisma.inventoryItem.upsert({
        where: { id: i.id },
        create: {
          id: i.id,
          productId: i.product_id,
          branchId: i.branch_id || null,
          qtyBoxes: i.qty_boxes || 0,
          qtyUnits: i.qty_units || 0,
          minStock: i.min_stock || 0,
          maxStock: i.max_stock || 0,
        },
        update: {
          qtyBoxes: i.qty_boxes || 0,
          qtyUnits: i.qty_units || 0,
        },
      });
    }
    console.log(`   ✅ ${data.inventory_items?.length || 0} itens de estoque`);

    // 6. Importar Vendas
    console.log('🛒 Importando vendas...');
    for (const s of data.sales || []) {
      await prisma.sale.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          saleNumber: s.sale_number,
          customerId: s.customer_id,
          userId: s.user_id,
          branchId: s.branch_id,
          status: s.status,
          totalAmount: parseInt(s.total_amount) || 0,
          paidAmount: parseInt(s.paid_amount) || 0,
          isMuntu: s.is_muntu === 1,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${data.sales?.length || 0} vendas`);

    // 7. Importar Itens de Venda
    console.log('📝 Importando itens de venda...');
    for (const item of data.sale_items || []) {
      await prisma.saleItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          saleId: item.sale_id,
          productId: item.product_id,
          quantity: item.quantity || 0,
          unitPrice: parseInt(item.unit_price) || 0,
          subtotal: parseInt(item.subtotal) || 0,
          muntuDiscount: parseInt(item.muntu_discount) || 0,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${data.sale_items?.length || 0} itens de venda`);

    // 8. Importar Caixas
    console.log('🏦 Importando caixas...');
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
    console.log(`   ✅ ${data.cash_boxes?.length || 0} caixas`);

    // 9. Importar Dívidas
    console.log('📋 Importando dívidas...');
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
    console.log(`   ✅ ${data.debts?.length || 0} dívidas`);

    console.log('\n✨ Importação concluída com sucesso!');
    console.log('\n📊 Resumo total:');
    console.log(`   🏢 Filiais: ${data.branches?.length || 0}`);
    console.log(`   📂 Categorias: ${data.categories?.length || 0}`);
    console.log(`   📦 Produtos: ${data.products?.length || 0}`);
    console.log(`   👥 Clientes: ${data.customers?.length || 0}`);
    console.log(`   📊 Estoque: ${data.inventory_items?.length || 0}`);
    console.log(`   🛒 Vendas: ${data.sales?.length || 0}`);
    console.log(`   📝 Itens de venda: ${data.sale_items?.length || 0}`);
    console.log(`   🏦 Caixas: ${data.cash_boxes?.length || 0}`);
    console.log(`   📋 Dívidas: ${data.debts?.length || 0}`);
  } catch (error) {
    console.error('❌ Erro na importação:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importToRailway();
