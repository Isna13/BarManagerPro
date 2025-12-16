const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db';
console.log('📂 Abrindo banco:', dbPath);

const db = new Database(dbPath);

console.log('\n=== Tabelas ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(tables.map(t => t.name).join(', '));

console.log('\n=== Contagem de registros ===');
const counts = [
  { table: 'products', query: 'SELECT COUNT(*) as total FROM products' },
  { table: 'inventory_items', query: 'SELECT COUNT(*) as total FROM inventory_items' },
  { table: 'customers', query: 'SELECT COUNT(*) as total FROM customers' },
  { table: 'sales', query: 'SELECT COUNT(*) as total FROM sales' },
  { table: 'categories', query: 'SELECT COUNT(*) as total FROM categories' },
  { table: 'branches', query: 'SELECT COUNT(*) as total FROM branches' },
  { table: 'users', query: 'SELECT COUNT(*) as total FROM users' },
];

for (const c of counts) {
  try {
    const result = db.prepare(c.query).get();
    console.log(`${c.table}: ${result.total} registros`);
  } catch (e) {
    console.log(`${c.table}: erro - ${e.message}`);
  }
}

console.log('\n=== Produtos (primeiros 5) ===');
try {
  const products = db.prepare("SELECT id, name, sku FROM products LIMIT 5").all();
  products.forEach(p => console.log(`  - ${p.name} (${p.sku})`));
} catch (e) {
  console.log('Erro:', e.message);
}

console.log('\n=== Inventory com produtos ===');
try {
  const inv = db.prepare(`
    SELECT p.name, i.qty_units, i.closed_boxes, i.open_box_units, i.synced
    FROM inventory_items i
    LEFT JOIN products p ON p.id = i.product_id
    LIMIT 10
  `).all();
  inv.forEach(i => console.log(`  - ${i.name}: ${i.qty_units} un (synced=${i.synced})`));
} catch (e) {
  console.log('Erro:', e.message);
}

console.log('\n=== Clientes (primeiros 5) ===');
try {
  const customers = db.prepare("SELECT id, name, phone FROM customers LIMIT 5").all();
  customers.forEach(c => console.log(`  - ${c.name} (${c.phone || 'sem tel'})`));
} catch (e) {
  console.log('Erro:', e.message);
}

db.close();
console.log('\n✅ Verificação concluída');
