// Verificar vendas de mesa que estão falhando
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'bar-manager-desktop');
const dbPath = path.join(appDataPath, 'database.sqlite');

console.log('📁 Database:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Vendas de mesa
  console.log('\n🍽️ === VENDAS DE MESA (type=table) ===');
  const tableSales = db.prepare(`
    SELECT s.*, 
           (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count,
           (SELECT COUNT(*) FROM payments WHERE sale_id = s.id) as payment_count
    FROM sales s 
    WHERE s.type = 'table'
    ORDER BY s.created_at DESC
    LIMIT 10
  `).all();
  
  if (tableSales.length === 0) {
    console.log('Nenhuma venda de mesa encontrada');
  } else {
    tableSales.forEach(sale => {
      console.log(`\n  📋 ${sale.sale_number} (${sale.status})`);
      console.log(`     ID: ${sale.id}`);
      console.log(`     Total: ${sale.total/100} FCFA`);
      console.log(`     Customer: ${sale.customer_name || sale.customer_id || 'N/A'}`);
      console.log(`     Items: ${sale.item_count}, Payments: ${sale.payment_count}`);
      console.log(`     Synced: ${sale.synced ? 'Sim' : 'Não'}`);
      
      // Verificar na fila de sync
      const syncItems = db.prepare(`
        SELECT entity, operation, status, retry_count, last_error, created_at
        FROM sync_queue 
        WHERE entity_id = ? OR data LIKE ?
        ORDER BY created_at ASC
      `).all(sale.id, `%${sale.id}%`);
      
      if (syncItems.length > 0) {
        console.log('     Sync Queue:');
        syncItems.forEach(item => {
          const statusIcon = item.status === 'completed' ? '✅' : 
                            item.status === 'failed' ? '❌' : '⏳';
          console.log(`       ${statusIcon} ${item.entity}/${item.operation} - ${item.status}`);
          if (item.last_error) {
            console.log(`          Erro: ${item.last_error}`);
          }
        });
      } else {
        console.log('     ⚠️ Nenhum item na fila de sync!');
      }
    });
  }
  
  // Verificar itens falhados
  console.log('\n\n❌ === SYNC FALHADOS (sale/sale_item/payment) ===');
  const failed = db.prepare(`
    SELECT * FROM sync_queue 
    WHERE status = 'failed' 
      AND entity IN ('sale', 'sale_item', 'payment')
    ORDER BY created_at DESC
    LIMIT 20
  `).all();
  
  if (failed.length === 0) {
    console.log('Nenhum item de venda falhado');
  } else {
    failed.forEach(item => {
      console.log(`\n  ❌ ${item.entity}/${item.operation}`);
      console.log(`     ID: ${item.entity_id}`);
      console.log(`     Tentativas: ${item.retry_count}`);
      console.log(`     Erro: ${item.last_error}`);
      
      // Parsear dados
      try {
        const data = JSON.parse(item.data);
        if (data.saleId) console.log(`     SaleId: ${data.saleId}`);
        if (data.saleNumber) console.log(`     SaleNumber: ${data.saleNumber}`);
      } catch(e) {}
    });
  }
  
  // Verificar items completos para vendas
  console.log('\n\n✅ === SYNC COMPLETED PARA VENDAS ===');
  const completed = db.prepare(`
    SELECT * FROM sync_queue 
    WHERE status = 'completed' 
      AND entity = 'sale'
    ORDER BY processed_at DESC
    LIMIT 10
  `).all();
  
  completed.forEach(item => {
    console.log(`  ✅ ${item.entity_id}`);
    try {
      const data = JSON.parse(item.data);
      console.log(`     SaleNumber: ${data.saleNumber || 'N/A'}, Type: ${data.type || 'N/A'}`);
    } catch(e) {}
  });
  
  db.close();
  
} catch (error) {
  console.error('Erro:', error.message);
}
