// Verificar e corrigir vendas de mesa na fila de sync
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'bar-manager-desktop');
const dbPath = path.join(appDataPath, 'database.sqlite');

console.log('📁 Database:', dbPath);

// Usar o módulo nativo do desktop
const args = process.argv.slice(2);
const fixMode = args.includes('--fix');

if (fixMode) {
  console.log('🔧 MODO DE CORREÇÃO ATIVADO\n');
}

try {
  const db = new Database(dbPath);
  
  // Vendas de mesa que não foram sincronizadas
  console.log('\n🍽️ === VENDAS DE MESA NÃO SINCRONIZADAS ===');
  const unsyncedTableSales = db.prepare(`
    SELECT s.id, s.sale_number, s.total, s.customer_name, s.synced, s.created_at
    FROM sales s 
    WHERE s.type = 'table' AND (s.synced = 0 OR s.synced IS NULL)
    ORDER BY s.created_at DESC
    LIMIT 20
  `).all();
  
  console.log(`Encontradas ${unsyncedTableSales.length} vendas de mesa não sincronizadas:`);
  unsyncedTableSales.forEach(sale => {
    console.log(`  📋 ${sale.sale_number} | ${sale.total/100} FCFA | ${sale.customer_name || 'N/A'}`);
  });
  
  // Verificar se estas vendas estão na fila de sync
  console.log('\n📤 === VERIFICANDO FILA DE SYNC ===');
  for (const sale of unsyncedTableSales) {
    const inQueue = db.prepare(`
      SELECT id, status, retry_count, last_error
      FROM sync_queue 
      WHERE entity = 'sale' AND entity_id = ?
    `).get(sale.id);
    
    if (inQueue) {
      const icon = inQueue.status === 'completed' ? '✅' : 
                   inQueue.status === 'failed' ? '❌' : '⏳';
      console.log(`  ${icon} ${sale.sale_number}: ${inQueue.status} (retries: ${inQueue.retry_count})`);
      if (inQueue.last_error) {
        console.log(`     Erro: ${inQueue.last_error}`);
      }
      
      // Se está marcado como completed mas a venda não está synced, há um problema
      if (inQueue.status === 'completed' && !sale.synced) {
        console.log(`     ⚠️ PROBLEMA: Marcado como completed mas venda não está synced!`);
        
        if (fixMode) {
          // Resetar para pending
          db.prepare(`UPDATE sync_queue SET status = 'pending', retry_count = 0, last_error = NULL WHERE id = ?`).run(inQueue.id);
          console.log(`     🔧 Resetado para pending`);
        }
      }
    } else {
      console.log(`  ⚠️ ${sale.sale_number}: NÃO ESTÁ NA FILA!`);
      
      if (fixMode) {
        // Adicionar à fila
        const saleData = db.prepare('SELECT * FROM sales WHERE id = ?').get(sale.id);
        const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
        const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
        
        const queueData = {
          id: sale.id,
          saleNumber: sale.sale_number,
          branchId: saleData.branch_id || 'main-branch',
          type: 'table',
          tableId: saleData.table_id,
          customerId: saleData.customer_id,
          customerName: saleData.customer_name,
          cashierId: saleData.cashier_id,
          status: saleData.status,
          subtotal: saleData.subtotal,
          total: saleData.total,
        };
        
        const uuid = require('crypto').randomUUID();
        db.prepare(`
          INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority, status)
          VALUES (?, 'create', 'sale', ?, ?, 1, 'pending')
        `).run(uuid, sale.id, JSON.stringify(queueData));
        console.log(`     🔧 Adicionado à fila de sync`);
        
        // Adicionar itens
        for (const item of items) {
          const itemUuid = require('crypto').randomUUID();
          const itemData = {
            saleId: sale.id,
            productId: item.product_id,
            qtyUnits: item.qty_units,
            isMuntu: item.is_muntu === 1,
            unitPrice: item.unit_price,
            unitCost: item.unit_cost,
            subtotal: item.subtotal,
            total: item.total,
          };
          db.prepare(`
            INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority, status)
            VALUES (?, 'create', 'sale_item', ?, ?, 2, 'pending')
          `).run(itemUuid, item.id, JSON.stringify(itemData));
        }
        console.log(`     🔧 Adicionados ${items.length} itens à fila`);
        
        // Adicionar pagamentos
        for (const payment of payments) {
          const paymentUuid = require('crypto').randomUUID();
          const paymentData = {
            saleId: sale.id,
            method: payment.method,
            amount: payment.amount,
            referenceNumber: payment.reference_number,
            status: payment.status,
          };
          db.prepare(`
            INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority, status)
            VALUES (?, 'create', 'payment', ?, ?, 3, 'pending')
          `).run(paymentUuid, payment.id, JSON.stringify(paymentData));
        }
        console.log(`     🔧 Adicionados ${payments.length} pagamentos à fila`);
      }
    }
  }
  
  // Mostrar estatísticas
  console.log('\n📊 === ESTATÍSTICAS ===');
  const stats = db.prepare(`
    SELECT 
      entity,
      status,
      COUNT(*) as count
    FROM sync_queue 
    WHERE entity IN ('sale', 'sale_item', 'payment')
    GROUP BY entity, status
    ORDER BY entity, status
  `).all();
  
  stats.forEach(s => {
    console.log(`  ${s.entity}: ${s.status} = ${s.count}`);
  });
  
  db.close();
  
  if (!fixMode) {
    console.log('\n💡 Execute com --fix para corrigir os problemas encontrados');
  }
  
} catch (error) {
  console.error('Erro:', error.message);
  console.log('\nSe o erro for sobre versão do Node, execute este script de dentro do desktop:');
  console.log('  cd apps/desktop && node ../../check-table-sales.js');
}
