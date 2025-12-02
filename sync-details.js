/**
 * Análise Detalhada de Discrepâncias e Correção
 * Verifica quais itens específicos faltam em cada lado
 */

const https = require('https');
const path = require('path');
const Database = require('better-sqlite3');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const LOCAL_DB_PATH = path.join(process.env.APPDATA || '', '@barmanager/desktop/barmanager.db');

let token = null;

async function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(RAILWAY_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  const result = await apiRequest('POST', '/auth/login', {
    email: 'analyzer@barmanager.com',
    password: 'Analyzer2025!'
  });
  console.log('Login response:', result.status, result.data?.accessToken ? 'token OK' : 'no token');
  if (result.data && result.data.accessToken) {
    token = result.data.accessToken;
    return true;
  }
  return false;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ANÁLISE DETALHADA DE DISCREPÂNCIAS - BarManager Pro         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Conectar ao banco local
  const db = new Database(LOCAL_DB_PATH, { readonly: true });

  // Login no Railway
  console.log('\n🔐 Autenticando...');
  if (!await login()) {
    console.log('❌ Falha na autenticação');
    return;
  }
  console.log('✅ Autenticado!\n');

  // ============ CATEGORIAS ============
  console.log('═'.repeat(60));
  console.log('📂 ANÁLISE DE CATEGORIAS');
  console.log('═'.repeat(60));

  const localCategories = db.prepare('SELECT * FROM categories').all();
  const railwayCategories = (await apiRequest('GET', '/categories')).data;
  const railwayCatArray = Array.isArray(railwayCategories) ? railwayCategories : [];

  console.log(`\n📍 LOCAL (${localCategories.length} categorias):`);
  for (const cat of localCategories) {
    console.log(`  - [${cat.id.substring(0,8)}...] ${cat.name}`);
  }

  console.log(`\n☁️ RAILWAY (${railwayCatArray.length} categorias):`);
  for (const cat of railwayCatArray) {
    console.log(`  - [${cat.id.substring(0,8)}...] ${cat.name}`);
  }

  const railwayCatIds = new Set(railwayCatArray.map(c => c.id));
  const missingInRailway = localCategories.filter(c => !railwayCatIds.has(c.id));

  if (missingInRailway.length > 0) {
    console.log(`\n⚠️ CATEGORIAS FALTANDO NO RAILWAY (${missingInRailway.length}):`);
    for (const cat of missingInRailway) {
      console.log(`  ❌ [${cat.id}] ${cat.name}`);
    }
  }

  // ============ PRODUTOS ============
  console.log('\n' + '═'.repeat(60));
  console.log('📦 ANÁLISE DE PRODUTOS');
  console.log('═'.repeat(60));

  const localProducts = db.prepare('SELECT * FROM products').all();
  const railwayProducts = (await apiRequest('GET', '/products')).data;
  const railwayProdArray = Array.isArray(railwayProducts) ? railwayProducts : [];

  console.log(`\n📍 LOCAL (${localProducts.length} produtos):`);
  for (const prod of localProducts) {
    console.log(`  - [${prod.id.substring(0,8)}...] ${prod.name} (SKU: ${prod.sku || 'N/A'})`);
  }

  console.log(`\n☁️ RAILWAY (${railwayProdArray.length} produtos):`);
  for (const prod of railwayProdArray) {
    console.log(`  - [${prod.id.substring(0,8)}...] ${prod.name} (SKU: ${prod.sku || 'N/A'})`);
  }

  const railwayProdIds = new Set(railwayProdArray.map(p => p.id));
  const missingProdsInRailway = localProducts.filter(p => !railwayProdIds.has(p.id));

  if (missingProdsInRailway.length > 0) {
    console.log(`\n⚠️ PRODUTOS FALTANDO NO RAILWAY (${missingProdsInRailway.length}):`);
    for (const prod of missingProdsInRailway) {
      console.log(`  ❌ [${prod.id}] ${prod.name}`);
    }
  }

  // ============ FILA DE SYNC ============
  console.log('\n' + '═'.repeat(60));
  console.log('📤 ANÁLISE DA FILA DE SINCRONIZAÇÃO');
  console.log('═'.repeat(60));

  const syncQueue = db.prepare('SELECT * FROM sync_queue ORDER BY created_at DESC').all();
  
  if (syncQueue.length === 0) {
    console.log('\n✅ Fila vazia - todos os itens foram processados!');
  } else {
    console.log(`\nTotal de itens na fila: ${syncQueue.length}`);
    
    // Agrupar por status
    const byStatus = {};
    for (const item of syncQueue) {
      byStatus[item.status] = byStatus[item.status] || [];
      byStatus[item.status].push(item);
    }

    for (const [status, items] of Object.entries(byStatus)) {
      const icon = status === 'synced' ? '✅' : status === 'failed' ? '❌' : '⏳';
      console.log(`\n${icon} ${status.toUpperCase()} (${items.length}):`);
      
      for (const item of items.slice(0, 5)) {
        let data = {};
        try { data = JSON.parse(item.data); } catch (e) {}
        console.log(`  - [${item.entity}/${item.operation}] ID: ${item.entity_id || data.id || 'N/A'}`);
        if (item.error) {
          console.log(`    Erro: ${item.error}`);
        }
      }
      if (items.length > 5) {
        console.log(`    ... e mais ${items.length - 5} itens`);
      }
    }
  }

  // ============ VERIFICAÇÃO DE INTEGRIDADE ============
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 VERIFICAÇÃO DE INTEGRIDADE');
  console.log('═'.repeat(60));

  // Verificar se produtos referenciam categorias válidas
  console.log('\n📦 Produtos com categoria inválida:');
  let invalidCatProducts = 0;
  for (const prod of localProducts) {
    if (prod.category_id) {
      const catExists = localCategories.find(c => c.id === prod.category_id);
      if (!catExists) {
        console.log(`  ⚠️ ${prod.name} referencia categoria inexistente: ${prod.category_id}`);
        invalidCatProducts++;
      }
    }
  }
  if (invalidCatProducts === 0) {
    console.log('  ✅ Todos os produtos têm categorias válidas');
  }

  // Verificar vendas
  const localSales = db.prepare('SELECT * FROM sales').all();
  const localSaleItems = db.prepare('SELECT * FROM sale_items').all();
  
  console.log('\n🛒 Verificação de vendas:');
  console.log(`  - Vendas: ${localSales.length}`);
  console.log(`  - Itens de venda: ${localSaleItems.length}`);
  
  // Verificar se todos os itens têm venda correspondente
  const saleIds = new Set(localSales.map(s => s.id));
  const orphanItems = localSaleItems.filter(i => !saleIds.has(i.sale_id));
  if (orphanItems.length > 0) {
    console.log(`  ⚠️ ${orphanItems.length} itens órfãos (sem venda correspondente)`);
  } else {
    console.log('  ✅ Todos os itens têm venda correspondente');
  }

  // ============ RESUMO E AÇÕES RECOMENDADAS ============
  console.log('\n' + '═'.repeat(60));
  console.log('📋 RESUMO E AÇÕES RECOMENDADAS');
  console.log('═'.repeat(60));

  const actions = [];

  if (missingInRailway.length > 0) {
    actions.push({
      priority: 'HIGH',
      action: `Sincronizar ${missingInRailway.length} categorias para o Railway`,
      command: 'POST /categories para cada categoria faltante'
    });
  }

  if (missingProdsInRailway.length > 0) {
    actions.push({
      priority: 'HIGH', 
      action: `Sincronizar ${missingProdsInRailway.length} produtos para o Railway`,
      command: 'POST /products para cada produto faltante'
    });
  }

  if (actions.length === 0) {
    console.log('\n✅ Nenhuma ação necessária - bancos estão sincronizados!');
  } else {
    console.log('\n🔧 Ações necessárias:');
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      console.log(`  ${i+1}. [${a.priority}] ${a.action}`);
    }
    
    console.log('\n❓ Deseja executar a sincronização automática? (use --sync para executar)');
  }

  // ============ VERIFICAR SE DEVE SINCRONIZAR ============
  if (process.argv.includes('--sync')) {
    console.log('\n' + '═'.repeat(60));
    console.log('🔄 EXECUTANDO SINCRONIZAÇÃO AUTOMÁTICA');
    console.log('═'.repeat(60));

    // Sincronizar categorias
    if (missingInRailway.length > 0) {
      console.log('\n📂 Sincronizando categorias...');
      for (const cat of missingInRailway) {
        const payload = {
          id: cat.id,
          name: cat.name,
          description: cat.description || '',
          sortOrder: cat.sort_order || 0,
          isActive: cat.is_active === 1
        };
        
        const result = await apiRequest('POST', '/categories', payload);
        if (result.status === 201 || result.status === 200) {
          console.log(`  ✅ ${cat.name} sincronizada`);
        } else {
          console.log(`  ❌ ${cat.name}: ${result.data.message || result.status}`);
        }
      }
    }

    // Sincronizar produtos
    if (missingProdsInRailway.length > 0) {
      console.log('\n📦 Sincronizando produtos...');
      for (const prod of missingProdsInRailway) {
        const payload = {
          id: prod.id,
          name: prod.name,
          sku: prod.sku,
          barcode: prod.barcode,
          description: prod.description,
          categoryId: prod.category_id,
          priceUnit: prod.price_unit || 0,
          priceBox: prod.price_box || 0,
          costUnit: prod.cost_unit || 0,
          costBox: prod.cost_box || 0,
          unitsPerBox: prod.units_per_box || 1,
          isActive: prod.is_active === 1
        };
        
        const result = await apiRequest('POST', '/products', payload);
        if (result.status === 201 || result.status === 200) {
          console.log(`  ✅ ${prod.name} sincronizado`);
        } else {
          console.log(`  ❌ ${prod.name}: ${result.data.message || result.status}`);
        }
      }
    }

    console.log('\n✅ Sincronização concluída!');
  }

  db.close();
  console.log('\n' + '═'.repeat(60));
}

main().catch(console.error);
