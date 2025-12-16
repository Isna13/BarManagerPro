/**
 * Script para ajustar estoque do Electron e diagnosticar sincronização
 * Executa: node fix-electron-stock.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Caminho do banco de dados do Electron
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

console.log('===============================================================');
console.log('SCRIPT DE AJUSTE DE ESTOQUE - ELECTRON');
console.log('===============================================================');
console.log('Banco de dados:', dbPath);

try {
  const db = new Database(dbPath);
  
  // 1. Buscar produto Super Bock mini
  console.log('\n[1] BUSCANDO PRODUTO SUPER BOCK MINI...');
  const product = db.prepare(`
    SELECT id, name, synced 
    FROM products 
    WHERE name LIKE '%Super Bock%mini%'
  `).get();
  
  if (!product) {
    console.log('Produto nao encontrado!');
    process.exit(1);
  }
  
  console.log('   Produto:', product.name);
  console.log('   ID:', product.id);
  
  // 2. Buscar inventário atual
  console.log('\n[2] BUSCANDO INVENTARIO ATUAL...');
  const inventory = db.prepare(`
    SELECT id, product_id, branch_id, qty_units, synced, last_sync, updated_at
    FROM inventory_items 
    WHERE product_id = ?
  `).get(product.id);
  
  if (!inventory) {
    console.log('   Inventario nao encontrado para este produto!');
    console.log('   Criando registro de inventario...');
    
    // Buscar branch_id padrao
    const branch = db.prepare(`SELECT id FROM branches LIMIT 1`).get();
    const branchId = branch?.id || 'main-branch';
    
    db.prepare(`
      INSERT INTO inventory_items (id, product_id, branch_id, qty_units, synced, created_at, updated_at)
      VALUES (?, ?, ?, 234, 1, datetime('now'), datetime('now'))
    `).run(
      require('crypto').randomUUID(),
      product.id,
      branchId
    );
    
    console.log('   Inventario criado com 234 unidades');
  } else {
    console.log('   Inventario encontrado:');
    console.log('   - ID:', inventory.id);
    console.log('   - Estoque atual:', inventory.qty_units);
    console.log('   - Synced:', inventory.synced);
    console.log('   - Branch:', inventory.branch_id);
    
    // 3. Ajustar estoque
    console.log('\n[3] AJUSTANDO ESTOQUE...');
    const newQty = 234;
    
    if (inventory.qty_units === newQty) {
      console.log('   Estoque ja esta correto:', newQty, 'unidades');
    } else {
      db.prepare(`
        UPDATE inventory_items 
        SET qty_units = ?, 
            synced = 1, 
            last_sync = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newQty, inventory.id);
      
      console.log('   Estoque ajustado:', inventory.qty_units, '->', newQty, 'unidades');
      
      // Verificar
      const updated = db.prepare('SELECT qty_units, synced FROM inventory_items WHERE id = ?').get(inventory.id);
      console.log('   Verificacao: qty_units=' + updated.qty_units + ', synced=' + updated.synced);
    }
  }
  
  // 4. Verificar todos os inventários
  console.log('\n[4] TODOS OS INVENTARIOS...');
  const allInventory = db.prepare(`
    SELECT i.id, i.qty_units, i.synced, p.name 
    FROM inventory_items i
    JOIN products p ON i.product_id = p.id
    ORDER BY p.name
  `).all();
  
  console.log('   Total:', allInventory.length, 'itens');
  for (const item of allInventory) {
    console.log('   -', item.name + ':', item.qty_units, 'un (synced=' + item.synced + ')');
  }
  
  // 5. Verificar fila de sincronização
  console.log('\n[5] FILA DE SINCRONIZACAO...');
  const syncQueue = db.prepare(`
    SELECT entity, operation, status, COUNT(*) as count 
    FROM sync_queue 
    GROUP BY entity, operation, status
  `).all();
  
  for (const item of syncQueue) {
    console.log('   -', item.entity, '(' + item.operation + '):', item.count, '[' + item.status + ']');
  }
  
  // 6. Limpar itens de inventário da fila de sync (para evitar sobrescrever)
  console.log('\n[6] LIMPANDO FILA DE SYNC DE INVENTARIO...');
  const deleted = db.prepare(`
    DELETE FROM sync_queue 
    WHERE entity = 'inventory' OR entity = 'inventory_item'
  `).run();
  console.log('   Itens removidos:', deleted.changes);
  
  db.close();
  
  console.log('\n===============================================================');
  console.log('CONCLUIDO!');
  console.log('===============================================================');
  console.log('\nProximos passos:');
  console.log('1. Reinicie o app Electron');
  console.log('2. Faca uma venda no app Vendas Manager Pro');
  console.log('3. Aguarde a sincronizacao');
  console.log('4. Verifique se o estoque foi atualizado no Electron');
  
} catch (error) {
  console.error('ERRO:', error.message);
  process.exit(1);
}
