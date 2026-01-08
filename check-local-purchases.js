// Verificar dados locais de compras
const db = require('better-sqlite3')('apps/desktop/barmanager.db');

const items = db.prepare(`
  SELECT 
    pi.id,
    p.name,
    pi.qty_units as unidades,
    p.units_per_box as un_caixa,
    (pi.qty_units / p.units_per_box) as caixas,
    pi.unit_cost as custo_cx,
    pi.total as total_atual,
    (pi.qty_units / p.units_per_box * pi.unit_cost) as total_correto
  FROM purchase_items pi 
  JOIN products p ON pi.product_id = p.id 
  ORDER BY pi.created_at DESC 
  LIMIT 15
`).all();

console.log('\n📊 DADOS LOCAIS DE COMPRAS (SQLite):\n');
console.table(items);

// Verificar se há diferenças
let erros = 0;
for (const item of items) {
  const diff = Math.abs(item.total_atual - item.total_correto);
  if (diff > item.total_correto * 0.1) {
    erros++;
    console.log(`❌ ${item.name}: ${item.total_atual} ≠ ${item.total_correto}`);
  }
}

if (erros === 0) {
  console.log('\n✅ Todos os valores locais estão CORRETOS!');
} else {
  console.log(`\n⚠️ ${erros} itens com valores incorretos localmente`);
}

db.close();
