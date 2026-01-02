/**
 * Script para resetar itens falhados na sync_queue
 * Permite re-tentativa de sincronização
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

console.log('🔄 RESETANDO ITENS FALHADOS NA SYNC_QUEUE');
console.log('='.repeat(50));

try {
  // 1. Mostrar itens falhados antes
  console.log('\n📋 Itens falhados ANTES do reset:');
  const before = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT entity, COUNT(*) as count, MAX(last_error) as ultimo_erro FROM sync_queue WHERE status = 'failed' GROUP BY entity"`,
    { encoding: 'utf8' }
  );
  console.log(before || '(nenhum item falhado)');
  
  // 2. Resetar itens falhados para pending
  console.log('\n🔄 Resetando itens para status=pending...');
  execSync(
    `sqlite3.exe "${DB_PATH}" "UPDATE sync_queue SET status = 'pending', retry_count = 0, last_error = NULL WHERE status = 'failed'"`,
    { encoding: 'utf8' }
  );
  console.log('✅ Itens resetados!');
  
  // 3. Mostrar resultado
  console.log('\n📋 Status da sync_queue APÓS reset:');
  const after = execSync(
    `sqlite3.exe "${DB_PATH}" "SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status"`,
    { encoding: 'utf8' }
  );
  console.log(after);
  
  console.log('\n✅ Pronto! Execute o app e a sincronização tentará novamente.');
} catch (e) {
  console.error('❌ Erro:', e.message);
  console.log('\n💡 Dica: Certifique-se de que o app Electron está fechado antes de executar este script.');
}
