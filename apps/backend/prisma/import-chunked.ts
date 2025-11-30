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

    // Tabelas principais para importar (em ordem de dependência)
    const tablesToImport = [
      'branches',
      'suppliers', // suppliers antes de products (foreign key)
      'categories',
      'products',
      'customers',
      'inventory_items',
      'sales',
      'sale_items',
      'cash_boxes',
      'debts',
    ];

    console.log('\n🚀 Importando dados em partes...\n');

    for (const table of tablesToImport) {
      const records = fullData[table] || [];
      if (records.length === 0) continue;

      console.log(`📤 ${table}: ${records.length} registros...`);
      
      // Enviar apenas essa tabela
      const payload = { [table]: records };
      
      const response = await fetch(`${RAILWAY_API}/import/sqlite-data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (!response.ok || result.success === false) {
        console.log(`   ❌ Erro: ${JSON.stringify(result).substring(0, 200)}`);
      } else {
        console.log(`   ✅ Importado: ${JSON.stringify(result.stats || result).substring(0, 100)}`);
      }
    }

    console.log('\n✅ Importação concluída!');
  } catch (error: any) {
    console.error('❌ Erro na importação:', error.message);
    throw error;
  }
}

importData();
