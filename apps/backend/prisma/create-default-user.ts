const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function createDefaultUser() {
  console.log('🔐 Fazendo login...');
  const loginResponse = await fetch(`${RAILWAY_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@barmanager.com',
      password: 'Admin@123456',
    }),
  });
  const { accessToken } = await loginResponse.json();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  console.log('📤 Enviando dados para criar default-user...');
  
  // Enviar uma chamada de importação só com o payload mínimo para trigger o upsert
  const payload = {
    branches: [], // vazio, só para trigger a lógica
  };

  const response = await fetch(`${RAILWAY_API}/import/sqlite-data`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  console.log('Resultado:', result);

  // Verificar usuários
  console.log('\n📋 Verificando usuários...');
  const usersResponse = await fetch(`${RAILWAY_API}/users`, { headers });
  const users = await usersResponse.json();
  console.log('Usuários:', JSON.stringify(users, null, 2));
}

createDefaultUser();
