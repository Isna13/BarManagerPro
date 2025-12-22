/**
 * Script para verificar e limpar itens pendentes na fila de sync
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

async function main() {
  // Carregar sql.js
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           VERIFICAÇÃO DA FILA DE SINCRONIZAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Ver itens pendentes na fila
  const queue = db.exec(`SELECT * FROM sync_queue WHERE status = 'pending'`);
  
  if (queue.length > 0 && queue[0].values.length > 0) {
    console.log(`📋 Itens pendentes na fila de sync: ${queue[0].values.length}\n`);
    const cols = queue[0].columns;
    
    queue[0].values.forEach((row, i) => {
      const item = {};
      cols.forEach((c, idx) => item[c] = row[idx]);
      console.log(`─────────────────────────────────────────────`);
      console.log(`Item ${i+1}:`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Entidade: ${item.entity}`);
      console.log(`  Entity ID: ${item.entity_id}`);
      console.log(`  Operação: ${item.operation}`);
      console.log(`  Status: ${item.status}`);
      console.log(`  Criado em: ${item.created_at}`);
      
      // Parsear dados se existir
      if (item.data) {
        try {
          const data = JSON.parse(item.data);
          console.log(`  Dados: ${data.email || data.username || data.id || 'N/A'}`);
        } catch (e) {}
      }
    });
    
    // Verificar se são usuários que já foram sincronizados
    console.log('\n─────────────────────────────────────────────');
    console.log('🔍 Verificando se esses usuários já estão sincronizados...\n');
    
    const userItems = queue[0].values.filter((row, i) => {
      const entity = row[cols.indexOf('entity')];
      return entity === 'user';
    });
    
    for (const row of userItems) {
      const entityId = row[cols.indexOf('entity_id')];
      const userResult = db.exec(`SELECT id, email, username, synced, sync_status, server_id FROM users WHERE id = '${entityId}'`);
      
      if (userResult.length > 0 && userResult[0].values.length > 0) {
        const user = {};
        userResult[0].columns.forEach((c, idx) => user[c] = userResult[0].values[0][idx]);
        
        console.log(`👤 ${user.email || user.username}`);
        console.log(`   Synced: ${user.synced}, Status: ${user.sync_status}, Server ID: ${user.server_id}`);
        
        if (user.synced === 1 && user.sync_status === 'SYNCED' && user.server_id) {
          console.log(`   ✅ JÁ SINCRONIZADO - pode ser removido da fila\n`);
        } else {
          console.log(`   ⚠️ Ainda precisa de sincronização\n`);
        }
      }
    }
    
    // Perguntar se deve limpar
    const args = process.argv.slice(2);
    if (args.includes('--clean')) {
      console.log('🧹 Limpando itens de usuários já sincronizados...\n');
      
      for (const row of userItems) {
        const entityId = row[cols.indexOf('entity_id')];
        const queueId = row[cols.indexOf('id')];
        const userResult = db.exec(`SELECT synced, sync_status, server_id FROM users WHERE id = '${entityId}'`);
        
        if (userResult.length > 0 && userResult[0].values.length > 0) {
          const [synced, sync_status, server_id] = userResult[0].values[0];
          
          if (synced === 1 && sync_status === 'SYNCED' && server_id) {
            db.run(`DELETE FROM sync_queue WHERE id = ?`, [queueId]);
            console.log(`   ✅ Removido da fila: ${entityId}`);
          }
        }
      }
      
      // Salvar alterações
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
      console.log('\n💾 Alterações salvas!');
    } else {
      console.log('💡 Use --clean para remover itens já sincronizados da fila');
    }
    
  } else {
    console.log('✅ Nenhum item pendente na fila de sincronização!');
  }
  
  db.close();
}

main().catch(console.error);
