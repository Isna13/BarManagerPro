/**
 * Script de diagnóstico para verificar sincronização de clientes
 * Executa análise do banco local e compara com Railway
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const https = require('https');

// Caminho do banco SQLite do Electron
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');
const API_URL = 'https://barmanagerbackend-production.up.railway.app';

console.log('🔍 DIAGNÓSTICO DE SINCRONIZAÇÃO DE CLIENTES');
console.log('='.repeat(60));
console.log('📁 Banco local:', DB_PATH);
console.log('🌐 Backend:', API_URL);
console.log('');

// 1. Verificar clientes locais
console.log('📊 1. CLIENTES NO BANCO LOCAL');
console.log('-'.repeat(40));
try {
  const localCustomers = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT id, code, full_name, phone, synced FROM customers ORDER BY full_name LIMIT 20"`,
    { encoding: 'utf8' }
  );
  console.log(localCustomers || '(nenhum cliente encontrado)');
} catch (e) {
  console.error('❌ Erro ao ler clientes locais:', e.message);
}

// 2. Verificar sync_queue para customers
console.log('\n📋 2. CLIENTES NA FILA DE SYNC (sync_queue)');
console.log('-'.repeat(40));
try {
  const syncQueue = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT id, entity, operation, status, retry_count, last_error, substr(data, 1, 100) as data_preview FROM sync_queue WHERE entity = 'customer' ORDER BY created_at DESC LIMIT 10"`,
    { encoding: 'utf8' }
  );
  console.log(syncQueue || '(nenhum item na fila para customer)');
} catch (e) {
  console.error('❌ Erro ao ler sync_queue:', e.message);
}

// 3. Verificar Dead Letter Queue para customers
console.log('\n☠️ 3. CLIENTES NA DEAD LETTER QUEUE');
console.log('-'.repeat(40));
try {
  const dlq = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT id, entity, operation, retry_count, last_error FROM sync_dead_letter WHERE entity = 'customer' LIMIT 10"`,
    { encoding: 'utf8' }
  );
  console.log(dlq || '(nenhum customer na DLQ)');
} catch (e) {
  console.log('(tabela sync_dead_letter não existe ou está vazia)');
}

// 4. Verificar sync audit log
console.log('\n📝 4. LOG DE AUDITORIA DE SYNC (últimos customers)');
console.log('-'.repeat(40));
try {
  const auditLog = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT timestamp, action, entity, entity_id, status, error_message FROM sync_audit_log WHERE entity = 'customer' ORDER BY timestamp DESC LIMIT 10"`,
    { encoding: 'utf8' }
  );
  console.log(auditLog || '(nenhum log de customer)');
} catch (e) {
  console.log('(tabela sync_audit_log não existe ou está vazia)');
}

// 5. Estatísticas gerais
console.log('\n📈 5. ESTATÍSTICAS GERAIS');
console.log('-'.repeat(40));
try {
  const stats = execSync(
    `sqlite3.exe "${DB_PATH}" "
      SELECT 'Total clientes' as metric, COUNT(*) as value FROM customers
      UNION ALL
      SELECT 'Clientes synced=1', COUNT(*) FROM customers WHERE synced = 1
      UNION ALL
      SELECT 'Clientes synced=0', COUNT(*) FROM customers WHERE synced = 0
      UNION ALL
      SELECT 'Itens pendentes na sync_queue', COUNT(*) FROM sync_queue WHERE status = 'pending'
      UNION ALL
      SELECT 'Itens customer na sync_queue', COUNT(*) FROM sync_queue WHERE entity = 'customer'
      UNION ALL
      SELECT 'Itens falhados na sync_queue', COUNT(*) FROM sync_queue WHERE status = 'failed'
    "`,
    { encoding: 'utf8' }
  );
  console.log(stats);
} catch (e) {
  console.error('❌ Erro ao obter estatísticas:', e.message);
}

// 6. Verificar clientes que NÃO estão sincronizados
console.log('\n⚠️ 6. CLIENTES NÃO SINCRONIZADOS (synced=0)');
console.log('-'.repeat(40));
try {
  const unsyncedCustomers = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT id, code, full_name, phone FROM customers WHERE synced = 0 OR synced IS NULL ORDER BY full_name"`,
    { encoding: 'utf8' }
  );
  console.log(unsyncedCustomers || '(todos os clientes estão sincronizados)');
} catch (e) {
  console.error('❌ Erro:', e.message);
}

console.log('\n' + '='.repeat(60));
console.log('DIAGNÓSTICO CONCLUÍDO');
console.log('');
console.log('💡 PRÓXIMOS PASSOS:');
console.log('  1. Se há clientes na sync_queue com status="pending", aguarde o próximo ciclo de sync');
console.log('  2. Se há clientes com status="failed", verifique o last_error');
console.log('  3. Se há clientes na DLQ, eles excederam 10 tentativas - verifique os erros');
console.log('  4. Se clientes têm synced=0 mas NÃO estão na sync_queue, há um bug no addToSyncQueue');
console.log('');
