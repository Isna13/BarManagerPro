const Database = require('better-sqlite3');
const db = new Database('./apps/desktop/barmanager.db');

// Vendas de hoje
const today = new Date().toISOString().split('T')[0];
console.log('Data de hoje:', today);

const allSales = db.prepare(`
  SELECT id, customer_name, total, status, created_at 
  FROM sales 
  ORDER BY created_at DESC
`).all();

console.log('\n=== TODAS AS VENDAS ===');
console.log('Total:', allSales.length);

const todaySales = allSales.filter(s => s.created_at && s.created_at.startsWith(today));
console.log('\n=== VENDAS DE HOJE ===');
console.log('Total:', todaySales.length);
todaySales.forEach(s => {
  console.log(`  ${s.id.substr(0,8)}... | ${(s.customer_name || 'Sem nome').padEnd(20)} | ${s.total} FCFA | ${s.status} | ${s.created_at}`);
});

// Verificar sync_queue
const syncQueue = db.prepare(`
  SELECT entity_type, COUNT(*) as count, synced 
  FROM sync_queue 
  GROUP BY entity_type, synced
`).all();

console.log('\n=== SYNC QUEUE ===');
syncQueue.forEach(s => {
  console.log(`  ${s.entity_type}: ${s.count} (synced=${s.synced})`);
});

db.close();
