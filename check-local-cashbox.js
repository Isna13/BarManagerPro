/**
 * Script para verificar caixas no banco local SQLite
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Caminho do banco de dados do Electron
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

console.log('📂 Caminho do banco:', dbPath);

const fs = require('fs');
if (!fs.existsSync(dbPath)) {
  console.error('❌ Banco de dados não encontrado!');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log('\n📦 CAIXAS NO BANCO LOCAL:');
console.log('='.repeat(80));

const cashBoxes = db.prepare('SELECT * FROM cash_boxes ORDER BY opened_at DESC LIMIT 10').all();

if (cashBoxes.length === 0) {
  console.log('Nenhum caixa encontrado');
} else {
  cashBoxes.forEach((box, i) => {
    console.log(`\n${i+1}. ID: ${box.id}`);
    console.log(`   Status: ${box.status}`);
    console.log(`   Número: ${box.box_number}`);
    console.log(`   Aberto em: ${box.opened_at}`);
    console.log(`   Fechado em: ${box.closed_at || 'N/A'}`);
    console.log(`   Abertura: ${box.opening_cash}`);
    console.log(`   Fechamento: ${box.closing_cash || 'N/A'}`);
    console.log(`   Synced: ${box.synced}`);
  });
}

console.log('\n\n📤 FILA DE SYNC (cash_box):');
console.log('='.repeat(80));

const syncQueue = db.prepare(`
  SELECT * FROM sync_queue 
  WHERE entity = 'cash_box' 
  ORDER BY created_at DESC 
  LIMIT 20
`).all();

if (syncQueue.length === 0) {
  console.log('Nenhum item de cash_box na fila');
} else {
  syncQueue.forEach((item, i) => {
    console.log(`\n${i+1}. ID: ${item.id}`);
    console.log(`   Entity ID: ${item.entity_id}`);
    console.log(`   Operation: ${item.operation}`);
    console.log(`   Status: ${item.status}`);
    console.log(`   Created: ${item.created_at}`);
    console.log(`   Processed: ${item.processed_at || 'N/A'}`);
    console.log(`   Last Error: ${item.last_error || 'Nenhum'}`);
    try {
      const data = JSON.parse(item.data);
      console.log(`   Data.status: ${data.status || 'N/A'}`);
      console.log(`   Data.closingCash: ${data.closingCash || data.closing_cash || 'N/A'}`);
    } catch (e) {
      console.log(`   Data: ${item.data?.substring(0, 100)}...`);
    }
  });
}

console.log('\n\n📊 RESUMO DA FILA DE SYNC:');
const summary = db.prepare(`
  SELECT entity, operation, status, COUNT(*) as count 
  FROM sync_queue 
  GROUP BY entity, operation, status
  ORDER BY entity, operation
`).all();

console.table(summary);

db.close();
