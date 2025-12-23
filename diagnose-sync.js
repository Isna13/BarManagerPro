/**
 * Script para diagnosticar o estado de sincronização do Electron
 * Verifica se os dados estão sendo salvos corretamente no SQLite
 * 
 * Este script usa o sqlite3 CLI para evitar problemas de compatibilidade de módulo
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// Caminho para o banco de dados do Electron
const dbPath = path.join(
  process.env.APPDATA || process.env.HOME,
  '@barmanager',
  'desktop',
  'barmanager.db'
);

console.log('🔍 Diagnóstico de Sincronização do Electron');
console.log('=' .repeat(60));
console.log(`📂 Banco de dados: ${dbPath}`);
console.log('');

// Verificar se o banco existe
if (!fs.existsSync(dbPath)) {
  console.log('❌ Banco de dados não encontrado!');
  console.log('   O aplicativo Electron precisa ser executado pelo menos uma vez.');
  process.exit(1);
}

// Função para executar query via sqlite3 CLI
function query(sql) {
  try {
    const result = execSync(`sqlite3 -json "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
    return result.trim() ? JSON.parse(result) : [];
  } catch (e) {
    // Tentar modo CSV se JSON falhar
    try {
      const result = execSync(`sqlite3 -csv -header "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
      return result.trim();
    } catch (e2) {
      console.error('Erro na query:', e2.message);
      return [];
    }
  }
}

// Função para contar registros
function count(table) {
  try {
    const result = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM ${table}"`, {
      encoding: 'utf-8'
    });
    return parseInt(result.trim()) || 0;
  } catch (e) {
    return 0;
  }
}

try {

  // 1. Verificar Fornecedores (Suppliers)
  console.log('📦 FORNECEDORES (suppliers):');
  const suppliersCount = count('suppliers');
  console.log(`   Total: ${suppliersCount}`);
  if (suppliersCount > 0) {
    console.log(query("SELECT id, name, code, synced FROM suppliers ORDER BY name LIMIT 10"));
  } else {
    console.log('   ⚠️ NENHUM FORNECEDOR ENCONTRADO!');
  }
  console.log('');

  // 2. Verificar Compras (Purchases)
  console.log('📦 COMPRAS (purchases):');
  const purchasesCount = count('purchases');
  console.log(`   Total: ${purchasesCount}`);
  if (purchasesCount > 0) {
    console.log(query("SELECT id, purchase_number, status, total, supplier_id, synced FROM purchases ORDER BY created_at DESC LIMIT 10"));
  } else {
    console.log('   ⚠️ NENHUMA COMPRA ENCONTRADA!');
  }
  console.log('');

  // 3. Verificar Caixas (Cash Boxes)
  console.log('💰 CAIXAS (cash_boxes):');
  const cashBoxesCount = count('cash_boxes');
  console.log(`   Total: ${cashBoxesCount}`);
  if (cashBoxesCount > 0) {
    console.log(query("SELECT id, box_number, status, opening_cash, total_sales, synced FROM cash_boxes ORDER BY opened_at DESC LIMIT 10"));
  } else {
    console.log('   ⚠️ NENHUM CAIXA ENCONTRADO!');
  }
  console.log('');

  // 4. Verificar contagem de todas as tabelas
  console.log('📋 RESUMO DE TODAS AS TABELAS:');
  const tables = ['branches', 'categories', 'suppliers', 'products', 'customers', 'users', 'inventory', 'sales', 'cash_boxes', 'purchases', 'debts', 'settings'];
  tables.forEach(t => {
    const c = count(t);
    const status = c > 0 ? '✅' : '❌';
    console.log(`   ${status} ${t}: ${c} registros`);
  });
  console.log('');

  // 5. Verificar last_sync_date
  console.log('⏰ CONFIGURAÇÕES DE SYNC:');
  console.log(query("SELECT key, value FROM settings WHERE key LIKE '%sync%' OR key = 'last_sync_date'"));
  console.log('');

  console.log('✅ Diagnóstico concluído!');

} catch (error) {
  console.error('❌ Erro:', error.message);
}
