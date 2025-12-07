const Database = require('better-sqlite3');
const db = new Database('C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db');

console.log('=== DÍVIDAS LOCAIS ===');
const debts = db.prepare('SELECT * FROM debts ORDER BY created_at DESC').all();
console.log(JSON.stringify(debts, null, 2));

console.log('\n=== SYNC QUEUE (debt related) ===');
const queue = db.prepare("SELECT * FROM sync_queue WHERE entity_type LIKE '%debt%' ORDER BY created_at DESC").all();
console.log(JSON.stringify(queue, null, 2));

console.log('\n=== VENDAS COM PAYMENT_METHOD = debt ===');
const debtSales = db.prepare("SELECT id, customer_id, total, payment_method, synced, created_at FROM sales WHERE payment_method = 'debt' ORDER BY created_at DESC LIMIT 10").all();
console.log(JSON.stringify(debtSales, null, 2));

db.close();
