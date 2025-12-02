// Script para ver erros de sync
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function run() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  console.log('=== ITENS FALHOS NA FILA DE SYNC ===\n');
  
  const failed = db.exec("SELECT entity, operation, entity_id, status, last_error, data FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5");
  
  if (failed.length > 0) {
    failed[0].values.forEach(([entity, operation, entityId, status, lastError, data]) => {
      console.log(`\n--- ${entity} ${operation} ---`);
      console.log('ID:', entityId);
      console.log('Erro:', lastError);
      console.log('Data:', data.substring(0, 500));
    });
  } else {
    console.log('Nenhum item falho encontrado');
  }
  
  db.close();
}

run().catch(console.error);
