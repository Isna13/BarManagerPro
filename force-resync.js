/**
 * Script para forçar re-sincronização de itens falhados
 * Reseta o retry_count e marca itens como pending para nova tentativa
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Caminho do banco de dados
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

console.log('📂 Banco de dados:', dbPath);

const db = new Database(dbPath);

// 1. Ver estado atual
console.log('\n📊 Estado atual da fila de sincronização:');
const stats = db.prepare(`
  SELECT 
    entity,
    status,
    COUNT(*) as count
  FROM sync_queue
  GROUP BY entity, status
  ORDER BY entity, status
`).all();

stats.forEach(row => {
  console.log(`  ${row.entity}: ${row.status} = ${row.count}`);
});

// 2. Ver itens falhados com detalhes
console.log('\n❌ Itens falhados:');
const failed = db.prepare(`
  SELECT entity, operation, entity_id, retry_count, last_error
  FROM sync_queue
  WHERE status = 'failed'
  ORDER BY created_at
  LIMIT 20
`).all();

failed.forEach(row => {
  console.log(`  - ${row.entity}/${row.operation} (${row.entity_id})`);
  console.log(`    Tentativas: ${row.retry_count}, Erro: ${row.last_error}`);
});

// 3. Resetar itens falhados para nova tentativa
console.log('\n🔄 Resetando itens falhados...');
const result = db.prepare(`
  UPDATE sync_queue
  SET status = 'pending', retry_count = 0, last_error = NULL
  WHERE status = 'failed'
`).run();

console.log(`✅ ${result.changes} itens marcados como pendentes`);

// 4. Mostrar novo estado
console.log('\n📊 Novo estado da fila:');
const newStats = db.prepare(`
  SELECT 
    entity,
    status,
    COUNT(*) as count
  FROM sync_queue
  GROUP BY entity, status
  ORDER BY entity, status
`).all();

newStats.forEach(row => {
  console.log(`  ${row.entity}: ${row.status} = ${row.count}`);
});

db.close();
console.log('\n✅ Concluído! Reinicie o app Electron para sincronizar.');
