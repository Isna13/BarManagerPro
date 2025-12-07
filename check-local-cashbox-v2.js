/**
 * Script para verificar caixas no banco local SQLite usando sql.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function main() {
  // Caminho do banco de dados do Electron
  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');
  
  console.log('📂 Caminho do banco:', dbPath);
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco de dados não encontrado!');
    process.exit(1);
  }
  
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  console.log('\n📦 CAIXAS NO BANCO LOCAL:');
  console.log('='.repeat(80));
  
  const cashBoxes = db.exec('SELECT * FROM cash_boxes ORDER BY opened_at DESC LIMIT 10');
  
  if (cashBoxes.length === 0 || cashBoxes[0].values.length === 0) {
    console.log('Nenhum caixa encontrado');
  } else {
    const columns = cashBoxes[0].columns;
    const rows = cashBoxes[0].values;
    
    rows.forEach((row, i) => {
      const box = {};
      columns.forEach((col, j) => box[col] = row[j]);
      
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
  
  const syncQueue = db.exec(`
    SELECT * FROM sync_queue 
    WHERE entity = 'cash_box' 
    ORDER BY created_at DESC 
    LIMIT 20
  `);
  
  if (syncQueue.length === 0 || syncQueue[0].values.length === 0) {
    console.log('Nenhum item de cash_box na fila');
  } else {
    const columns = syncQueue[0].columns;
    const rows = syncQueue[0].values;
    
    rows.forEach((row, i) => {
      const item = {};
      columns.forEach((col, j) => item[col] = row[j]);
      
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
  const summary = db.exec(`
    SELECT entity, operation, status, COUNT(*) as count 
    FROM sync_queue 
    GROUP BY entity, operation, status
    ORDER BY entity, operation
  `);
  
  if (summary.length > 0) {
    console.log('Entity\t\tOperation\tStatus\t\tCount');
    console.log('-'.repeat(60));
    summary[0].values.forEach(row => {
      console.log(`${row[0]}\t\t${row[1]}\t\t${row[2]}\t\t${row[3]}`);
    });
  }
  
  db.close();
}

main().catch(console.error);
