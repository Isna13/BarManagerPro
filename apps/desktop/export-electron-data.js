/**
 * Script para exportar dados do Electron (SQLite) para JSON
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SQLITE_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');
const OUTPUT_PATH = path.join(__dirname, '..', 'backend', 'prisma', 'electron-data.json');

async function exportData() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  EXPORTAÇÃO ELECTRON → JSON');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log('📂 Lendo dados do SQLite (Electron)...');
  console.log(`   Caminho: ${SQLITE_PATH}`);
  
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`Banco de dados não encontrado: ${SQLITE_PATH}`);
  }
  
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(SQLITE_PATH);
  const db = new SQL.Database(fileBuffer);
  
  const query = (sql) => {
    try {
      const stmt = db.prepare(sql);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.log(`   Erro na query: ${e.message}`);
      return [];
    }
  };
  
  // Ler tabelas
  const categories = query('SELECT * FROM categories');
  const suppliers = query('SELECT * FROM suppliers');
  const customers = query('SELECT * FROM customers');
  const products = query('SELECT * FROM products');
  const inventory = query('SELECT * FROM inventory_items');
  const sales = query('SELECT * FROM sales');
  const saleItems = query('SELECT * FROM sale_items');
  const debts = query('SELECT * FROM debts');
  const debtPayments = query('SELECT * FROM debt_payments');
  const cashBoxes = query('SELECT * FROM cash_boxes');
  const purchases = query('SELECT * FROM purchases');
  const purchaseItems = query('SELECT * FROM purchase_items');
  
  console.log(`\n📊 Dados encontrados:`);
  console.log(`   - Categorias: ${categories.length}`);
  console.log(`   - Fornecedores: ${suppliers.length}`);
  console.log(`   - Clientes: ${customers.length}`);
  console.log(`   - Produtos: ${products.length}`);
  console.log(`   - Itens de estoque: ${inventory.length}`);
  console.log(`   - Vendas: ${sales.length}`);
  console.log(`   - Itens de venda: ${saleItems.length}`);
  console.log(`   - Dívidas: ${debts.length}`);
  console.log(`   - Pagamentos de dívidas: ${debtPayments.length}`);
  console.log(`   - Registros de caixa: ${cashBoxes.length}`);
  console.log(`   - Compras: ${purchases.length}`);
  console.log(`   - Itens de compra: ${purchaseItems.length}`);
  
  // Mostrar detalhes
  console.log('\n📋 Categorias:');
  categories.forEach(c => console.log(`   - ${c.name}`));
  
  console.log('\n📋 Fornecedores:');
  suppliers.forEach(s => console.log(`   - ${s.name}`));
  
  console.log('\n📋 Clientes:');
  customers.forEach(c => console.log(`   - ${c.name} (${c.phone || 'sem telefone'})`));
  
  console.log('\n📋 Produtos:');
  products.forEach(p => console.log(`   - ${p.name}: custo=${p.unit_cost}, venda=${p.unit_price}`));
  
  console.log('\n📋 Estoque:');
  inventory.forEach(i => {
    const prod = products.find(p => p.id === i.product_id);
    console.log(`   - ${prod?.name || 'Desconhecido'}: ${i.quantity} unidades`);
  });
  
  // Preparar dados para exportação
  const data = {
    categories: categories.filter(c => c.name === 'Cerveja' || c.name === 'cerveja'),
    suppliers: suppliers.map(s => ({
      id: s.id,
      name: s.name,
      contactName: s.contact_name,
      email: s.email,
      phone: s.phone,
      address: s.address
    })),
    customers: customers.filter(c => c.name).map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      notes: c.notes
    })),
    products: products.filter(p => p.name && !p.name.includes('Teste')).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      costPrice: p.unit_cost || 0,
      sellingPrice: p.unit_price || 0,
      boxPrice: p.box_price,
      unitsPerBox: p.units_per_box || 24,
      minStock: p.min_stock || 10,
      categoryId: p.category_id
    })),
    inventory: inventory.map(i => ({
      id: i.id,
      productId: i.product_id,
      quantity: i.quantity || 0,
      minQuantity: i.min_quantity || 10,
      location: i.location || 'Estoque Principal'
    })),
    sales: sales.map(s => ({
      id: s.id,
      customerId: s.customer_id,
      total: s.total || 0,
      discount: s.discount || 0,
      paymentMethod: s.payment_method || 'CASH',
      status: s.status || 'COMPLETED',
      notes: s.notes,
      createdAt: s.created_at
    })),
    saleItems: saleItems.map(i => ({
      id: i.id,
      saleId: i.sale_id,
      productId: i.product_id,
      quantity: i.quantity || i.qty_units || 1,
      unitPrice: i.unit_price || 0
    })),
    debts: debts.map(d => ({
      id: d.id,
      customerId: d.customer_id,
      amount: d.amount || d.original_amount || 0,
      paidAmount: d.paid_amount || 0,
      description: d.description,
      dueDate: d.due_date,
      status: d.status || 'PENDING'
    })),
    debtPayments: debtPayments.map(p => ({
      id: p.id,
      debtId: p.debt_id,
      amount: p.amount || 0,
      paymentMethod: p.payment_method || 'CASH',
      createdAt: p.created_at
    }))
  };
  
  // Salvar JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\n✅ Dados exportados para: ${OUTPUT_PATH}`);
  
  db.close();
}

exportData().catch(console.error);
