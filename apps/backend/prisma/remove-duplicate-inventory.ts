/**
 * Script para remover o registro de inventário duplicado
 */

const RAILWAY_API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function login(): Promise<string> {
  const response = await fetch(`${RAILWAY_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    })
  });
  
  const data = await response.json() as { accessToken: string };
  return data.accessToken;
}

async function main() {
  try {
    const token = await login();
    console.log('✅ Login OK');
    
    // ID do registro duplicado a ser removido
    const duplicateId = 'adjust-by-product';
    
    console.log(`🗑️ Removendo registro duplicado: ${duplicateId}`);
    
    const response = await fetch(`${RAILWAY_API_URL}/inventory/${duplicateId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      console.log('✅ Registro duplicado removido com sucesso!');
    } else {
      const error = await response.text();
      console.log(`❌ Erro ao remover: ${response.status} - ${error}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

main();
