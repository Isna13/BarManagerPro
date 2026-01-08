/**
 * Corrige TODOS os estoques baseado em: compras - vendas = estoque correto
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

function sqlite(query) {
  const cmd = `sqlite3 "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('Erro SQL:', e.message);
    return '';
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('      CORREÇÃO DE TODOS OS ESTOQUES (COMPRAS - VENDAS)');
console.log('═══════════════════════════════════════════════════════════════\n');

// Buscar produtos com diferença
const query = `
SELECT 
  p.id,
  p.name,
  COALESCE(compras.total, 0) as comprado,
  COALESCE(vendas.total, 0) as vendido,
  COALESCE(compras.total, 0) - COALESCE(vendas.total, 0) as teorico,
  i.qty_units as atual
FROM products p
LEFT JOIN (SELECT product_id, SUM(qty_units) as total FROM purchase_items GROUP BY product_id) compras ON p.id = compras.product_id
LEFT JOIN (SELECT product_id, SUM(qty_units) as total FROM sale_items GROUP BY product_id) vendas ON p.id = vendas.product_id
LEFT JOIN inventory_items i ON p.id = i.product_id
WHERE i.qty_units IS NOT NULL
  AND (COALESCE(compras.total, 0) - COALESCE(vendas.total, 0)) != i.qty_units
ORDER BY p.name;
`;

const result = sqlite(query);

if (!result) {
  console.log('✅ Todos os estoques já estão corretos!');
  process.exit(0);
}

console.log('Produtos a corrigir:\n');
console.log('┌────────────────────────┬──────────┬──────────┬──────────┬──────────┐');
console.log('│ Produto                │ Comprado │ Vendido  │ Teórico  │ Atual    │');
console.log('├────────────────────────┼──────────┼──────────┼──────────┼──────────┤');

const lines = result.split('\n');
const corrections = [];

for (const line of lines) {
  const parts = line.split('|');
  if (parts.length >= 6) {
    const [id, name, comprado, vendido, teorico, atual] = parts;
    console.log(`│ ${name.padEnd(22)} │ ${comprado.padStart(8)} │ ${vendido.padStart(8)} │ ${teorico.padStart(8)} │ ${atual.padStart(8)} │`);
    corrections.push({ id, name, teorico: parseInt(teorico), atual: parseInt(atual) });
  }
}

console.log('└────────────────────────┴──────────┴──────────┴──────────┴──────────┘\n');

console.log('Aplicando correções...\n');

for (const c of corrections) {
  const updateQuery = `UPDATE inventory_items SET qty_units = ${c.teorico}, synced = 1, updated_at = datetime('now') WHERE product_id = '${c.id}'`;
  sqlite(updateQuery);
  console.log(`✅ ${c.name}: ${c.atual} → ${c.teorico}`);
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('               CORREÇÃO LOCAL CONCLUÍDA!');
console.log('═══════════════════════════════════════════════════════════════\n');
