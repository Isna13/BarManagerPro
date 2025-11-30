import * as fs from 'fs';
import * as path from 'path';

const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function getToken(): Promise<string> {
  const response = await fetch(`${RAILWAY_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@barmanager.com',
      password: 'Admin@123456',
    }),
  });
  const data = await response.json();
  return data.accessToken;
}

async function importTable(tableName: string, records: any[], headers: any): Promise<boolean> {
  if (!records || records.length === 0) {
    console.log(`   ⏭️  ${tableName}: sem registros`);
    return true;
  }

  console.log(`📤 ${tableName}: ${records.length} registros...`);

  // Para tabelas grandes, dividir em lotes menores
  const BATCH_SIZE = 50;
  const batches = [];
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    batches.push(records.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const payload = { [tableName]: batches[i] };
    
    try {
      const response = await fetch(`${RAILWAY_API}/import/sqlite-data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`   ❌ Lote ${i + 1}/${batches.length}: ${error.substring(0, 150)}`);
        return false;
      }
      
      if (batches.length > 1) {
        console.log(`   ✅ Lote ${i + 1}/${batches.length} importado`);
      }
    } catch (err: any) {
      console.log(`   ❌ Erro: ${err.message}`);
      return false;
    }
  }

  console.log(`   ✅ ${tableName} importado com sucesso`);
  return true;
}

async function importData() {
  try {
    console.log('🔐 Obtendo token de autenticação...');
    const token = await getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    console.log('📂 Lendo dados exportados...');
    const dataPath = path.join(__dirname, 'sqlite-full-export.json');
    const fullData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Ordem de importação respeitando dependências
    const importOrder = [
      // Tabelas base (sem dependências)
      'branches',
      'categories',
      'suppliers',
      'customers',
      'products',
      'tables',
      
      // Tabelas com dependências de tabelas base
      'inventory_items',
      'inventory',
      'sales',
      'cash_boxes',
      'debts',
      'purchases',
      'purchase_items',
      
      // Tabelas com dependências de vendas/dívidas
      'sale_items',
      'payments',
      'debt_payments',
      
      // Tabelas de mesa (com dependências hierárquicas)
      'table_sessions',
      'table_customers',
      'table_orders',
      'table_payments',
      'table_actions',
      
      // Movimentação de estoque
      'stock_movements',
      
      // Configurações
      'settings',
    ];

    console.log('\n🚀 Importando dados em ordem de dependência...\n');
    console.log('=' .repeat(50));

    let successCount = 0;
    let failCount = 0;

    for (const table of importOrder) {
      const records = fullData[table];
      const success = await importTable(table, records, headers);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n✅ Importação concluída!`);
    console.log(`   ✓ Sucesso: ${successCount} tabelas`);
    console.log(`   ✗ Falhas: ${failCount} tabelas`);

    // Resumo dos dados
    console.log('\n📊 Resumo dos dados:');
    let total = 0;
    for (const table of importOrder) {
      const count = fullData[table]?.length || 0;
      if (count > 0) {
        console.log(`   ${table}: ${count}`);
        total += count;
      }
    }
    console.log(`   ---`);
    console.log(`   TOTAL: ${total} registros`);

  } catch (error: any) {
    console.error('❌ Erro na importação:', error.message);
    throw error;
  }
}

importData();
