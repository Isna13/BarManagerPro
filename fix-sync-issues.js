/**
 * Script para corrigir problemas de sincronização
 * Execute com: node fix-sync-issues.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const LOCAL_DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║          CORREÇÃO DE PROBLEMAS DE SINCRONIZAÇÃO                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
  
  const db = new Database(LOCAL_DB_PATH);
  console.log('✅ Banco local aberto');
  
  try {
    // 1. Remover itens falhos da fila de sync (não podem ser resolvidos sem correção de dados)
    console.log('\n📤 Limpando itens falhos da fila de sincronização...');
    const failedItems = db.prepare('SELECT * FROM sync_queue WHERE status = ?').all('failed');
    console.log(`   Encontrados: ${failedItems.length} itens falhos`);
    
    for (const item of failedItems) {
      console.log(`   - Removendo: [${item.operation}] ${item.entity} (${item.entity_id})`);
      console.log(`     Erro original: ${item.last_error}`);
    }
    
    const deleteResult = db.prepare('DELETE FROM sync_queue WHERE status = ?').run('failed');
    console.log(`   ✅ Removidos: ${deleteResult.changes} itens`);
    
    // 2. Verificar e corrigir vendas com customer_id inválido
    console.log('\n💰 Verificando vendas com customer_id inválido...');
    const invalidSales = db.prepare(`
      SELECT s.id, s.sale_number, s.customer_id
      FROM sales s 
      WHERE s.customer_id IS NOT NULL 
      AND s.customer_id NOT IN (SELECT id FROM customers)
    `).all();
    
    if (invalidSales.length > 0) {
      console.log(`   Encontradas: ${invalidSales.length} vendas com customer_id inválido`);
      for (const sale of invalidSales) {
        console.log(`   - ${sale.sale_number}: customer_id=${sale.customer_id}`);
      }
      
      // Perguntar se deseja limpar
      console.log('\n   🔧 Definindo customer_id como NULL para vendas com FK inválido...');
      const updateSales = db.prepare('UPDATE sales SET customer_id = NULL WHERE customer_id NOT IN (SELECT id FROM customers)');
      const updateResult = updateSales.run();
      console.log(`   ✅ Atualizadas: ${updateResult.changes} vendas`);
    } else {
      console.log('   ✅ Nenhuma venda com customer_id inválido');
    }
    
    // 3. Verificar produto com categoria inválida
    console.log('\n📦 Verificando produtos com category_id inválido...');
    const invalidProducts = db.prepare(`
      SELECT p.id, p.name, p.category_id
      FROM products p 
      WHERE p.category_id IS NOT NULL 
      AND p.category_id NOT IN (SELECT id FROM categories)
    `).all();
    
    if (invalidProducts.length > 0) {
      console.log(`   Encontrados: ${invalidProducts.length} produtos com category_id inválido`);
      for (const prod of invalidProducts) {
        console.log(`   - ${prod.name}: category_id=${prod.category_id}`);
      }
      
      console.log('\n   🔧 Definindo category_id como NULL para produtos com FK inválido...');
      const updateProducts = db.prepare('UPDATE products SET category_id = NULL WHERE category_id NOT IN (SELECT id FROM categories)');
      const updateResultP = updateProducts.run();
      console.log(`   ✅ Atualizados: ${updateResultP.changes} produtos`);
    } else {
      console.log('   ✅ Nenhum produto com category_id inválido');
    }
    
    // 4. Limpar categorias duplicadas (manter apenas IDs únicos por nome)
    console.log('\n📂 Verificando categorias duplicadas...');
    const duplicateCategories = db.prepare(`
      SELECT name, COUNT(*) as count
      FROM categories
      GROUP BY name
      HAVING count > 1
    `).all();
    
    if (duplicateCategories.length > 0) {
      console.log(`   Encontradas: ${duplicateCategories.length} categorias com nomes duplicados`);
      for (const cat of duplicateCategories) {
        console.log(`   - "${cat.name}": ${cat.count} registros`);
      }
      
      // Manter apenas o primeiro de cada nome (por created_at mais antigo)
      console.log('\n   🔧 Removendo categorias duplicadas (mantendo a mais antiga)...');
      
      let totalRemoved = 0;
      for (const dup of duplicateCategories) {
        // Pegar IDs a manter (o primeiro/mais antigo)
        const toKeep = db.prepare(`
          SELECT id FROM categories 
          WHERE name = ? 
          ORDER BY created_at ASC 
          LIMIT 1
        `).get(dup.name);
        
        if (toKeep) {
          // Remover os outros
          const deleteStmt = db.prepare(`
            DELETE FROM categories 
            WHERE name = ? AND id != ?
          `);
          const delResult = deleteStmt.run(dup.name, toKeep.id);
          totalRemoved += delResult.changes;
        }
      }
      console.log(`   ✅ Removidas: ${totalRemoved} categorias duplicadas`);
    } else {
      console.log('   ✅ Nenhuma categoria duplicada');
    }
    
    // 5. Marcar todos os dados como não sincronizados para forçar re-sync
    console.log('\n🔄 Resetando flags de sincronização...');
    
    // Não resetar tudo, apenas itens que nunca sincronizaram
    const tables = ['categories', 'products', 'customers', 'suppliers'];
    for (const table of tables) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE synced = 0`).get();
      console.log(`   ${table}: ${count.count} itens não sincronizados`);
    }
    
    // 6. Resumo final
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 STATUS FINAL:');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    const finalStats = {
      sync_queue_pending: db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE status = ?').get('pending').count,
      sync_queue_failed: db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE status = ?').get('failed').count,
      categories: db.prepare('SELECT COUNT(*) as count FROM categories').get().count,
      products: db.prepare('SELECT COUNT(*) as count FROM products').get().count,
      customers: db.prepare('SELECT COUNT(*) as count FROM customers').get().count,
      sales: db.prepare('SELECT COUNT(*) as count FROM sales').get().count,
    };
    
    console.log(`   Fila de sync pendentes: ${finalStats.sync_queue_pending}`);
    console.log(`   Fila de sync falhos: ${finalStats.sync_queue_failed}`);
    console.log(`   Categorias: ${finalStats.categories}`);
    console.log(`   Produtos: ${finalStats.products}`);
    console.log(`   Clientes: ${finalStats.customers}`);
    console.log(`   Vendas: ${finalStats.sales}`);
    
    console.log('\n✅ CORREÇÕES CONCLUÍDAS!');
    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('   1. Execute o app Electron com conexão à internet');
    console.log('   2. Faça login online para sincronizar');
    console.log('   3. Execute analyze-sync-detailed.js novamente para verificar');
    
  } finally {
    db.close();
  }
}

main();
