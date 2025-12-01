/**
 * Script de Análise Completa de Sincronização
 * Compara banco local SQLite (Electron) com PostgreSQL (Railway)
 * 
 * Execute com: node analyze-sync.js
 */

const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Configurações
const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const LOCAL_DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

// Credenciais para autenticação
const CREDENTIALS = {
  email: 'sync-analyzer@barmanager.com',
  password: 'Sync123!'
};

let token = null;

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
    const db = new Database(LOCAL_DB_PATH, { readonly: true });
    console.log('✅ Banco local aberto com sucesso!');
    return db;
  } catch (error) {
    console.error('❌ Erro ao abrir banco local:', error.message);
    return null;
  }
}

function getLocalTableCount(db, tableName) {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    return result.count;
  } catch (error) {
    return { error: error.message };
  }
}

function getLocalTableData(db, tableName, limit = 1000) {
  try {
    return db.prepare(`SELECT * FROM ${tableName} LIMIT ${limit}`).all();
  } catch (error) {
    return { error: error.message };
  }
}

function getLocalSyncQueueStatus(db) {
  try {
    const pending = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`).get();
    const failed = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'`).get();
    const completed = db.prepare(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'completed'`).get();
    
    const pendingItems = db.prepare(`
      SELECT entity, operation, created_at, last_error 
      FROM sync_queue 
      WHERE status = 'pending' OR status = 'failed'
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();
    
    return {
      pending: pending.count,
      failed: failed.count,
      completed: completed.count,
      items: pendingItems
    };
  } catch (error) {
    return { error: error.message };
  }
}

function getLocalLastSync(db) {
  try {
    const result = db.prepare(`SELECT value FROM settings WHERE key = 'last_sync'`).get();
    return result ? result.value : null;
  } catch (error) {
    return null;
  }
}

function compareIds(localItems, railwayItems) {
  const localIds = new Set(localItems.map(item => item.id));
  const railwayIds = new Set(railwayItems.map(item => item.id));
  
  const onlyLocal = [...localIds].filter(id => !railwayIds.has(id));
  const onlyRailway = [...railwayIds].filter(id => !localIds.has(id));
  const both = [...localIds].filter(id => railwayIds.has(id));
  
  return { onlyLocal, onlyRailway, both };
}

// ============================================
// ANÁLISE PRINCIPAL
// ============================================

async function analyzeSync() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     ANÁLISE COMPLETA DE SINCRONIZAÇÃO - BarManager Pro         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\n📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  
  // 1. Login no Railway
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n⚠️ Não foi possível conectar ao Railway. Análise parcial apenas do banco local.');
  }
  
  // 2. Abrir banco local
  const db = openLocalDb();
  if (!db) {
    console.log('\n⚠️ Banco local não encontrado. Verificar se app Electron foi executado.');
    console.log(`   Caminho esperado: ${LOCAL_DB_PATH}`);
    return;
  }
  
  // 3. Análise do banco local
  console.log('\n' + '═'.repeat(60));
  console.log('📁 ANÁLISE DO BANCO LOCAL (SQLite)');
  console.log('═'.repeat(60));
  
  const localTables = [
    'branches', 'users', 'categories', 'suppliers', 'products', 
    'customers', 'inventory_items', 'sales', 'sale_items', 
    'payments', 'cash_boxes', 'debts', 'tables', 'sync_queue'
  ];
  
  const localStats = {};
  for (const table of localTables) {
    const count = getLocalTableCount(db, table);
    localStats[table] = count;
    const status = typeof count === 'number' 
      ? (count > 0 ? `✅ ${count}` : `⚪ ${count}`) 
      : `❌ ${count.error}`;
    console.log(`   ${table.padEnd(20)} ${status}`);
  }
  
  // 4. Status da fila de sincronização
  console.log('\n' + '─'.repeat(60));
  console.log('📤 FILA DE SINCRONIZAÇÃO');
  console.log('─'.repeat(60));
  
  const syncQueue = getLocalSyncQueueStatus(db);
  if (syncQueue.error) {
    console.log(`   ❌ Erro: ${syncQueue.error}`);
  } else {
    console.log(`   Pendentes: ${syncQueue.pending}`);
    console.log(`   Falhos:    ${syncQueue.failed}`);
    console.log(`   Completos: ${syncQueue.completed}`);
    
    if (syncQueue.items.length > 0) {
      console.log('\n   Itens pendentes/falhos:');
      for (const item of syncQueue.items) {
        console.log(`   - [${item.operation}] ${item.entity} (${item.created_at})`);
        if (item.last_error) {
          console.log(`     Erro: ${item.last_error}`);
        }
      }
    }
  }
  
  // 5. Última sincronização
  const lastSync = getLocalLastSync(db);
  console.log(`\n   Última sincronização: ${lastSync || 'Nunca sincronizado'}`);
  
  // 6. Análise do Railway
  if (loginSuccess) {
    console.log('\n' + '═'.repeat(60));
    console.log('☁️  ANÁLISE DO BANCO RAILWAY (PostgreSQL)');
    console.log('═'.repeat(60));
    
    const railwayEndpoints = [
      { name: 'branches', endpoint: '/branches' },
      { name: 'users', endpoint: '/users' },
      { name: 'categories', endpoint: '/products/categories' },
      { name: 'suppliers', endpoint: '/suppliers' },
      { name: 'products', endpoint: '/products' },
      { name: 'customers', endpoint: '/customers' },
      { name: 'sales', endpoint: '/sales' },
    ];
    
    const railwayStats = {};
    for (const { name, endpoint } of railwayEndpoints) {
      const data = await fetchFromRailway(endpoint);
      if (data.error) {
        railwayStats[name] = { error: data.error };
        console.log(`   ${name.padEnd(20)} ❌ ${data.error}`);
      } else {
        railwayStats[name] = data;
        console.log(`   ${name.padEnd(20)} ✅ ${data.length}`);
      }
    }
    
    // 7. Comparação detalhada
    console.log('\n' + '═'.repeat(60));
    console.log('🔄 COMPARAÇÃO LOCAL vs RAILWAY');
    console.log('═'.repeat(60));
    
    const entitiesToCompare = ['branches', 'categories', 'products', 'customers', 'suppliers'];
    
    for (const entity of entitiesToCompare) {
      const localData = getLocalTableData(db, entity);
      const railwayData = railwayStats[entity];
      
      if (localData.error || railwayData?.error) {
        console.log(`\n   ${entity}: ⚠️ Não foi possível comparar`);
        continue;
      }
      
      if (!Array.isArray(railwayData)) {
        console.log(`\n   ${entity}: ⚠️ Dados Railway não disponíveis`);
        continue;
      }
      
      const comparison = compareIds(localData, railwayData);
      
      console.log(`\n   📋 ${entity.toUpperCase()}`);
      console.log(`   ├── Local apenas:   ${comparison.onlyLocal.length}`);
      console.log(`   ├── Railway apenas: ${comparison.onlyRailway.length}`);
      console.log(`   └── Em ambos:       ${comparison.both.length}`);
      
      if (comparison.onlyLocal.length > 0 && comparison.onlyLocal.length <= 5) {
        console.log(`       IDs só local: ${comparison.onlyLocal.join(', ')}`);
      }
      if (comparison.onlyRailway.length > 0 && comparison.onlyRailway.length <= 5) {
        console.log(`       IDs só Railway: ${comparison.onlyRailway.join(', ')}`);
      }
    }
    
    // 8. Verificar dados críticos
    console.log('\n' + '═'.repeat(60));
    console.log('⚠️  VERIFICAÇÕES CRÍTICAS');
    console.log('═'.repeat(60));
    
    // Verificar Branch
    const localBranches = getLocalTableData(db, 'branches');
    const railwayBranches = railwayStats.branches;
    
    if (!localBranches.error && Array.isArray(railwayBranches)) {
      if (localBranches.length === 0 && railwayBranches.length > 0) {
        console.log('   🔴 CRÍTICO: Nenhuma filial no banco local!');
        console.log('      Railway tem:', railwayBranches.map(b => b.name || b.code).join(', '));
      } else if (localBranches.length > 0) {
        console.log('   ✅ Filiais configuradas no local:', localBranches.map(b => b.name || b.code).join(', '));
      }
    }
    
    // Verificar Produtos
    const localProducts = getLocalTableData(db, 'products');
    const railwayProducts = railwayStats.products;
    
    if (!localProducts.error && Array.isArray(railwayProducts)) {
      if (localProducts.length === 0 && railwayProducts.length > 0) {
        console.log('   🔴 CRÍTICO: Nenhum produto no banco local!');
        console.log(`      Railway tem: ${railwayProducts.length} produtos`);
      } else if (localProducts.length > 0) {
        console.log(`   ✅ Produtos no local: ${localProducts.length}`);
      }
    }
    
    // Verificar Users com senha
    const localUsers = getLocalTableData(db, 'users');
    if (!localUsers.error) {
      const usersWithPassword = localUsers.filter(u => u.password_hash);
      console.log(`   📋 Usuários locais: ${localUsers.length} (${usersWithPassword.length} com senha para login offline)`);
    }
  }
  
  // 9. Recomendações
  console.log('\n' + '═'.repeat(60));
  console.log('📝 RECOMENDAÇÕES');
  console.log('═'.repeat(60));
  
  const recommendations = [];
  
  if (syncQueue.pending > 0 || syncQueue.failed > 0) {
    recommendations.push('- Existem itens pendentes na fila de sincronização. Execute o app Electron com conexão para sincronizar.');
  }
  
  if (localStats.products === 0) {
    recommendations.push('- O banco local não tem produtos. Faça login online no Electron para baixar os dados.');
  }
  
  if (localStats.branches === 0) {
    recommendations.push('- O banco local não tem filiais. Isso é necessário para vendas funcionarem.');
  }
  
  if (!lastSync) {
    recommendations.push('- Nunca foi feita uma sincronização completa. Execute o app com internet.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Sistema parece estar configurado corretamente!');
  }
  
  for (const rec of recommendations) {
    console.log(`   ${rec}`);
  }
  
  // Fechar banco
  db.close();
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ ANÁLISE CONCLUÍDA');
  console.log('═'.repeat(60));
}

// Executar
analyzeSync().catch(console.error);
