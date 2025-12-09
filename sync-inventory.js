/**
 * Script para sincronizar o estoque do banco local SQLite para o servidor Railway PostgreSQL
 * 
 * Este script:
 * 1. Lê todos os itens de inventário do banco local
 * 2. Envia para o servidor Railway
 * 3. Garante que ambos os bancos tenham os mesmos dados de estoque
 */

const https = require('https');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Configurações
const API_BASE = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const LOCAL_DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

// Credenciais (ajuste conforme necessário)
const CREDENTIALS = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Tentar carregar better-sqlite3
let Database;
let db;

function tryLoadDatabase() {
  // Por enquanto, usar apenas sqlite3 CLI pois better-sqlite3 não está compilado
  console.log('ℹ️  Usando sqlite3 CLI para acessar o banco local...');
  return false;
}

// Funções auxiliares para HTTP
function httpRequest(url, options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function login() {
  console.log('🔐 Fazendo login no servidor...');
  const postData = JSON.stringify(CREDENTIALS);
  const response = await httpRequest(API_BASE + '/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
  
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Erro ao fazer login: ${response.raw}`);
  }
  
  console.log('✅ Login realizado com sucesso!');
  return response.data.accessToken;
}

async function getServerInventory(token) {
  console.log('\n📦 Buscando inventário do servidor Railway...');
  const response = await httpRequest(API_BASE + '/inventory', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.status !== 200) {
    throw new Error(`Erro ao buscar inventário: ${response.raw}`);
  }
  
  const items = Array.isArray(response.data) ? response.data : response.data?.data || [];
  console.log(`   Encontrados ${items.length} itens no servidor`);
  return items;
}

function getLocalInventoryViaCLI() {
  console.log('\n📦 Buscando inventário do banco local via sqlite3 CLI...');
  
  // Nota: tabela local não tem qty_boxes nem min_stock
  const query = `
    SELECT 
      i.id,
      i.product_id as productId,
      i.branch_id as branchId,
      COALESCE(i.qty_units, 0) as qtyUnits,
      0 as qtyBoxes,
      COALESCE(i.closed_boxes, 0) as closedBoxes,
      COALESCE(i.open_box_units, 0) as openBoxUnits,
      10 as minStock,
      i.batch_number as batchNumber,
      i.expiry_date as expiryDate,
      i.location,
      COALESCE(i.consumption_avg_7d, 0) as consumptionAvg7d,
      COALESCE(i.consumption_avg_15d, 0) as consumptionAvg15d,
      COALESCE(i.consumption_avg_30d, 0) as consumptionAvg30d,
      i.days_until_stockout as daysUntilStockout,
      COALESCE(i.suggested_reorder, 0) as suggestedReorder,
      i.synced,
      i.last_sync as lastSync,
      i.created_at as createdAt,
      i.updated_at as updatedAt,
      p.name as productName,
      p.sku as productSku
    FROM inventory_items i
    LEFT JOIN products p ON i.product_id = p.id
    ORDER BY p.name;
  `.replace(/\n/g, ' ');
  
  try {
    const result = execSync(`sqlite3 -json "${LOCAL_DB_PATH}" "${query}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    
    const items = JSON.parse(result || '[]');
    console.log(`   Encontrados ${items.length} itens no banco local`);
    return items;
  } catch (e) {
    console.error('Erro ao executar sqlite3:', e.message);
    return [];
  }
}

function getLocalInventory() {
  console.log('\n📦 Buscando inventário do banco local...');
  
  const items = db.prepare(`
    SELECT 
      i.id,
      i.product_id as productId,
      i.branch_id as branchId,
      i.qty_units as qtyUnits,
      i.qty_boxes as qtyBoxes,
      COALESCE(i.closed_boxes, 0) as closedBoxes,
      COALESCE(i.open_box_units, 0) as openBoxUnits,
      COALESCE(i.min_stock, 10) as minStock,
      i.batch_number as batchNumber,
      i.expiry_date as expiryDate,
      i.location,
      COALESCE(i.consumption_avg_7d, 0) as consumptionAvg7d,
      COALESCE(i.consumption_avg_15d, 0) as consumptionAvg15d,
      COALESCE(i.consumption_avg_30d, 0) as consumptionAvg30d,
      i.days_until_stockout as daysUntilStockout,
      COALESCE(i.suggested_reorder, 0) as suggestedReorder,
      i.synced,
      i.last_sync as lastSync,
      i.created_at as createdAt,
      i.updated_at as updatedAt,
      p.name as productName,
      p.sku as productSku
    FROM inventory_items i
    LEFT JOIN products p ON i.product_id = p.id
    ORDER BY p.name
  `).all();
  
  console.log(`   Encontrados ${items.length} itens no banco local`);
  return items;
}

async function syncInventoryItem(token, item) {
  // Primeiro, tentar criar/atualizar o item no servidor
  const itemData = {
    id: item.id,
    productId: item.productId,
    branchId: item.branchId,
    qtyUnits: item.qtyUnits || 0,
    qtyBoxes: item.qtyBoxes || 0,
    closedBoxes: item.closedBoxes || 0,
    openBoxUnits: item.openBoxUnits || 0,
    minStock: item.minStock || 10,
    batchNumber: item.batchNumber || null,
    expiryDate: item.expiryDate || null,
    location: item.location || null,
    consumptionAvg7d: item.consumptionAvg7d || 0,
    consumptionAvg15d: item.consumptionAvg15d || 0,
    consumptionAvg30d: item.consumptionAvg30d || 0,
    daysUntilStockout: item.daysUntilStockout || null,
    suggestedReorder: item.suggestedReorder || 0
  };
  
  const postData = JSON.stringify(itemData);
  
  // Tentar PUT primeiro (update)
  let response = await httpRequest(API_BASE + '/inventory/' + item.id, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
  
  if (response.status === 404) {
    // Item não existe, criar com POST
    response = await httpRequest(API_BASE + '/inventory', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
  }
  
  return response;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   SINCRONIZAÇÃO DE ESTOQUE - Local → Railway');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📁 Banco local: ${LOCAL_DB_PATH}`);
  
  // Verificar se o banco local existe
  const fs = require('fs');
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.error('❌ Banco de dados local não encontrado!');
    process.exit(1);
  }
  
  // Tentar carregar better-sqlite3
  const useBetterSqlite = tryLoadDatabase();
  let localItems;
  
  if (useBetterSqlite) {
    db = new Database(LOCAL_DB_PATH, { readonly: true });
  }
  
  try {
    // Login no servidor
    const token = await login();
    
    // Buscar inventários
    if (useBetterSqlite) {
      localItems = getLocalInventory();
    } else {
      localItems = getLocalInventoryViaCLI();
    }
    
    const serverItems = await getServerInventory(token);
    
    // Criar mapa de itens do servidor por ID
    const serverItemsMap = new Map();
    serverItems.forEach(item => serverItemsMap.set(item.id, item));
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   COMPARAÇÃO DE ESTOQUE');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Encontrar diferenças
    const toSync = [];
    const onlyLocal = [];
    const differences = [];
    
    for (const localItem of localItems) {
      const serverItem = serverItemsMap.get(localItem.id);
      
      if (!serverItem) {
        onlyLocal.push(localItem);
        toSync.push({ item: localItem, action: 'create' });
      } else {
        // Comparar quantidades
        if (localItem.qtyUnits !== serverItem.qtyUnits || 
            localItem.qtyBoxes !== serverItem.qtyBoxes ||
            localItem.closedBoxes !== serverItem.closedBoxes ||
            localItem.openBoxUnits !== serverItem.openBoxUnits) {
          differences.push({
            productName: localItem.productName,
            local: {
              qtyUnits: localItem.qtyUnits,
              qtyBoxes: localItem.qtyBoxes,
              closedBoxes: localItem.closedBoxes,
              openBoxUnits: localItem.openBoxUnits
            },
            server: {
              qtyUnits: serverItem.qtyUnits,
              qtyBoxes: serverItem.qtyBoxes,
              closedBoxes: serverItem.closedBoxes,
              openBoxUnits: serverItem.openBoxUnits
            }
          });
          toSync.push({ item: localItem, action: 'update' });
        }
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`   - Itens apenas no local: ${onlyLocal.length}`);
    console.log(`   - Itens com diferenças: ${differences.length}`);
    console.log(`   - Total a sincronizar: ${toSync.length}`);
    
    if (differences.length > 0) {
      console.log('\n📋 Diferenças encontradas:');
      console.log('─'.repeat(80));
      for (const diff of differences.slice(0, 10)) {
        console.log(`   ${diff.productName}:`);
        console.log(`     Local:   ${diff.local.qtyUnits} un, ${diff.local.qtyBoxes} cx, ${diff.local.closedBoxes} cx fechadas, ${diff.local.openBoxUnits} un abertas`);
        console.log(`     Servidor: ${diff.server.qtyUnits} un, ${diff.server.qtyBoxes} cx, ${diff.server.closedBoxes} cx fechadas, ${diff.server.openBoxUnits} un abertas`);
      }
      if (differences.length > 10) {
        console.log(`   ... e mais ${differences.length - 10} diferenças`);
      }
    }
    
    if (onlyLocal.length > 0) {
      console.log('\n📋 Itens apenas no local (serão criados no servidor):');
      console.log('─'.repeat(80));
      for (const item of onlyLocal.slice(0, 10)) {
        console.log(`   - ${item.productName || item.productId}: ${item.qtyUnits} un, ${item.qtyBoxes} cx`);
      }
      if (onlyLocal.length > 10) {
        console.log(`   ... e mais ${onlyLocal.length - 10} itens`);
      }
    }
    
    // Sincronizar
    if (toSync.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('   SINCRONIZANDO...');
      console.log('═══════════════════════════════════════════════════════════════');
      
      let success = 0;
      let failed = 0;
      const errors = [];
      
      for (const { item, action } of toSync) {
        process.stdout.write(`   ${action === 'create' ? '➕' : '🔄'} ${item.productName || item.productId}...`);
        
        try {
          const result = await syncInventoryItem(token, item);
          if (result.status >= 200 && result.status < 300) {
            console.log(' ✅');
            success++;
          } else {
            console.log(` ❌ (${result.status})`);
            failed++;
            errors.push({ item: item.productName, error: result.raw });
          }
        } catch (e) {
          console.log(` ❌ (${e.message})`);
          failed++;
          errors.push({ item: item.productName, error: e.message });
        }
      }
      
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('   RESULTADO DA SINCRONIZAÇÃO');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`   ✅ Sucesso: ${success}`);
      console.log(`   ❌ Falhas: ${failed}`);
      
      if (errors.length > 0) {
        console.log('\n   Erros:');
        for (const err of errors.slice(0, 5)) {
          console.log(`   - ${err.item}: ${err.error.substring(0, 100)}`);
        }
      }
    } else {
      console.log('\n✅ Estoque já está sincronizado! Nenhuma ação necessária.');
    }
    
  } finally {
    if (db) db.close();
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   CONCLUÍDO');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
