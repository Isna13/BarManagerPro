import * as fs from 'fs';
import * as path from 'path';

const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYTI0OTE2NC00ZTY0LTRjNGItYjY0NC1hNzQzYTE5OWYyNjYiLCJlbWFpbCI6ImFkbWluQGJhcm1hbmFnZXIuY29tIiwiYnJhbmNoSWQiOm51bGwsImlhdCI6MTc2NDQ5ODQxMCwiZXhwIjoxNzY1MTAzMjEwfQ.Vm9Tt8l7b9j6ozesULs7oD6xO-toEphfsYAPuYp274E';

async function importData() {
  try {
    console.log('📂 Lendo dados exportados...');
    const dataPath = path.join(__dirname, 'sqlite-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log('🚀 Enviando dados para Railway...');
    const response = await fetch(`${RAILWAY_API}/import/sqlite-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('\n✅ Importação concluída!');
    console.log('📊 Estatísticas:', result.stats);
  } catch (error) {
    console.error('❌ Erro na importação:', error.message);
    throw error;
  }
}

importData();
