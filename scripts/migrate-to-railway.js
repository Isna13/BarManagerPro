/**
 * Script para migrar dados do SQLite Desktop para PostgreSQL Railway
 * 
 * Uso: node scripts/migrate-to-railway.js
 */

const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Caminho do banco SQLite do Desktop
const getDesktopDbPath = () => {
  const platform = os.platform();
  let userDataPath;
  
  if (platform === 'win32') {
    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'barmanager-desktop');
  } else if (platform === 'darwin') {
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'barmanager-desktop');
  } else {
    userDataPath = path.join(os.homedir(), '.config', 'barmanager-desktop');
  }
  
  return path.join(userDataPath, 'barmanager.db');
};

async function migrate() {
  const dbPath = getDesktopDbPath();
  
  console.log('🔍 Procurando banco SQLite em:', dbPath);
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco SQLite não encontrado!');
    console.log('Caminhos possíveis para verificar manualmente:');
    console.log('  Windows: %APPDATA%\\barmanager-desktop\\barmanager.db');
    console.log('  Mac: ~/Library/Application Support/barmanager-desktop/barmanager.db');
    console.log('  Linux: ~/.config/barmanager-desktop/barmanager.db');
    process.exit(1);
  }
  
  console.log('✅ Banco SQLite encontrado!');
  
  // Conectar ao SQLite
  const sqlite = new Database(dbPath, { readonly: true });
  
  // Conectar ao PostgreSQL (Railway)
  const prisma = new PrismaClient();
  
  try {
    console.log('\n📊 Iniciando migração...\n');
    
    // 1. Migrar Categorias
    console.log('📁 Migrando categorias...');
    const categories = sqlite.prepare('SELECT * FROM categories').all();
    for (const cat of categories) {
      try {
        await prisma.category.upsert({
          where: { id: cat.id },
          update: { name: cat.name, description: cat.description },
          create: {
            id: cat.id,
            name: cat.name,
            description: cat.description,
          }
        });
      } catch (e) {
        console.log(`  ⚠️ Categoria ${cat.name}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${categories.length} categorias processadas`);
    
    // 2. Migrar Produtos
    console.log('📦 Migrando produtos...');
    const products = sqlite.prepare('SELECT * FROM products').all();
    for (const prod of products) {
      try {
        await prisma.product.upsert({
          where: { id: prod.id },
          update: {
            name: prod.name,
            sku: prod.sku,
            barcode: prod.barcode,
            description: prod.description,
            categoryId: prod.category_id,
            costPrice: prod.unit_cost || 0,
            salePrice: prod.unit_price || 0,
            isActive: prod.is_active === 1,
          },
          create: {
            id: prod.id,
            name: prod.name,
            sku: prod.sku || `SKU-${Date.now()}`,
            barcode: prod.barcode,
            description: prod.description,
            categoryId: prod.category_id,
            costPrice: prod.unit_cost || 0,
            salePrice: prod.unit_price || 0,
            isActive: prod.is_active !== 0,
          }
        });
      } catch (e) {
        console.log(`  ⚠️ Produto ${prod.name}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${products.length} produtos processados`);
    
    // 3. Migrar Clientes
    console.log('👥 Migrando clientes...');
    const customers = sqlite.prepare('SELECT * FROM customers').all();
    for (const cust of customers) {
      try {
        await prisma.customer.upsert({
          where: { id: cust.id },
          update: {
            name: cust.name,
            phone: cust.phone,
            email: cust.email,
            address: cust.address,
          },
          create: {
            id: cust.id,
            name: cust.name || 'Cliente',
            phone: cust.phone,
            email: cust.email,
            address: cust.address,
          }
        });
      } catch (e) {
        console.log(`  ⚠️ Cliente ${cust.name}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${customers.length} clientes processados`);
    
    // 4. Migrar Inventário
    console.log('📋 Migrando inventário...');
    const inventory = sqlite.prepare('SELECT * FROM inventory').all();
    for (const inv of inventory) {
      try {
        await prisma.inventory.upsert({
          where: { id: inv.id },
          update: {
            productId: inv.product_id,
            quantity: inv.quantity || 0,
            minStock: inv.min_stock || 5,
          },
          create: {
            id: inv.id,
            productId: inv.product_id,
            quantity: inv.quantity || 0,
            minStock: inv.min_stock || 5,
          }
        });
      } catch (e) {
        console.log(`  ⚠️ Inventário ${inv.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${inventory.length} itens de inventário processados`);
    
    // 5. Migrar Vendas
    console.log('💰 Migrando vendas...');
    const sales = sqlite.prepare('SELECT * FROM sales').all();
    for (const sale of sales) {
      try {
        await prisma.sale.upsert({
          where: { id: sale.id },
          update: {
            total: sale.total_amount || 0,
            discount: sale.discount || 0,
            status: sale.status || 'completed',
          },
          create: {
            id: sale.id,
            total: sale.total_amount || 0,
            subtotal: sale.subtotal || sale.total_amount || 0,
            discount: sale.discount || 0,
            status: sale.status || 'completed',
            customerId: sale.customer_id,
            userId: sale.user_id,
            branchId: sale.branch_id,
            createdAt: sale.created_at ? new Date(sale.created_at) : new Date(),
          }
        });
      } catch (e) {
        console.log(`  ⚠️ Venda ${sale.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${sales.length} vendas processadas`);
    
    // 6. Migrar Itens de Venda
    console.log('🛒 Migrando itens de venda...');
    const saleItems = sqlite.prepare('SELECT * FROM sale_items').all();
    for (const item of saleItems) {
      try {
        await prisma.saleItem.upsert({
          where: { id: item.id },
          update: {
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || 0,
            total: item.total || 0,
          },
          create: {
            id: item.id,
            saleId: item.sale_id,
            productId: item.product_id,
            quantity: item.quantity || 1,
            unitPrice: item.unit_price || 0,
            costPrice: item.cost_price || 0,
            total: item.total || 0,
          }
        });
      } catch (e) {
        console.log(`  ⚠️ Item ${item.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${saleItems.length} itens de venda processados`);
    
    console.log('\n🎉 Migração concluída com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`   Categorias: ${categories.length}`);
    console.log(`   Produtos: ${products.length}`);
    console.log(`   Clientes: ${customers.length}`);
    console.log(`   Inventário: ${inventory.length}`);
    console.log(`   Vendas: ${sales.length}`);
    console.log(`   Itens de Venda: ${saleItems.length}`);
    
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

migrate();
