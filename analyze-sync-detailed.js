/**
 * Script de Análise Detalhada de Sincronização v2
 * Compara banco local SQLite (Electron) com PostgreSQL (Railway)
 * Inclui análise detalhada de divergências e problemas
 * 
 * Execute com: node analyze-sync-detailed.js
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Configurações
const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const LOCAL_DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

// Credenciais para autenticação
const CREDENTIALS = {
  email: 'sync-analyzer@barmanager.com',
  password: 'Sync123!'
};

let token = null;
let db = null;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function login() {
  console.log('\n🔐 Autenticando no Railway...');
  try {
    const response = await axios.post(`${RAILWAY_URL}/auth/login`, CREDENTIALS);
    token = response.data.accessToken;
    console.log('✅ Login bem-sucedido!');
    return true;
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data?.message || error.message);
    return false;
  }
}

async function fetchFromRailway(endpoint) {
  try {
    const response = await axios.get(`${RAILWAY_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    });
    return Array.isArray(response.data) ? response.data : response.data?.data || [];
  } catch (error) {
    if (error.response?.status === 404) {
      return { error: 'Endpoint não encontrado (404)' };
    }
    if (error.response?.status === 403) {
      return { error: 'Sem permissão (403)' };
    }
    return { error: error.message };
  }
}

function openLocalDb() {
  try {
    db = new Database(LOCAL_DB_PATH, { readonly: true });
    console.log('✅ Banco local aberto com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao abrir banco local:', error.message);
    return false;
  }
}

function queryLocal(sql, params = []) {
  try {
    return db.prepare(sql).all(...params);
  } catch (error) {
    return { error: error.message };
  }
}

function queryLocalOne(sql, params = []) {
  try {
    return db.prepare(sql).get(...params);
  } catch (error) {
    return { error: error.message };
  }
}

// ============================================
// ANÁLISE DETALHADA
// ============================================

async function analyzeCategories() {
  console.log('\n' + '═'.repeat(70));
  console.log('📂 ANÁLISE DETALHADA: CATEGORIAS');
  console.log('═'.repeat(70));
  
  // Local
  const localCategories = queryLocal('SELECT * FROM categories ORDER BY name');
  console.log(`\n📁 LOCAL: ${localCategories.length} categorias`);
  
  // Agrupar por is_active
  const activeLocal = localCategories.filter(c => c.is_active === 1);
  const inactiveLocal = localCategories.filter(c => c.is_active !== 1);
  console.log(`   - Ativas: ${activeLocal.length}`);
  console.log(`   - Inativas: ${inactiveLocal.length}`);
  
  // Verificar sincronização local
  const syncedLocal = localCategories.filter(c => c.synced === 1);
  const notSyncedLocal = localCategories.filter(c => c.synced !== 1);
  console.log(`   - Sincronizadas: ${syncedLocal.length}`);
  console.log(`   - Não sincronizadas: ${notSyncedLocal.length}`);
  
  // Railway
  const railwayCategories = await fetchFromRailway('/categories');
  if (railwayCategories.error) {
    console.log(`\n☁️ RAILWAY: ❌ ${railwayCategories.error}`);
  } else {
    console.log(`\n☁️ RAILWAY: ${railwayCategories.length} categorias`);
    if (railwayCategories.length > 0) {
      console.log('   Categorias no Railway:');
      for (const cat of railwayCategories.slice(0, 10)) {
        console.log(`   - ${cat.name} (${cat.id})`);
      }
      if (railwayCategories.length > 10) {
        console.log(`   ... e mais ${railwayCategories.length - 10}`);
      }
    }
  }
  
  // Listar categorias não sincronizadas (amostra)
  if (notSyncedLocal.length > 0) {
    console.log('\n⚠️ Amostra de categorias locais NÃO SINCRONIZADAS:');
    for (const cat of notSyncedLocal.slice(0, 10)) {
      console.log(`   - ${cat.name} (${cat.id})`);
    }
    if (notSyncedLocal.length > 10) {
      console.log(`   ... e mais ${notSyncedLocal.length - 10}`);
    }
  }
  
  return {
    local: localCategories.length,
    railway: Array.isArray(railwayCategories) ? railwayCategories.length : 0,
    notSynced: notSyncedLocal.length
  };
}

async function analyzeProducts() {
  console.log('\n' + '═'.repeat(70));
  console.log('📦 ANÁLISE DETALHADA: PRODUTOS');
  console.log('═'.repeat(70));
  
  // Local
  const localProducts = queryLocal(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    ORDER BY p.name
  `);
  console.log(`\n📁 LOCAL: ${localProducts.length} produtos`);
  
  // Listar produtos locais
  console.log('   Produtos:');
  for (const prod of localProducts) {
    const synced = prod.synced === 1 ? '✅' : '⚠️';
    console.log(`   ${synced} ${prod.name} - SKU: ${prod.sku} - Preço: ${prod.price_unit}`);
  }
  
  // Railway
  const railwayProducts = await fetchFromRailway('/products');
  if (railwayProducts.error) {
    console.log(`\n☁️ RAILWAY: ❌ ${railwayProducts.error}`);
  } else {
    console.log(`\n☁️ RAILWAY: ${railwayProducts.length} produtos`);
    console.log('   Produtos:');
    for (const prod of railwayProducts) {
      console.log(`   - ${prod.name} - SKU: ${prod.sku} - Preço: ${prod.priceUnit}`);
    }
  }
  
  // Comparar
  if (!railwayProducts.error) {
    const localIds = new Set(localProducts.map(p => p.id));
    const railwayIds = new Set(railwayProducts.map(p => p.id));
    
    const onlyLocal = localProducts.filter(p => !railwayIds.has(p.id));
    const onlyRailway = railwayProducts.filter(p => !localIds.has(p.id));
    
    if (onlyLocal.length > 0) {
      console.log('\n⚠️ Produtos APENAS no LOCAL (não existem no Railway):');
      for (const prod of onlyLocal) {
        console.log(`   - ${prod.name} (${prod.id})`);
      }
    }
    
    if (onlyRailway.length > 0) {
      console.log('\n⚠️ Produtos APENAS no RAILWAY (não existem localmente):');
      for (const prod of onlyRailway) {
        console.log(`   - ${prod.name} (${prod.id})`);
      }
    }
  }
  
  return {
    local: localProducts.length,
    railway: Array.isArray(railwayProducts) ? railwayProducts.length : 0
  };
}

async function analyzeSales() {
  console.log('\n' + '═'.repeat(70));
  console.log('💰 ANÁLISE DETALHADA: VENDAS');
  console.log('═'.repeat(70));
  
  // Local
  const localSales = queryLocal(`
    SELECT s.*, 
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count,
           (SELECT SUM(amount) FROM payments WHERE sale_id = s.id) as total_paid
    FROM sales s 
    ORDER BY s.created_at DESC
    LIMIT 20
  `);
  
  const totalLocalSales = queryLocalOne('SELECT COUNT(*) as count FROM sales');
  const syncedSales = queryLocalOne('SELECT COUNT(*) as count FROM sales WHERE synced = 1');
  const pendingSales = queryLocalOne('SELECT COUNT(*) as count FROM sales WHERE synced = 0');
  
  console.log(`\n📁 LOCAL: ${totalLocalSales.count} vendas total`);
  console.log(`   - Sincronizadas: ${syncedSales.count}`);
  console.log(`   - Não sincronizadas: ${pendingSales.count}`);
  
  // Últimas vendas
  console.log('\n   Últimas 10 vendas:');
  for (const sale of localSales.slice(0, 10)) {
    const synced = sale.synced === 1 ? '✅' : '⚠️';
    console.log(`   ${synced} ${sale.sale_number} - Total: ${sale.total} - Status: ${sale.status} - Itens: ${sale.items_count}`);
  }
  
  // Railway
  const railwaySales = await fetchFromRailway('/sales?limit=50');
  if (railwaySales.error) {
    console.log(`\n☁️ RAILWAY: ❌ ${railwaySales.error}`);
  } else {
    console.log(`\n☁️ RAILWAY: ${railwaySales.length} vendas (últimas 50)`);
    
    // Comparar IDs
    const localIds = new Set(localSales.map(s => s.id));
    const railwayIds = new Set(railwaySales.map(s => s.id));
    
    const matchingCount = [...localIds].filter(id => railwayIds.has(id)).length;
    console.log(`   - Vendas locais presentes no Railway: ${matchingCount}/${localSales.length}`);
  }
  
  return {
    local: totalLocalSales.count,
    synced: syncedSales.count,
    pending: pendingSales.count
  };
}

async function analyzeSyncQueue() {
  console.log('\n' + '═'.repeat(70));
  console.log('📤 ANÁLISE DETALHADA: FILA DE SINCRONIZAÇÃO');
  console.log('═'.repeat(70));
  
  // Estatísticas gerais
  const stats = queryLocal(`
    SELECT status, entity, COUNT(*) as count
    FROM sync_queue
    GROUP BY status, entity
    ORDER BY status, count DESC
  `);
  
  console.log('\n📊 Resumo por Status/Entidade:');
  for (const stat of stats) {
    const icon = stat.status === 'pending' ? '⏳' : stat.status === 'failed' ? '❌' : '✅';
    console.log(`   ${icon} ${stat.status}: ${stat.entity} - ${stat.count} itens`);
  }
  
  // Itens com erro
  const failedItems = queryLocal(`
    SELECT * FROM sync_queue 
    WHERE status = 'failed'
    ORDER BY created_at DESC
  `);
  
  if (failedItems.length > 0) {
    console.log('\n❌ ITENS COM ERRO:');
    for (const item of failedItems) {
      console.log(`\n   Entity: ${item.entity}`);
      console.log(`   Operation: ${item.operation}`);
      console.log(`   Entity ID: ${item.entity_id}`);
      console.log(`   Erro: ${item.last_error}`);
      console.log(`   Retries: ${item.retry_count}`);
      console.log(`   Created: ${item.created_at}`);
      
      // Tentar parsear data para mostrar detalhes
      try {
        const data = JSON.parse(item.data);
        console.log(`   Data (resumo): ${JSON.stringify(data).substring(0, 200)}...`);
      } catch (e) {}
    }
  }
  
  // Itens pendentes
  const pendingItems = queryLocal(`
    SELECT * FROM sync_queue 
    WHERE status = 'pending'
    ORDER BY priority ASC, created_at ASC
    LIMIT 10
  `);
  
  if (pendingItems.length > 0) {
    console.log('\n⏳ ITENS PENDENTES (próximos a sincronizar):');
    for (const item of pendingItems) {
      console.log(`   - [${item.operation}] ${item.entity} (${item.entity_id || 'novo'})`);
    }
  }
  
  return {
    pending: failedItems.length,
    failed: failedItems.length,
    failedItems: failedItems
  };
}

async function analyzeCustomers() {
  console.log('\n' + '═'.repeat(70));
  console.log('👥 ANÁLISE DETALHADA: CLIENTES');
  console.log('═'.repeat(70));
  
  // Local
  const localCustomers = queryLocal('SELECT * FROM customers ORDER BY full_name');
  console.log(`\n📁 LOCAL: ${localCustomers.length} clientes`);
  
  for (const cust of localCustomers) {
    const synced = cust.synced === 1 ? '✅' : '⚠️';
    const debt = cust.current_debt > 0 ? ` (Dívida: ${cust.current_debt})` : '';
    console.log(`   ${synced} ${cust.full_name} - ${cust.code}${debt}`);
  }
  
  // Railway
  const railwayCustomers = await fetchFromRailway('/customers');
  if (railwayCustomers.error) {
    console.log(`\n☁️ RAILWAY: ❌ ${railwayCustomers.error}`);
  } else {
    console.log(`\n☁️ RAILWAY: ${railwayCustomers.length} clientes`);
    for (const cust of railwayCustomers) {
      console.log(`   - ${cust.fullName || cust.full_name} - ${cust.code}`);
    }
  }
}

async function analyzeUsers() {
  console.log('\n' + '═'.repeat(70));
  console.log('👤 ANÁLISE DETALHADA: USUÁRIOS');
  console.log('═'.repeat(70));
  
  // Local
  const localUsers = queryLocal('SELECT id, email, full_name, role, is_active, synced, password_hash FROM users ORDER BY full_name');
  console.log(`\n📁 LOCAL: ${localUsers.length} usuários`);
  
  for (const user of localUsers) {
    const synced = user.synced === 1 ? '✅' : '⚠️';
    const hasPassword = user.password_hash ? '🔐' : '⚠️';
    const active = user.is_active === 1 ? '' : ' [INATIVO]';
    console.log(`   ${synced}${hasPassword} ${user.full_name} (${user.email}) - ${user.role}${active}`);
  }
  
  // Railway
  const railwayUsers = await fetchFromRailway('/users');
  if (railwayUsers.error) {
    console.log(`\n☁️ RAILWAY: ❌ ${railwayUsers.error}`);
  } else {
    console.log(`\n☁️ RAILWAY: ${railwayUsers.length} usuários`);
    for (const user of railwayUsers.slice(0, 10)) {
      console.log(`   - ${user.fullName || user.full_name} (${user.email}) - ${user.role}`);
    }
  }
}

async function analyzeDebts() {
  console.log('\n' + '═'.repeat(70));
  console.log('💳 ANÁLISE DETALHADA: DÍVIDAS');
  console.log('═'.repeat(70));
  
  // Local
  const localDebts = queryLocal(`
    SELECT d.*, c.full_name as customer_name
    FROM debts d
    LEFT JOIN customers c ON d.customer_id = c.id
    ORDER BY d.created_at DESC
  `);
  console.log(`\n📁 LOCAL: ${localDebts.length} dívidas`);
  
  for (const debt of localDebts) {
    const synced = debt.synced === 1 ? '✅' : '⚠️';
    const status = debt.status === 'pending' ? '🔴' : debt.status === 'paid' ? '✅' : '🟡';
    console.log(`   ${synced}${status} ${debt.debt_number} - ${debt.customer_name} - Saldo: ${debt.balance} - Status: ${debt.status}`);
  }
}

async function analyzeBranches() {
  console.log('\n' + '═'.repeat(70));
  console.log('🏢 ANÁLISE DETALHADA: FILIAIS');
  console.log('═'.repeat(70));
  
  // Local
  const localBranches = queryLocal('SELECT * FROM branches');
  console.log(`\n📁 LOCAL: ${localBranches.length} filiais`);
  
  for (const branch of localBranches) {
    const synced = branch.synced === 1 ? '✅' : '⚠️';
    const main = branch.is_main === 1 ? ' [PRINCIPAL]' : '';
    console.log(`   ${synced} ${branch.name} (${branch.code})${main}`);
    console.log(`      ID: ${branch.id}`);
  }
  
  // Railway
  const railwayBranches = await fetchFromRailway('/branches');
  if (railwayBranches.error) {
    console.log(`\n☁️ RAILWAY: ❌ ${railwayBranches.error}`);
  } else {
    console.log(`\n☁️ RAILWAY: ${railwayBranches.length} filiais`);
    for (const branch of railwayBranches) {
      const main = branch.isMain ? ' [PRINCIPAL]' : '';
      console.log(`   - ${branch.name} (${branch.code})${main}`);
      console.log(`      ID: ${branch.id}`);
    }
  }
}

// ============================================
// VERIFICAÇÕES DE INTEGRIDADE
// ============================================

function checkDataIntegrity() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 VERIFICAÇÕES DE INTEGRIDADE');
  console.log('═'.repeat(70));
  
  const issues = [];
  
  // 1. Vendas sem itens
  const salesWithoutItems = queryLocal(`
    SELECT s.id, s.sale_number, s.total 
    FROM sales s 
    LEFT JOIN sale_items si ON s.id = si.sale_id 
    WHERE si.id IS NULL AND s.total > 0
  `);
  if (salesWithoutItems.length > 0) {
    issues.push({
      type: 'CRITICAL',
      message: `${salesWithoutItems.length} vendas com total > 0 mas sem itens`,
      details: salesWithoutItems
    });
  }
  
  // 2. Vendas com customer_id inválido
  const salesInvalidCustomer = queryLocal(`
    SELECT s.id, s.sale_number, s.customer_id
    FROM sales s 
    WHERE s.customer_id IS NOT NULL 
    AND s.customer_id NOT IN (SELECT id FROM customers)
  `);
  if (salesInvalidCustomer.length > 0) {
    issues.push({
      type: 'CRITICAL',
      message: `${salesInvalidCustomer.length} vendas com customer_id inválido`,
      details: salesInvalidCustomer
    });
  }
  
  // 3. Produtos com categoria inválida
  const productsInvalidCategory = queryLocal(`
    SELECT p.id, p.name, p.category_id
    FROM products p 
    WHERE p.category_id IS NOT NULL 
    AND p.category_id NOT IN (SELECT id FROM categories)
  `);
  if (productsInvalidCategory.length > 0) {
    issues.push({
      type: 'WARNING',
      message: `${productsInvalidCategory.length} produtos com category_id inválido`,
      details: productsInvalidCategory
    });
  }
  
  // 4. Itens de venda com produto inválido
  const itemsInvalidProduct = queryLocal(`
    SELECT si.id, si.sale_id, si.product_id
    FROM sale_items si 
    WHERE si.product_id NOT IN (SELECT id FROM products)
  `);
  if (itemsInvalidProduct.length > 0) {
    issues.push({
      type: 'CRITICAL',
      message: `${itemsInvalidProduct.length} itens de venda com product_id inválido`,
      details: itemsInvalidProduct
    });
  }
  
  // 5. Dívidas com cliente inválido
  const debtsInvalidCustomer = queryLocal(`
    SELECT d.id, d.debt_number, d.customer_id
    FROM debts d 
    WHERE d.customer_id NOT IN (SELECT id FROM customers)
  `);
  if (debtsInvalidCustomer.length > 0) {
    issues.push({
      type: 'CRITICAL',
      message: `${debtsInvalidCustomer.length} dívidas com customer_id inválido`,
      details: debtsInvalidCustomer
    });
  }
  
  // Relatório
  if (issues.length === 0) {
    console.log('\n✅ Nenhum problema de integridade encontrado!');
  } else {
    console.log(`\n⚠️ ${issues.length} problemas encontrados:\n`);
    for (const issue of issues) {
      const icon = issue.type === 'CRITICAL' ? '🔴' : '🟡';
      console.log(`${icon} [${issue.type}] ${issue.message}`);
      if (issue.details.length <= 5) {
        for (const detail of issue.details) {
          console.log(`   - ${JSON.stringify(detail)}`);
        }
      }
    }
  }
  
  return issues;
}

// ============================================
// GERAR RECOMENDAÇÕES
// ============================================

function generateRecommendations(analysisResults) {
  console.log('\n' + '═'.repeat(70));
  console.log('📝 RECOMENDAÇÕES DE AÇÃO');
  console.log('═'.repeat(70));
  
  const recommendations = [];
  
  // Categorias não sincronizadas
  if (analysisResults.categories?.notSynced > 0) {
    recommendations.push({
      priority: 'ALTA',
      action: 'Sincronizar categorias',
      description: `${analysisResults.categories.notSynced} categorias locais não estão no Railway. Execute o app Electron online para sincronizar.`
    });
  }
  
  // Fila de sync com erros
  if (analysisResults.syncQueue?.failed > 0) {
    recommendations.push({
      priority: 'CRÍTICA',
      action: 'Resolver erros de sincronização',
      description: `${analysisResults.syncQueue.failed} itens falharam na sincronização. Verifique os erros e corrija os dados.`
    });
  }
  
  // Problemas de integridade
  if (analysisResults.integrity?.length > 0) {
    const critical = analysisResults.integrity.filter(i => i.type === 'CRITICAL');
    if (critical.length > 0) {
      recommendations.push({
        priority: 'CRÍTICA',
        action: 'Corrigir problemas de integridade',
        description: `${critical.length} problemas críticos de integridade encontrados. Corrija antes de sincronizar.`
      });
    }
  }
  
  // Listar
  if (recommendations.length === 0) {
    console.log('\n✅ Sistema parece estar bem configurado!');
  } else {
    console.log('');
    for (const rec of recommendations) {
      const icon = rec.priority === 'CRÍTICA' ? '🔴' : rec.priority === 'ALTA' ? '🟠' : '🟡';
      console.log(`${icon} [${rec.priority}] ${rec.action}`);
      console.log(`   ${rec.description}\n`);
    }
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║      ANÁLISE DETALHADA DE SINCRONIZAÇÃO - BarManager Pro           ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`📁 Banco local: ${LOCAL_DB_PATH}`);
  console.log(`☁️  Railway: ${RAILWAY_URL}`);
  
  // Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n⚠️ Análise continuará apenas com dados locais.');
  }
  
  // Abrir banco local
  if (!openLocalDb()) {
    console.log('\n❌ Não foi possível abrir o banco local. Abortando.');
    return;
  }
  
  const results = {};
  
  try {
    // Análises detalhadas
    await analyzeBranches();
    results.categories = await analyzeCategories();
    results.products = await analyzeProducts();
    await analyzeCustomers();
    await analyzeUsers();
    results.sales = await analyzeSales();
    await analyzeDebts();
    results.syncQueue = await analyzeSyncQueue();
    results.integrity = checkDataIntegrity();
    
    // Recomendações
    generateRecommendations(results);
    
  } finally {
    db.close();
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ ANÁLISE CONCLUÍDA');
  console.log('═'.repeat(70));
}

main().catch(console.error);
