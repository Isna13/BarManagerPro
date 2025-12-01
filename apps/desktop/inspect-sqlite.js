/**
 * Script para ver a estrutura do banco SQLite do Electron
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SQLITE_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

async function inspect() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  INSPEÇÃO DO BANCO SQLITE');
  console.log('═══════════════════════════════════════════════════\n');
  
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
      console.log(`   Erro: ${e.message}`);
      return [];
    }
  };
  
  // Ver estrutura das tabelas
  const tables = query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('📋 Tabelas encontradas:');
  tables.forEach(t => console.log(`   - ${t.name}`));
  
  // Ver colunas da tabela products
  console.log('\n📋 Estrutura da tabela PRODUCTS:');
  const productsCols = query("PRAGMA table_info(products)");
  productsCols.forEach(c => console.log(`   - ${c.name} (${c.type})`));
  
  // Ver um produto de exemplo
  console.log('\n📋 Exemplo de produto:');
  const sampleProduct = query("SELECT * FROM products LIMIT 1");
  console.log(JSON.stringify(sampleProduct[0], null, 2));
  
  // Ver colunas da tabela customers
  console.log('\n📋 Estrutura da tabela CUSTOMERS:');
  const customersCols = query("PRAGMA table_info(customers)");
  customersCols.forEach(c => console.log(`   - ${c.name} (${c.type})`));
  
  // Ver um cliente de exemplo
  console.log('\n📋 Exemplo de cliente:');
  const sampleCustomer = query("SELECT * FROM customers LIMIT 1");
  console.log(JSON.stringify(sampleCustomer[0], null, 2));
  
  // Ver colunas da tabela inventory_items
  console.log('\n📋 Estrutura da tabela INVENTORY_ITEMS:');
  const inventoryCols = query("PRAGMA table_info(inventory_items)");
  inventoryCols.forEach(c => console.log(`   - ${c.name} (${c.type})`));
  
  // Ver um item de exemplo
  console.log('\n📋 Exemplo de inventory_item:');
  const sampleInv = query("SELECT * FROM inventory_items LIMIT 1");
  console.log(JSON.stringify(sampleInv[0], null, 2));
  
  db.close();
}

inspect().catch(console.error);
