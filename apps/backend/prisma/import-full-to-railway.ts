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
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log('📊 Dados carregados:');
    Object.entries(data).forEach(([table, records]: [string, any]) => {
      if (records.length > 0) {
        console.log(`   ${table}: ${records.length}`);
      }
    });

    console.log('\n🚀 Enviando dados para Railway...');
    const response = await fetch(`${RAILWAY_API}/import/sqlite-data`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('\n✅ Importação concluída!');
    console.log('📊 Resultado:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Erro na importação:', error.message);
    throw error;
  }
}

importData();
