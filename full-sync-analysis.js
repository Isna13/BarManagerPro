/**
 * Análise Completa de Sincronização - BarManager Pro
 * 
 * Este script verifica:
 * 1. Estado do banco local SQLite (Electron)
 * 2. Estado do banco Railway (PostgreSQL)
 * 3. Diferenças entre os bancos
 * 4. Fila de sincronização pendente
 * 5. Problemas potenciais
 * 6. Mapeamento de endpoints
 */

const https = require('https');
const path = require('path');

// Configurações
const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const LOCAL_DB_PATH = path.join(process.env.APPDATA || '', '@barmanager/desktop/barmanager.db');

let token = null;

// =============== FUNÇÕES AUXILIARES ===============

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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            resolve({ error: true, status: res.statusCode, message: json.message || data });
          }
        } catch (e) {
          resolve({ error: true, status: res.statusCode, message: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  console.log('\n🔐 Autenticando no Railway...');
  
  // Tentar com usuário existente
  const users = [
    { email: 'admin@barmanager.com', password: 'Admin123!' },
    { email: 'owner@barmanager.com', password: 'Owner123!' },
    { email: 'teste@barmanager.com', password: 'Teste123!' },
  ];
  
  for (const creds of users) {
    const result = await apiRequest('POST', '/auth/login', creds);
    
    if (result.accessToken) {
      token = result.accessToken;
      console.log(`✅ Autenticado como ${creds.email}`);
      return true;
    }
  }
  
  // Nenhum funcionou, tentar criar novo
  console.log('⚠️ Criando novo usuário para análise...');
  const register = await apiRequest('POST', '/auth/register', {
    email: 'analyzer@barmanager.com',
    password: 'Analyzer2025!',
    fullName: 'Sync Analyzer',
    role: 'admin'
  });
  
  if (register.accessToken) {
    token = register.accessToken;
    console.log('✅ Usuário analyzer criado e autenticado!');
    return true;
  }
  
  // Tentar login com o analyzer
  const loginAnalyzer = await apiRequest('POST', '/auth/login', {
    email: 'analyzer@barmanager.com',
    password: 'Analyzer2025!'
  });
  
  if (loginAnalyzer.accessToken) {
    token = loginAnalyzer.accessToken;
    console.log('✅ Autenticado como analyzer');
    return true;
  }
  
  console.error('❌ Falha na autenticação:', register.message || loginAnalyzer.message);
  return false;
}

// =============== ANÁLISE DO BANCO LOCAL ===============

function analyzeLocalDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('📁 ANÁLISE DO BANCO LOCAL (SQLite)');
  console.log('='.repeat(60));
  console.log(`📍 Caminho: ${LOCAL_DB_PATH}`);
  
  const fs = require('fs');
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.log('❌ Banco local NÃO EXISTE!');
    return null;
  }
  
  const fileStats = fs.statSync(LOCAL_DB_PATH);
  console.log(`📊 Tamanho: ${(fileStats.size / 1024).toFixed(2)} KB`);
  console.log(`📅 Última modificação: ${fileStats.mtime.toISOString()}`);
  
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.log('⚠️ better-sqlite3 não disponível, pulando análise local detalhada');
    return null;
  }
  
  const db = new Database(LOCAL_DB_PATH, { readonly: true });
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  console.log(`\n📋 Tabelas encontradas: ${tables.length}`);
  
  const localData = {};
  
  for (const { name } of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get();
    localData[name] = {
      count: count.count,
      sample: null
    };
    
    if (count.count > 0) {
      try {
        localData[name].sample = db.prepare(`SELECT * FROM "${name}" LIMIT 3`).all();
      } catch (e) {
        localData[name].sample = [];
      }
    }
    
    const icon = count.count > 0 ? '✅' : '⚪';
    console.log(`  ${icon} ${name}: ${count.count} registros`);
  }
  
  // Verificar fila de sincronização
  console.log('\n📤 FILA DE SINCRONIZAÇÃO:');
  const syncQueue = db.prepare(`SELECT * FROM sync_queue ORDER BY created_at DESC`).all();
  
  if (syncQueue.length === 0) {
    console.log('  ✅ Fila vazia - tudo sincronizado!');
  } else {
    const pending = syncQueue.filter(s => s.status === 'pending');
    const failed = syncQueue.filter(s => s.status === 'failed');
    const synced = syncQueue.filter(s => s.status === 'synced');
    
    console.log(`  ⏳ Pendentes: ${pending.length}`);
    console.log(`  ❌ Com erro: ${failed.length}`);
    console.log(`  ✅ Sincronizados: ${synced.length}`);
    
    if (failed.length > 0) {
      console.log('\n  🔴 ITENS COM ERRO:');
      for (const item of failed.slice(0, 10)) {
        console.log(`    - [${item.entity}/${item.operation}] ${item.error || 'Sem mensagem'}`);
        try {
          const data = JSON.parse(item.data);
          console.log(`      ID: ${item.entity_id || data.id || 'N/A'}`);
        } catch (e) {}
      }
    }
    
    if (pending.length > 0) {
      console.log('\n  🟡 ITENS PENDENTES:');
      const byEntity = {};
      for (const item of pending) {
        byEntity[item.entity] = (byEntity[item.entity] || 0) + 1;
      }
      for (const [entity, count] of Object.entries(byEntity)) {
        console.log(`    - ${entity}: ${count}`);
      }
    }
  }
  
  // Verificar última sincronização
  try {
    const lastSync = db.prepare(`SELECT value FROM app_config WHERE key = 'last_sync'`).get();
    if (lastSync) {
      console.log(`\n📅 Última sincronização: ${lastSync.value}`);
    }
  } catch (e) {}
  
  db.close();
  return localData;
}

// =============== ANÁLISE DO BANCO RAILWAY ===============

async function analyzeRailwayDatabase() {
  console.log('\n' + '='.repeat(60));
  console.log('☁️ ANÁLISE DO BANCO RAILWAY (PostgreSQL)');
  console.log('='.repeat(60));
  
  const endpoints = [
    { name: 'branches', endpoint: '/branches' },
    { name: 'users', endpoint: '/users' },
    { name: 'categories', endpoint: '/categories' },
    { name: 'products', endpoint: '/products' },
    { name: 'customers', endpoint: '/customers' },
    { name: 'suppliers', endpoint: '/suppliers' },
    { name: 'sales', endpoint: '/sales' },
    { name: 'debts', endpoint: '/debts' },
    { name: 'inventory', endpoint: '/inventory' },
  ];
  
  const railwayData = {};
  
  for (const { name, endpoint } of endpoints) {
    try {
      const result = await apiRequest('GET', endpoint);
      
      if (result.error) {
        console.log(`  ⚠️ ${name}: ${result.status} - ${result.message || 'Erro'}`);
        railwayData[name] = { count: -1, error: result.message };
      } else {
        const items = Array.isArray(result) ? result : result.data || [];
        railwayData[name] = { count: items.length, items };
        console.log(`  ✅ ${name}: ${items.length} registros`);
      }
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      railwayData[name] = { count: -1, error: e.message };
    }
  }
  
  return railwayData;
}

// =============== COMPARAÇÃO DE DADOS ===============

function compareData(localData, railwayData) {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 COMPARAÇÃO LOCAL vs RAILWAY');
  console.log('='.repeat(60));
  
  const mapping = {
    branches: 'branches',
    users: 'users',
    categories: 'categories',
    products: 'products',
    customers: 'customers',
    suppliers: 'suppliers',
    sales: 'sales',
    debts: 'debts',
    inventory_items: 'inventory',
  };
  
  const issues = [];
  
  for (const [localTable, railwayEntity] of Object.entries(mapping)) {
    const local = localData?.[localTable]?.count ?? 0;
    const railway = railwayData?.[railwayEntity]?.count ?? 0;
    
    const diff = local - railway;
    let status = '✅';
    let msg = '';
    
    if (diff > 0) {
      status = '🟡';
      msg = `(${diff} apenas no local)`;
      issues.push({
        type: 'local_only',
        entity: localTable,
        diff
      });
    } else if (diff < 0) {
      status = '🔵';
      msg = `(${Math.abs(diff)} apenas no Railway)`;
      issues.push({
        type: 'railway_only',
        entity: localTable,
        diff: Math.abs(diff)
      });
    }
    
    console.log(`  ${status} ${localTable}: Local(${local}) vs Railway(${railway}) ${msg}`);
  }
  
  return issues;
}

// =============== VERIFICAÇÃO DE ENDPOINTS ===============

async function verifyEndpoints() {
  console.log('\n' + '='.repeat(60));
  console.log('🔌 VERIFICAÇÃO DE ENDPOINTS DO BACKEND');
  console.log('='.repeat(60));
  
  const endpoints = [
    // Auth
    { method: 'POST', path: '/auth/login', desc: 'Login' },
    { method: 'POST', path: '/auth/register', desc: 'Registro' },
    { method: 'GET', path: '/auth/profile', desc: 'Perfil' },
    
    // CRUD básico
    { method: 'GET', path: '/branches', desc: 'Listar filiais' },
    { method: 'GET', path: '/users', desc: 'Listar usuários' },
    { method: 'GET', path: '/categories', desc: 'Listar categorias' },
    { method: 'GET', path: '/products', desc: 'Listar produtos' },
    { method: 'GET', path: '/products/categories', desc: 'Categorias de produtos' },
    { method: 'GET', path: '/customers', desc: 'Listar clientes' },
    { method: 'GET', path: '/suppliers', desc: 'Listar fornecedores' },
    { method: 'GET', path: '/sales', desc: 'Listar vendas' },
    { method: 'GET', path: '/debts', desc: 'Listar dívidas' },
    { method: 'GET', path: '/inventory', desc: 'Listar inventário' },
    { method: 'GET', path: '/inventory/movements', desc: 'Movimentos de inventário' },
    
    // Cash box
    { method: 'GET', path: '/cash-box/current', desc: 'Caixa atual' },
    { method: 'GET', path: '/cash-box/history', desc: 'Histórico de caixa' },
    
    // Sync
    { method: 'GET', path: '/sync/status', desc: 'Status sync' },
    { method: 'GET', path: '/sync/pending', desc: 'Itens pendentes' },
    
    // Health
    { method: 'GET', path: '/health', desc: 'Health check' },
  ];
  
  const results = { ok: [], error: [], notFound: [] };
  
  for (const { method, path, desc } of endpoints) {
    try {
      const result = await apiRequest(method, path);
      
      if (result.error) {
        if (result.status === 404) {
          console.log(`  ❌ ${method} ${path} - 404 NOT FOUND`);
          results.notFound.push({ method, path, desc });
        } else if (result.status === 401) {
          console.log(`  🔒 ${method} ${path} - 401 (requer auth)`);
          results.ok.push({ method, path, desc, note: 'requer auth' });
        } else {
          console.log(`  ⚠️ ${method} ${path} - ${result.status}`);
          results.error.push({ method, path, desc, status: result.status });
        }
      } else {
        console.log(`  ✅ ${method} ${path} - OK`);
        results.ok.push({ method, path, desc });
      }
    } catch (e) {
      console.log(`  ❌ ${method} ${path} - ${e.message}`);
      results.error.push({ method, path, desc, error: e.message });
    }
  }
  
  return results;
}

// =============== VERIFICAÇÃO DE MAPEAMENTO DE ENTIDADES ===============

function verifyEntityMapping() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 MAPEAMENTO DE ENTIDADES (Electron → Backend)');
  console.log('='.repeat(60));
  
  const mapping = {
    // Entidades principais
    'product': { endpoint: '/products', backendEntity: 'product' },
    'customer': { endpoint: '/customers', backendEntity: 'customer' },
    'sale': { endpoint: '/sales', backendEntity: 'sale' },
    'category': { endpoint: '/categories', backendEntity: 'category' },
    'supplier': { endpoint: '/suppliers', backendEntity: 'supplier' },
    'branch': { endpoint: '/branches', backendEntity: 'branch' },
    'user': { endpoint: '/users', backendEntity: 'user' },
    'debt': { endpoint: '/debts', backendEntity: 'debt' },
    
    // Entidades aninhadas/especiais
    'sale_item': { endpoint: '/sales/:saleId/items', note: 'Sub-recurso de sale' },
    'payment': { endpoint: '/sales/:saleId/payments', note: 'Sub-recurso de sale' },
    'cash_box': { endpoint: '/cash-box', note: 'Endpoints especiais: /open, /close' },
    'inventory_item': { endpoint: '/inventory', backendEntity: 'inventoryItem' },
    
    // Entidades que podem causar problemas
    'customer_loyalty': { endpoint: 'N/A', note: '⚠️ Não tem endpoint próprio' },
    'purchase_item': { endpoint: 'N/A', note: '⚠️ Incluído em purchase' },
  };
  
  for (const [entity, config] of Object.entries(mapping)) {
    const note = config.note ? ` (${config.note})` : '';
    console.log(`  ${entity} → ${config.endpoint}${note}`);
  }
  
  console.log('\n⚠️ ENTIDADES SEM MAPEAMENTO DIRETO:');
  console.log('  - sale_item: Deve ser criado junto com a venda');
  console.log('  - payment: Deve ser criado junto com a venda');
  console.log('  - customer_loyalty: Gerenciado via customer');
  console.log('  - purchase_item: Incluído na purchase');
}

// =============== RECOMENDAÇÕES ===============

function generateRecommendations(issues, endpointResults) {
  console.log('\n' + '='.repeat(60));
  console.log('📝 RECOMENDAÇÕES');
  console.log('='.repeat(60));
  
  const recommendations = [];
  
  // Baseado em diferenças de dados
  for (const issue of issues) {
    if (issue.type === 'local_only' && issue.diff > 0) {
      recommendations.push({
        priority: 'HIGH',
        msg: `${issue.diff} ${issue.entity} no local precisam ser sincronizados para Railway`
      });
    }
  }
  
  // Baseado em endpoints não encontrados
  if (endpointResults?.notFound?.length > 0) {
    for (const ep of endpointResults.notFound) {
      recommendations.push({
        priority: 'CRITICAL',
        msg: `Endpoint ${ep.method} ${ep.path} não existe - ${ep.desc}`
      });
    }
  }
  
  if (recommendations.length === 0) {
    console.log('  ✅ Nenhum problema crítico encontrado!');
  } else {
    for (const rec of recommendations) {
      const icon = rec.priority === 'CRITICAL' ? '🔴' : rec.priority === 'HIGH' ? '🟠' : '🟡';
      console.log(`  ${icon} [${rec.priority}] ${rec.msg}`);
    }
  }
  
  return recommendations;
}

// =============== MAIN ===============

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ANÁLISE COMPLETA DE SINCRONIZAÇÃO - BarManager Pro     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`📅 Data: ${new Date().toISOString()}`);
  
  // 1. Analisar banco local
  const localData = analyzeLocalDatabase();
  
  // 2. Login no Railway
  const loggedIn = await login();
  if (!loggedIn) {
    console.log('\n❌ Não foi possível autenticar no Railway. Análise parcial.');
    return;
  }
  
  // 3. Analisar banco Railway
  const railwayData = await analyzeRailwayDatabase();
  
  // 4. Comparar dados
  const issues = compareData(localData, railwayData);
  
  // 5. Verificar endpoints
  const endpointResults = await verifyEndpoints();
  
  // 6. Mostrar mapeamento
  verifyEntityMapping();
  
  // 7. Gerar recomendações
  generateRecommendations(issues, endpointResults);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ ANÁLISE CONCLUÍDA');
  console.log('='.repeat(60));
}

main().catch(console.error);
