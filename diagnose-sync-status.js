/**
 * Diagnóstico completo de status de sincronização
 * Verifica TODAS as entidades no banco local e seu estado de sincronização
 * NOTA: Usa sql.js para compatibilidade com qualquer versão do Node
 */

const fs = require('fs');
const path = require('path');

// Caminho correto do banco de dados (AppData no Windows)
const DB_PATH = path.join(
  process.env.APPDATA || process.env.HOME,
  '@barmanager',
  'desktop',
  'barmanager.db'
);

async function main() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DE SINCRONIZAÇÃO');
  console.log('='.repeat(60));
  console.log(`📁 Banco de dados: ${DB_PATH}`);
  console.log('');

  try {
    // Carregar sql.js
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    // Função helper para executar queries
    const query = (sql) => {
      const result = db.exec(sql);
      if (result.length === 0) return [];
      const columns = result[0].columns;
      return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
    };

    const queryOne = (sql) => {
      const rows = query(sql);
      return rows.length > 0 ? rows[0] : null;
    };

    // =============================================
    // 1. FILA DE SINCRONIZAÇÃO
    // =============================================
    console.log('📋 1. FILA DE SINCRONIZAÇÃO (sync_queue)');
    console.log('-'.repeat(50));
    
    const queueStats = query(`
      SELECT 
        entity,
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY entity, status
      ORDER BY entity, status
    `);

    if (queueStats.length === 0) {
      console.log('✅ Fila de sincronização vazia (tudo sincronizado)');
    } else {
      console.table(queueStats);
    }

    // Itens falhados com detalhes
    const failedItems = query(`
      SELECT entity, entity_id, operation, last_error, retry_count, created_at
      FROM sync_queue
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (failedItems.length > 0) {
      console.log('\n⚠️ Últimos itens FALHADOS:');
      failedItems.forEach(item => {
        console.log(`   - ${item.entity}/${item.operation}: ${item.last_error} (tentativas: ${item.retry_count})`);
      });
    }

    // Itens pendentes
    const pendingItems = query(`
      SELECT entity, entity_id, operation, priority, created_at
      FROM sync_queue
      WHERE status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT 10
    `);

    if (pendingItems.length > 0) {
      console.log('\n⏳ Itens PENDENTES (próximos a sincronizar):');
      pendingItems.forEach(item => {
        console.log(`   - ${item.entity}/${item.operation} (prioridade: ${item.priority})`);
      });
    }

    // =============================================
    // 2. CLIENTES
    // =============================================
    console.log('\n\n👥 2. CLIENTES');
    console.log('-'.repeat(50));
    
    const customerStats = queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as not_synced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM customers
    `);
    
    if (customerStats) {
      console.log(`Total: ${customerStats.total} | ✅ Sincronizados: ${customerStats.synced} | ⚠️ Pendentes: ${customerStats.not_synced}`);

      if (customerStats.not_synced > 0) {
        const unsyncedCustomers = query(`
          SELECT id, full_name, phone, email, synced
          FROM customers
          WHERE synced = 0
          LIMIT 5
        `);
        console.log('\n   Clientes não sincronizados:');
        unsyncedCustomers.forEach(c => {
          console.log(`   - ${c.full_name} | Tel: ${c.phone || 'N/A'} | Email: "${c.email || ''}" (synced=${c.synced})`);
        });
      }
    }

    // =============================================
    // 3. VENDAS
    // =============================================
    console.log('\n\n🛒 3. VENDAS');
    console.log('-'.repeat(50));
    
    const saleStats = queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as not_synced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open
      FROM sales
    `);
    
    if (saleStats) {
      console.log(`Total: ${saleStats.total} | ✅ Sincronizados: ${saleStats.synced} | ⚠️ Pendentes: ${saleStats.not_synced}`);
      console.log(`Status: 💰 Pagas: ${saleStats.paid} | 🔓 Abertas: ${saleStats.open}`);
    }

    // =============================================
    // 4. ESTOQUE (INVENTÁRIO)
    // =============================================
    console.log('\n\n📦 4. ESTOQUE (INVENTÁRIO)');
    console.log('-'.repeat(50));
    
    const inventoryStats = queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as not_synced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM inventory_items
    `);
    
    if (inventoryStats) {
      console.log(`Total: ${inventoryStats.total} | ✅ Sincronizados: ${inventoryStats.synced} | ⚠️ Pendentes: ${inventoryStats.not_synced}`);
    }

    // =============================================
    // 5. CAIXA (CASH BOX)
    // =============================================
    console.log('\n\n💵 5. CAIXA (CASH BOX)');
    console.log('-'.repeat(50));
    
    const cashBoxStats = queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as not_synced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
      FROM cash_boxes
    `);
    
    if (cashBoxStats) {
      console.log(`Total: ${cashBoxStats.total} | ✅ Sincronizados: ${cashBoxStats.synced} | ⚠️ Pendentes: ${cashBoxStats.not_synced}`);
      console.log(`Status: 🟢 Abertos: ${cashBoxStats.open} | 🔴 Fechados: ${cashBoxStats.closed}`);
    }

    // =============================================
    // 6. DÍVIDAS
    // =============================================
    console.log('\n\n💳 6. DÍVIDAS');
    console.log('-'.repeat(50));
    
    const debtStats = queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as not_synced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid
      FROM debts
    `);
    
    if (debtStats) {
      console.log(`Total: ${debtStats.total} | ✅ Sincronizados: ${debtStats.synced} | ⚠️ Pendentes: ${debtStats.not_synced}`);
      console.log(`Status: ⏳ Pendentes: ${debtStats.pending} | ✅ Pagas: ${debtStats.paid}`);
    }

    // =============================================
    // 7. PRODUTOS
    // =============================================
    console.log('\n\n📝 7. PRODUTOS');
    console.log('-'.repeat(50));
    
    const productStats = queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as not_synced,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM products
    `);
    
    if (productStats) {
      console.log(`Total: ${productStats.total} | ✅ Sincronizados: ${productStats.synced} | ⚠️ Pendentes: ${productStats.not_synced}`);
    }

    // =============================================
    // 8. DEAD LETTER QUEUE
    // =============================================
    console.log('\n\n☠️ 8. DEAD LETTER QUEUE (itens que falharam muitas vezes)');
    console.log('-'.repeat(50));
    
    let dlqItems = [];
    try {
      dlqItems = query(`
        SELECT entity, entity_id, operation, last_error, moved_at
        FROM dead_letter_queue
        ORDER BY moved_at DESC
        LIMIT 10
      `);
    } catch (e) {
      // Tabela pode não existir
    }
    
    if (dlqItems.length === 0) {
      console.log('✅ DLQ vazia (nenhum item definitivamente falhou)');
    } else {
      console.log(`⚠️ ${dlqItems.length} itens na Dead Letter Queue:`);
      dlqItems.forEach(item => {
        console.log(`   - ${item.entity}/${item.operation}: ${item.last_error}`);
      });
    }

    // =============================================
    // RESUMO FINAL
    // =============================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RESUMO FINAL');
    console.log('='.repeat(60));
    
    const totalUnsynced = 
      (customerStats?.not_synced || 0) + 
      (saleStats?.not_synced || 0) + 
      (inventoryStats?.not_synced || 0) + 
      (cashBoxStats?.not_synced || 0) + 
      (debtStats?.not_synced || 0) +
      (productStats?.not_synced || 0);
    
    if (totalUnsynced === 0 && queueStats.length === 0 && dlqItems.length === 0) {
      console.log('✅ TUDO SINCRONIZADO! Nenhum problema detectado.');
    } else {
      console.log(`⚠️ Itens não sincronizados no banco: ${totalUnsynced}`);
      console.log(`⚠️ Itens na fila de sincronização: ${queueStats.reduce((acc, s) => acc + s.count, 0)}`);
      console.log(`⚠️ Itens na Dead Letter Queue: ${dlqItems.length}`);
      console.log('\n💡 Recomendações:');
      console.log('   1. Abra o app Electron para iniciar sincronização automática');
      console.log('   2. Execute: node reset-sync-queue.js (para resetar itens falhados)');
      console.log('   3. Verifique os logs do app para erros específicos');
    }

    db.close();

  } catch (error) {
    console.error('❌ Erro ao diagnosticar:', error.message);
    console.error('   Verifique se o caminho do banco de dados está correto.');
  }
}

main();
