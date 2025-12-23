/**
 * Script para testar a correção da sincronização
 * Verifica se os IDs estão corretos e testa o fluxo de sync
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
const API_BASE = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function main() {
  console.log('🔍 Teste de Sincronização\n');
  console.log('📂 Database:', DB_PATH);
  
  const db = new Database(DB_PATH, { verbose: null });
  
  // 1. Verificar itens na fila
  console.log('\n📋 Itens na sync_queue:');
  const items = db.prepare(`
    SELECT id, entity, entity_id, operation, status, retry_count, priority
    FROM sync_queue 
    ORDER BY priority ASC
  `).all();
  
  console.table(items.map(i => ({
    id: i.id.substring(0, 8) + '...',
    entity: i.entity,
    entity_id: i.entity_id.substring(0, 8) + '...',
    status: i.status,
    priority: i.priority
  })));
  
  // 2. Verificar se todos os IDs são válidos
  const invalidIds = items.filter(i => !i.id || i.id.length < 10);
  if (invalidIds.length > 0) {
    console.log('\n❌ IDs INVÁLIDOS ENCONTRADOS:', invalidIds.length);
    invalidIds.forEach(i => console.log(`  - ${i.entity}: "${i.id}"`));
  } else {
    console.log('\n✅ Todos os IDs são válidos');
  }
  
  // 3. Verificar dados locais
  console.log('\n📊 Dados locais:');
  
  const categories = db.prepare('SELECT id, name FROM categories').all();
  console.log(`  Categorias: ${categories.length}`);
  categories.forEach(c => console.log(`    - ${c.name} (${c.id})`));
  
  const suppliers = db.prepare('SELECT id, name FROM suppliers').all();
  console.log(`  Fornecedores: ${suppliers.length}`);
  suppliers.forEach(s => console.log(`    - ${s.name} (${s.id})`));
  
  const products = db.prepare('SELECT id, name, supplier_id, category_id FROM products').all();
  console.log(`  Produtos: ${products.length}`);
  products.forEach(p => console.log(`    - ${p.name} | Cat: ${p.category_id?.substring(0,8)}... | Forn: ${p.supplier_id?.substring(0,8)}...`));
  
  // 4. Verificar últimas sincronizações
  console.log('\n📝 Últimos logs de sync:');
  const logs = db.prepare(`
    SELECT entity, action, status, error_message, created_at 
    FROM sync_audit_log 
    ORDER BY created_at DESC 
    LIMIT 10
  `).all();
  
  logs.forEach(l => {
    const icon = l.status === 'success' ? '✅' : l.status === 'error' ? '❌' : '⏳';
    const time = l.created_at.split(' ')[1];
    const error = l.error_message ? ` | ${l.error_message.substring(0, 40)}...` : '';
    console.log(`  ${icon} ${time} | ${l.entity} | ${l.action}${error}`);
  });
  
  db.close();
  console.log('\n✨ Análise concluída');
}

main().catch(console.error);
