const Database = require('better-sqlite3');
const db = new Database('C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db');

console.log('\n=== OPERAÇÕES DELETE NA FILA DE SYNC ===\n');

const deleteOps = db.prepare(`
  SELECT id, entity, entity_id, operation, status, retry_count, last_error, data, created_at, updated_at
  FROM sync_queue 
  WHERE operation = 'delete'
  ORDER BY created_at DESC
  LIMIT 20
`).all();

if (deleteOps.length === 0) {
  console.log('❌ NENHUMA operação DELETE encontrada na fila de sync!\n');
} else {
  console.log(`✅ Encontradas ${deleteOps.length} operações DELETE:\n`);
  deleteOps.forEach((op, i) => {
    console.log(`${i+1}. [${op.status}] ${op.entity} | ID: ${op.entity_id}`);
    console.log(`   Criado: ${op.created_at} | Atualizado: ${op.updated_at}`);
    console.log(`   Retries: ${op.retry_count} | Erro: ${op.last_error || 'nenhum'}`);
    try {
      const data = JSON.parse(op.data);
      console.log(`   Data:`, JSON.stringify(data).substring(0, 200));
    } catch(e) {
      console.log(`   Data: ${op.data?.substring(0, 200)}`);
    }
    console.log();
  });
}

console.log('\n=== PRODUTOS MARCADOS COMO INATIVOS (is_active=0) ===\n');

const inactiveProducts = db.prepare(`
  SELECT id, name, sku, is_active, synced, updated_at
  FROM products
  WHERE is_active = 0
  ORDER BY updated_at DESC
  LIMIT 10
`).all();

if (inactiveProducts.length === 0) {
  console.log('Nenhum produto marcado como inativo.\n');
} else {
  console.log(`Encontrados ${inactiveProducts.length} produtos inativos:\n`);
  inactiveProducts.forEach((p, i) => {
    console.log(`${i+1}. ${p.name} | SKU: ${p.sku} | ID: ${p.id}`);
    console.log(`   is_active: ${p.is_active} | synced: ${p.synced} | updated: ${p.updated_at}`);
  });
}

console.log('\n=== TODAS OPERAÇÕES PENDENTES OU FALHADAS ===\n');

const pendingOps = db.prepare(`
  SELECT entity, operation, status, COUNT(*) as count
  FROM sync_queue
  WHERE status IN ('pending', 'failed')
  GROUP BY entity, operation, status
  ORDER BY entity, operation
`).all();

if (pendingOps.length === 0) {
  console.log('Nenhuma operação pendente ou falhada.\n');
} else {
  console.log('Resumo por entidade/operação/status:');
  pendingOps.forEach(op => {
    console.log(`  ${op.entity} | ${op.operation} | ${op.status}: ${op.count}`);
  });
}

db.close();
