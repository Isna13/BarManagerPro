// Script para verificar sincronização entre SQLite local e Railway
const Database = require('better-sqlite3');
const https = require('https');
const http = require('http');

const DB_PATH = 'C:\\Users\\HP\\AppData\\Roaming\\@barmanager\\desktop\\barmanager.db';
const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

// Token de autenticação
let authToken = '';

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'admin@barmanager.com',
      password: 'Admin@123456'
    });

    const url = new URL(API_URL + '/auth/login');
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          authToken = result.accessToken;
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('VERIFICAÇÃO DE SINCRONIZAÇÃO LOCAL vs RAILWAY');
  console.log('='.repeat(60));
  console.log();

  // Conectar ao SQLite local
  console.log('📂 Conectando ao banco SQLite local...');
  const db = new Database(DB_PATH, { readonly: true });
  
  // Login no Railway
  console.log('🔑 Fazendo login no Railway...');
  await login();
  console.log('✅ Login OK\n');

  // ============ PRODUTOS ============
  console.log('📦 PRODUTOS');
  console.log('-'.repeat(40));
  
  const localProducts = db.prepare('SELECT id, name, sku, price_unit, cost_unit FROM products WHERE is_active = 1 ORDER BY name').all();
  const railwayProducts = await fetchAPI('/products');
  
  console.log(`   Local (SQLite): ${localProducts.length} produtos`);
  console.log(`   Railway:        ${railwayProducts.length} produtos`);
  
  if (localProducts.length > 0) {
    console.log('\n   Produtos locais:');
    localProducts.forEach(p => {
      console.log(`   - ${p.name} (SKU: ${p.sku}) - Preço: ${p.price_unit}`);
    });
  }
  
  if (railwayProducts.length > 0) {
    console.log('\n   Produtos Railway:');
    railwayProducts.forEach(p => {
      console.log(`   - ${p.name} (SKU: ${p.sku}) - Preço: ${p.priceUnit}`);
    });
  }

  // ============ CATEGORIAS ============
  console.log('\n📁 CATEGORIAS');
  console.log('-'.repeat(40));
  
  const localCategories = db.prepare('SELECT id, name FROM categories ORDER BY name').all();
  const railwayCategories = await fetchAPI('/categories');
  
  console.log(`   Local (SQLite): ${localCategories.length} categorias`);
  console.log(`   Railway:        ${railwayCategories.length} categorias`);
  
  if (localCategories.length > 0) {
    console.log('\n   Categorias locais:');
    localCategories.forEach(c => console.log(`   - ${c.name}`));
  }
  
  if (railwayCategories.length > 0) {
    console.log('\n   Categorias Railway:');
    railwayCategories.forEach(c => console.log(`   - ${c.name}`));
  }

  // ============ CLIENTES ============
  console.log('\n👥 CLIENTES');
  console.log('-'.repeat(40));
  
  const localCustomers = db.prepare('SELECT id, full_name, phone FROM customers ORDER BY full_name').all();
  const railwayCustomers = await fetchAPI('/customers');
  
  console.log(`   Local (SQLite): ${localCustomers.length} clientes`);
  console.log(`   Railway:        ${railwayCustomers.length} clientes`);
  
  if (localCustomers.length > 0) {
    console.log('\n   Clientes locais:');
    localCustomers.slice(0, 10).forEach(c => console.log(`   - ${c.full_name} (${c.phone || 'sem tel'})`));
  }
  
  if (railwayCustomers.length > 0) {
    console.log('\n   Clientes Railway:');
    railwayCustomers.slice(0, 10).forEach(c => console.log(`   - ${c.fullName} (${c.phone || 'sem tel'})`));
  }

  // ============ VENDAS ============
  console.log('\n💰 VENDAS');
  console.log('-'.repeat(40));
  
  const localSales = db.prepare('SELECT id, sale_number, total, status, created_at FROM sales ORDER BY created_at DESC').all();
  const railwaySales = await fetchAPI('/sales');
  
  console.log(`   Local (SQLite): ${localSales.length} vendas`);
  console.log(`   Railway:        ${railwaySales.length} vendas`);
  
  const localSalesTotal = localSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const railwaySalesTotal = railwaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  
  console.log(`\n   Total vendas local:   ${localSalesTotal.toLocaleString()} FCFA`);
  console.log(`   Total vendas Railway: ${railwaySalesTotal.toLocaleString()} FCFA`);

  // ============ INVENTÁRIO ============
  console.log('\n📊 INVENTÁRIO');
  console.log('-'.repeat(40));
  
  const localInventory = db.prepare(`
    SELECT i.id, p.name as product_name, i.qty_units 
    FROM inventory i 
    LEFT JOIN products p ON i.product_id = p.id 
    ORDER BY p.name
  `).all();
  const railwayInventory = await fetchAPI('/inventory');
  
  console.log(`   Local (SQLite): ${localInventory.length} itens`);
  console.log(`   Railway:        ${railwayInventory.length} itens`);
  
  if (localInventory.length > 0) {
    console.log('\n   Inventário local:');
    localInventory.forEach(i => console.log(`   - ${i.product_name || 'Produto'}: ${i.qty_units} unidades`));
  }
  
  if (railwayInventory.length > 0) {
    console.log('\n   Inventário Railway:');
    railwayInventory.forEach(i => console.log(`   - ${i.product?.name || 'Produto'}: ${i.qtyUnits} unidades`));
  }

  // ============ USUÁRIOS ============
  console.log('\n👤 USUÁRIOS');
  console.log('-'.repeat(40));
  
  const localUsers = db.prepare('SELECT id, email, full_name, role FROM users ORDER BY full_name').all();
  const railwayUsers = await fetchAPI('/users');
  
  console.log(`   Local (SQLite): ${localUsers.length} usuários`);
  console.log(`   Railway:        ${railwayUsers.length} usuários`);
  
  if (localUsers.length > 0) {
    console.log('\n   Usuários locais:');
    localUsers.forEach(u => console.log(`   - ${u.full_name} (${u.email}) - ${u.role}`));
  }
  
  if (railwayUsers.length > 0) {
    console.log('\n   Usuários Railway:');
    railwayUsers.forEach(u => console.log(`   - ${u.fullName} (${u.email}) - ${u.role}`));
  }

  // ============ SYNC QUEUE ============
  console.log('\n🔄 FILA DE SINCRONIZAÇÃO');
  console.log('-'.repeat(40));
  
  try {
    const pendingSync = db.prepare('SELECT * FROM sync_queue WHERE status = "pending" ORDER BY created_at').all();
    console.log(`   Itens pendentes: ${pendingSync.length}`);
    
    if (pendingSync.length > 0) {
      console.log('\n   Pendentes:');
      pendingSync.slice(0, 10).forEach(s => console.log(`   - ${s.table_name}/${s.record_id} (${s.operation})`));
    }
    
    const failedSync = db.prepare('SELECT * FROM sync_queue WHERE status = "failed" ORDER BY created_at DESC LIMIT 5').all();
    if (failedSync.length > 0) {
      console.log(`\n   ❌ Itens com falha: ${failedSync.length}`);
      failedSync.forEach(s => console.log(`   - ${s.table_name}/${s.record_id}: ${s.error_message || 'sem erro'}`));
    }
  } catch (e) {
    console.log('   Tabela sync_queue não existe ou está vazia');
  }

  // ============ RESUMO ============
  console.log('\n' + '='.repeat(60));
  console.log('RESUMO DA COMPARAÇÃO');
  console.log('='.repeat(60));
  
  const comparison = [
    { name: 'Produtos', local: localProducts.length, railway: railwayProducts.length },
    { name: 'Categorias', local: localCategories.length, railway: railwayCategories.length },
    { name: 'Clientes', local: localCustomers.length, railway: railwayCustomers.length },
    { name: 'Vendas', local: localSales.length, railway: railwaySales.length },
    { name: 'Inventário', local: localInventory.length, railway: railwayInventory.length },
    { name: 'Usuários', local: localUsers.length, railway: railwayUsers.length },
  ];
  
  console.log('\n   Entidade      | Local | Railway | Status');
  console.log('   ' + '-'.repeat(50));
  
  comparison.forEach(c => {
    const status = c.local === c.railway ? '✅ OK' : (c.local > c.railway ? '⚠️ Local > Railway' : '⚠️ Railway > Local');
    console.log(`   ${c.name.padEnd(12)} | ${String(c.local).padStart(5)} | ${String(c.railway).padStart(7)} | ${status}`);
  });

  db.close();
  console.log('\n✅ Verificação concluída!\n');
}

main().catch(console.error);
