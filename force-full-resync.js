/**
 * Force Full Resync Script
 * 
 * Este script adiciona TODAS as entidades locais à fila de sincronização
 * na ordem correta de dependência (entidades base primeiro)
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const APP_DATA = process.env.APPDATA || '.';
const DB_PATH = path.join(APP_DATA, 'bar-manager-desktop', 'database.sqlite');

console.log('🔄 Force Full Resync Script');
console.log('============================');
console.log('📁 Database path:', DB_PATH);

// Verificar se o DB existe
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database não encontrado!');
  process.exit(1);
}

// Precisamos usar o better-sqlite3 compilado pelo Electron
// Então vamos criar um script que o Electron possa executar

const electronScript = `
const Database = require('better-sqlite3');
const db = new Database('${DB_PATH.replace(/\\/g, '\\\\')}');

// Ordem de sincronização (entidades base primeiro)
const SYNC_ORDER = [
  { table: 'categories', entity: 'category' },
  { table: 'suppliers', entity: 'supplier' },
  { table: 'customers', entity: 'customer' },
  { table: 'products', entity: 'product' },
  { table: 'debts', entity: 'debt' },
  { table: 'debt_payments', entity: 'debt_payment' },
  { table: 'purchases', entity: 'purchase' },
  { table: 'sales', entity: 'sale' },
];

// Limpar fila atual
console.log('🗑️ Limpando fila de sincronização atual...');
db.prepare('DELETE FROM sync_queue').run();

// Verificar status atual
console.log('\\n📊 Contagem de registros locais:');
for (const { table, entity } of SYNC_ORDER) {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM ' + table).get();
    console.log('  ' + table + ': ' + count.count + ' registros');
  } catch (e) {
    console.log('  ' + table + ': tabela não existe');
  }
}

// Adicionar todos os registros à fila de sync na ordem correta
console.log('\\n📤 Adicionando registros à fila de sincronização...');

let totalAdded = 0;

const insertQueue = db.prepare(\`
  INSERT INTO sync_queue (entity, entity_id, operation, data, status, priority, created_at)
  VALUES (?, ?, 'create', ?, 'pending', ?, datetime('now'))
\`);

for (const { table, entity } of SYNC_ORDER) {
  try {
    const priority = SYNC_ORDER.indexOf({ table, entity }) * 10;
    const rows = db.prepare('SELECT * FROM ' + table).all();
    
    for (const row of rows) {
      insertQueue.run(entity, row.id, JSON.stringify(row), priority);
      totalAdded++;
    }
    
    console.log('  ✅ ' + entity + ': ' + rows.length + ' adicionados');
  } catch (e) {
    console.log('  ⏭️ ' + table + ': ' + e.message);
  }
}

console.log('\\n📋 Total de itens na fila:', totalAdded);

// Mostrar resumo da fila
const queueSummary = db.prepare(\`
  SELECT entity, COUNT(*) as count 
  FROM sync_queue 
  GROUP BY entity 
  ORDER BY priority
\`).all();

console.log('\\n📊 Resumo da fila de sincronização:');
for (const row of queueSummary) {
  console.log('  ' + row.entity + ': ' + row.count);
}

db.close();
console.log('\\n✅ Fila de sincronização preparada!');
console.log('ℹ️ Reinicie o app Desktop para iniciar a sincronização.');
`;

// Salvar o script para executar via Electron
const scriptPath = path.join(__dirname, 'temp-resync-script.js');
fs.writeFileSync(scriptPath, electronScript);

console.log('\n📝 Script criado em:', scriptPath);
console.log('\n🔧 Para executar a re-sincronização:');
console.log('   1. Feche o app Desktop se estiver aberto');
console.log('   2. Execute este script no contexto do Electron:');
console.log('      npx electron --require ./temp-resync-script.js -e ""');
console.log('   3. Ou reinicie o app Desktop - ele detectará itens pendentes');

console.log('\n⚠️ ALTERNATIVA SIMPLES:');
console.log('   Vou criar uma IPC call no app para resetar a sync...');

// Verificar Railway status
console.log('\n🌐 Verificando Railway...');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: data });
        }
      });
    }).on('error', reject);
  });
}

async function checkRailway() {
  try {
    const products = await fetch(RAILWAY_URL + '/products');
    const customers = await fetch(RAILWAY_URL + '/customers');
    const debts = await fetch(RAILWAY_URL + '/debts');
    
    console.log('📊 Railway Status:');
    console.log('   Produtos:', Array.isArray(products) ? products.length : (products.items?.length || 0));
    console.log('   Clientes:', Array.isArray(customers) ? customers.length : (customers.items?.length || 0));
    console.log('   Dívidas:', Array.isArray(debts) ? debts.length : (debts.items?.length || 0));
  } catch (e) {
    console.log('   ⚠️ Erro ao verificar:', e.message);
  }
}

checkRailway();
