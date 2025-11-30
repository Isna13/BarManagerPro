const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function checkData() {
  // Login
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

  console.log('=== Verificando dados no Railway ===\n');

  // Verificar algumas tabelas
  const endpoints = [
    { name: 'Categorias', url: '/categories' },
    { name: 'Produtos', url: '/products?take=100' },
    { name: 'Clientes', url: '/customers' },
    { name: 'Vendas', url: '/sales?take=100' },
  ];

  for (const ep of endpoints) {
    try {
      const response = await fetch(`${RAILWAY_API}${ep.url}`, { headers });
      const data = await response.json();
      console.log(`${ep.name}: ${Array.isArray(data) ? data.length : 'N/A'} registros`);
      
      if (ep.name === 'Produtos' && data.length > 0) {
        console.log('  Primeiro produto:', data[0]?.name);
      }
      if (ep.name === 'Vendas' && data.length > 0) {
        console.log('  Primeira venda:', data[0]?.saleNumber);
      }
    } catch (error: any) {
      console.log(`${ep.name}: Erro - ${error.message}`);
    }
  }
}

checkData();
