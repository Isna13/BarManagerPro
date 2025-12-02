// Script para verificar a fila de sync e o status das vendas/dívidas
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
console.log('Database path:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Banco de dados não encontrado!');
  process.exit(1);
}

async function main() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('\n=== FILA DE SYNC ===');
  const pendingQueue = db.exec("SELECT entity, operation, entity_id, status, created_at FROM sync_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 30");
  if (pendingQueue.length > 0) {
    console.log(`Itens pendentes: ${pendingQueue[0].values.length}`);
    pendingQueue[0].values.forEach(([entity, operation, entityId, status, createdAt]) => {
      console.log(`  - ${entity}/${operation}: ${entityId?.substring(0, 8)}... | ${status} | ${createdAt}`);
    });
  } else {
    console.log('Nenhum item pendente');
  }

  console.log('\n=== ÚLTIMAS VENDAS LOCAIS ===');
  const sales = db.exec('SELECT id, sale_number, total, status, created_at FROM sales ORDER BY created_at DESC LIMIT 5');
  if (sales.length > 0) {
    sales[0].values.forEach(([id, saleNumber, total, status, createdAt]) => {
      console.log(`  - ${saleNumber}: ${(total || 0) / 100} FCFA | ${status} | ${createdAt}`);
    });
  }

  console.log('\n=== ITENS DE VENDA DAS ÚLTIMAS VENDAS ===');
  const saleItems = db.exec(`
    SELECT si.sale_id, s.sale_number, p.name, si.qty_units, si.total 
    FROM sale_items si 
    JOIN sales s ON s.id = si.sale_id 
    JOIN products p ON p.id = si.product_id 
    ORDER BY si.created_at DESC LIMIT 10
  `);
  if (saleItems.length > 0) {
    saleItems[0].values.forEach(([saleId, saleNumber, productName, qty, total]) => {
      console.log(`  - ${saleNumber}: ${productName} x${qty} = ${(total || 0) / 100} FCFA`);
    });
  }

  console.log('\n=== PAGAMENTOS DE DÍVIDA RECENTES ===');
  const payments = db.exec(`
    SELECT dp.id, dp.amount, dp.method, dp.created_at, d.debt_number 
    FROM debt_payments dp 
    JOIN debts d ON d.id = dp.debt_id 
    ORDER BY dp.created_at DESC LIMIT 5
  `);
  if (payments.length > 0) {
    payments[0].values.forEach(([id, amount, method, createdAt, debtNumber]) => {
      console.log(`  - ${debtNumber}: ${(amount || 0) / 100} FCFA | ${method} | ${createdAt}`);
    });
  } else {
    console.log('  Nenhum pagamento encontrado');
  }

  console.log('\n=== DÍVIDAS RECENTES ===');
  const debts = db.exec(`
    SELECT d.debt_number, c.full_name, d.balance, d.status, d.updated_at 
    FROM debts d 
    JOIN customers c ON c.id = d.customer_id 
    ORDER BY d.updated_at DESC LIMIT 5
  `);
  if (debts.length > 0) {
    debts[0].values.forEach(([debtNumber, customerName, balance, status, updatedAt]) => {
      console.log(`  - ${debtNumber}: ${customerName} | Saldo: ${(balance || 0) / 100} FCFA | ${status}`);
    });
  }

  // Verificar cliente "Danso"
  console.log('\n=== BUSCAR CLIENTE DANSO ===');
  const danso = db.exec("SELECT * FROM customers WHERE LOWER(full_name) LIKE '%danso%'");
  if (danso.length > 0) {
    console.log('Encontrado!');
    danso[0].columns.forEach((col, i) => {
      console.log(`  ${col}: ${danso[0].values[0][i]}`);
    });
    
    // Buscar dívidas desse cliente
    const dansoId = danso[0].values[0][0];
    console.log('\n  Dívidas desse cliente:');
    const dansoDebts = db.exec(`SELECT debt_number, original_amount, balance, status FROM debts WHERE customer_id = '${dansoId}'`);
    if (dansoDebts.length > 0) {
      dansoDebts[0].values.forEach(([debtNumber, original, balance, status]) => {
        console.log(`    - ${debtNumber}: Original ${(original || 0) / 100} FCFA | Saldo ${(balance || 0) / 100} FCFA | ${status}`);
      });
    } else {
      console.log('    Nenhuma dívida');
    }
  } else {
    console.log('Cliente Danso não encontrado');
  }

  db.close();
}

main().catch(console.error);
