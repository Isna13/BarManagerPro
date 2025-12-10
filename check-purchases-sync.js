const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'bar-manager', 'bar-manager.db');
console.log('Database path:', dbPath);

const db = new Database(dbPath);

console.log('\n=== ÚLTIMAS COMPRAS NO BANCO LOCAL ===');
const purchases = db.prepare('SELECT * FROM purchases ORDER BY created_at DESC LIMIT 5').all();
purchases.forEach(p => {
  console.log({
    id: p.id,
    number: p.purchase_number,
    status: p.status,
    total: p.total,
    supplierId: p.supplier_id,
    created: p.created_at
  });
});

console.log('\n=== ITENS DE COMPRAS NO BANCO LOCAL ===');
const items = db.prepare(`
  SELECT pi.*, p.purchase_number 
  FROM purchase_items pi 
  JOIN purchases p ON pi.purchase_id = p.id 
  ORDER BY pi.created_at DESC 
  LIMIT 15
`).all();
items.forEach(i => {
  console.log({
    id: i.id,
    purchaseId: i.purchase_id,
    purchaseNumber: i.purchase_number,
    productId: i.product_id,
    qtyUnits: i.qty_units,
    unitCost: i.unit_cost,
    total: i.total
  });
});

console.log('\n=== SYNC_QUEUE PARA PURCHASE E PURCHASE_ITEM ===');
const syncQueue = db.prepare(`
  SELECT id, entity, entity_id, operation, status, data, last_error, retry_count, created_at
  FROM sync_queue 
  WHERE entity IN ('purchase', 'purchase_item') 
  ORDER BY created_at DESC 
  LIMIT 20
`).all();

if (syncQueue.length === 0) {
  console.log('Nenhum item de purchase/purchase_item na sync_queue');
} else {
  syncQueue.forEach(s => {
    const data = JSON.parse(s.data || '{}');
    console.log({
      entity: s.entity,
      entityId: s.entity_id,
      operation: s.operation,
      status: s.status,
      retryCount: s.retry_count,
      lastError: s.last_error?.substring(0, 100),
      created: s.created_at,
      data: data
    });
  });
}

console.log('\n=== VERIFICANDO COMPRA MAIS RECENTE EM DETALHES ===');
if (purchases.length > 0) {
  const lastPurchase = purchases[0];
  console.log('Compra mais recente:');
  console.log(lastPurchase);
  
  const lastPurchaseItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(lastPurchase.id);
  console.log('\nItens desta compra no local:', lastPurchaseItems.length);
  lastPurchaseItems.forEach(item => {
    console.log({
      id: item.id,
      productId: item.product_id,
      qtyUnits: item.qty_units,
      unitCost: item.unit_cost,
      total: item.total
    });
  });
  
  // Verificar sync_queue para estes itens
  console.log('\nSync queue para esta compra e seus itens:');
  const syncForPurchase = db.prepare(`
    SELECT * FROM sync_queue 
    WHERE (entity = 'purchase' AND entity_id = ?) 
       OR (entity = 'purchase_item' AND json_extract(data, '$.purchaseId') = ?)
    ORDER BY created_at
  `).all(lastPurchase.id, lastPurchase.id);
  
  if (syncForPurchase.length === 0) {
    console.log('PROBLEMA: Nenhum registro na sync_queue para esta compra!');
    
    // Checar se a compra tem sync pendente por entity_id
    const anySync = db.prepare(`
      SELECT * FROM sync_queue 
      WHERE entity_id = ?
    `).all(lastPurchase.id);
    
    if (anySync.length > 0) {
      console.log('Encontrado na sync_queue por entity_id:', anySync);
    }
  } else {
    syncForPurchase.forEach(s => {
      console.log({
        entity: s.entity,
        operation: s.operation,
        status: s.status,
        data: JSON.parse(s.data || '{}')
      });
    });
  }
}

db.close();
