#!/usr/bin/env node

/**
 * Script de importação de dados SQLite para PostgreSQL
 * 
 * Execute via Railway CLI:
 *   railway run node scripts/import-sqlite-data.js
 * 
 * Ou localmente com DATABASE_URL:
 *   DATABASE_URL="postgresql://..." node scripts/import-sqlite-data.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importData() {
  try {
    console.log('📂 Lendo dados exportados...');
    const dataPath = path.join(__dirname, '..', 'prisma', 'sqlite-data.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error(`❌ Arquivo não encontrado: ${dataPath}`);
      process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log('✅ Dados carregados:', {
      branches: data.branches?.length || 0,
      categories: data.categories?.length || 0,
      products: data.products?.length || 0,
      customers: data.customers?.length || 0,
      inventory: data.inventory_items?.length || 0,
      sales: data.sales?.length || 0,
      saleItems: data.sale_items?.length || 0,
      cashBoxes: data.cash_boxes?.length || 0,
      debts: data.debts?.length || 0,
    });

    console.log('\n🚀 Iniciando importação...\n');

    // Importar Branches
    if (data.branches && data.branches.length > 0) {
      console.log('🏢 Importando filiais...');
      for (const b of data.branches) {
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
      console.log(`   ✅ ${data.branches.length} filiais importadas`);
    }

    // Importar Categorias
    if (data.categories && data.categories.length > 0) {
      console.log('📁 Importando categorias...');
      for (const c of data.categories) {
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
      console.log(`   ✅ ${data.categories.length} categorias importadas`);
    }

    // Importar Produtos
    if (data.products && data.products.length > 0) {
      console.log('📦 Importando produtos...');
      for (const p of data.products) {
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
      console.log(`   ✅ ${data.products.length} produtos importados`);
    }

    // Importar Clientes
    if (data.customers && data.customers.length > 0) {
      console.log('👥 Importando clientes...');
      for (const c of data.customers) {
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
      console.log(`   ✅ ${data.customers.length} clientes importados`);
    }

    // Importar Estoque
    if (data.inventory_items && data.inventory_items.length > 0) {
      console.log('📊 Importando estoque...');
      for (const i of data.inventory_items) {
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
      console.log(`   ✅ ${data.inventory_items.length} itens de estoque importados`);
    }

    // Importar Vendas
    if (data.sales && data.sales.length > 0) {
      console.log('🛒 Importando vendas...');
      for (const s of data.sales) {
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
      console.log(`   ✅ ${data.sales.length} vendas importadas`);
    }

    // Importar Itens de Venda
    if (data.sale_items && data.sale_items.length > 0) {
      console.log('📝 Importando itens de venda...');
      for (const item of data.sale_items) {
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
      console.log(`   ✅ ${data.sale_items.length} itens de venda importados`);
    }

    // Importar Caixas
    if (data.cash_boxes && data.cash_boxes.length > 0) {
      console.log('💰 Importando caixas...');
      for (const box of data.cash_boxes) {
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
      console.log(`   ✅ ${data.cash_boxes.length} caixas importadas`);
    }

    // Importar Dívidas
    if (data.debts && data.debts.length > 0) {
      console.log('💳 Importando dívidas...');
      for (const debt of data.debts) {
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
      console.log(`   ✅ ${data.debts.length} dívidas importadas`);
    }

    console.log('\n✅ Importação concluída com sucesso!\n');
    
  } catch (error) {
    console.error('\n❌ Erro na importação:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
