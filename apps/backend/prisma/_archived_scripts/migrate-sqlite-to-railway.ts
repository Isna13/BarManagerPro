import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as os from 'os';

// Caminho do SQLite (igual ao usado pelo Electron)
const sqlitePath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'barmanager-pro',
  'barmanager.db'
);

console.log(`📂 Procurando banco SQLite em: ${sqlitePath}`);

const sqlite = new Database(sqlitePath, { readonly: true });
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

async function migrateSQLiteToPostgres() {
  try {
    console.log('\n🔄 Iniciando migração SQLite → PostgreSQL Railway...\n');

    // 1. Exportar Produtos
    console.log('📦 Migrando produtos...');
    const products = sqlite.prepare('SELECT * FROM products').all();
    for (const p of products as any[]) {
      await prisma.product.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          nameKriol: p.name_kriol,
          nameFr: p.name_fr,
          categoryId: p.category_id,
          unitPrice: p.unit_price,
          boxPrice: p.box_price,
          unitsPerBox: p.units_per_box,
          minMarginPercent: p.min_margin_percent || 0,
          maxDiscountMuntu: p.max_discount_muntu || 0,
          taxRate: p.tax_rate || 0,
          isActive: p.is_active === 1,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${products.length} produtos migrados`);

    // 2. Exportar Clientes
    console.log('👥 Migrando clientes...');
    const customers = sqlite.prepare('SELECT * FROM customers').all();
    for (const c of customers as any[]) {
      await prisma.customer.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          code: c.code,
          fullName: c.full_name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          creditLimit: c.credit_limit || 0,
          isActive: c.is_active === 1,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${customers.length} clientes migrados`);

    // 3. Exportar Categorias
    console.log('📂 Migrando categorias...');
    const categories = sqlite.prepare('SELECT * FROM categories').all();
    for (const cat of categories as any[]) {
      await prisma.category.upsert({
        where: { id: cat.id },
        create: {
          id: cat.id,
          name: cat.name,
          nameKriol: cat.name_kriol,
          nameFr: cat.name_fr,
          description: cat.description,
          isActive: cat.is_active === 1,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${categories.length} categorias migradas`);

    // 4. Exportar Estoque
    console.log('📊 Migrando estoque...');
    const inventory = sqlite.prepare('SELECT * FROM inventory_items').all();
    for (const inv of inventory as any[]) {
      await prisma.inventoryItem.upsert({
        where: { id: inv.id },
        create: {
          id: inv.id,
          productId: inv.product_id,
          branchId: inv.branch_id,
          qtyBoxes: inv.qty_boxes || 0,
          qtyUnits: inv.qty_units || 0,
          minStock: inv.min_stock || 0,
          maxStock: inv.max_stock || 0,
        },
        update: {
          qtyBoxes: inv.qty_boxes || 0,
          qtyUnits: inv.qty_units || 0,
        },
      });
    }
    console.log(`   ✅ ${inventory.length} itens de estoque migrados`);

    // 5. Exportar Vendas
    console.log('🛒 Migrando vendas...');
    const sales = sqlite.prepare('SELECT * FROM sales').all();
    for (const sale of sales as any[]) {
      await prisma.sale.upsert({
        where: { id: sale.id },
        create: {
          id: sale.id,
          saleNumber: sale.sale_number,
          customerId: sale.customer_id,
          userId: sale.user_id,
          branchId: sale.branch_id,
          status: sale.status,
          totalAmount: sale.total_amount || 0,
          paidAmount: sale.paid_amount || 0,
          isMuntu: sale.is_muntu === 1,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${sales.length} vendas migradas`);

    // 6. Exportar Itens de Venda
    console.log('📝 Migrando itens de venda...');
    const saleItems = sqlite.prepare('SELECT * FROM sale_items').all();
    for (const item of saleItems as any[]) {
      await prisma.saleItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          saleId: item.sale_id,
          productId: item.product_id,
          quantity: item.quantity || 0,
          unitPrice: item.unit_price || 0,
          subtotal: item.subtotal || 0,
          muntuDiscount: item.muntu_discount || 0,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${saleItems.length} itens de venda migrados`);

    // 7. Exportar Caixas
    console.log('🏦 Migrando caixas...');
    const cashBoxes = sqlite.prepare('SELECT * FROM cash_boxes').all();
    for (const box of cashBoxes as any[]) {
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
    console.log(`   ✅ ${cashBoxes.length} caixas migrados`);

    // 8. Exportar Dívidas
    console.log('📋 Migrando dívidas...');
    const debts = sqlite.prepare('SELECT * FROM debts').all();
    for (const debt of debts as any[]) {
      await prisma.debt.upsert({
        where: { id: debt.id },
        create: {
          id: debt.id,
          debtNumber: debt.debt_number,
          customerId: debt.customer_id,
          saleId: debt.sale_id,
          originalAmount: debt.original_amount || 0,
          paidAmount: debt.paid_amount || 0,
          balance: debt.balance || 0,
          amount: debt.original_amount || 0,
          paid: debt.paid_amount || 0,
          status: debt.status,
          createdBy: debt.created_by,
        },
        update: {},
      });
    }
    console.log(`   ✅ ${debts.length} dívidas migradas`);

    console.log('\n✨ Migração concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

migrateSQLiteToPostgres();
