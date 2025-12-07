// Script para verificar dívidas no Railway
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_URL,
      port: 443,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('🔐 Autenticando...');
  const authRes = await request('POST', '/auth/login', credentials);
  
  console.log('Auth response:', JSON.stringify(authRes.data, null, 2));
  
  if (authRes.status !== 201 && authRes.status !== 200) {
    console.error('❌ Falha na autenticação:', authRes);
    return;
  }
  
  const token = authRes.data.access_token || authRes.data.accessToken || authRes.data.token;
  console.log('✅ Autenticado! Token:', token ? token.substring(0, 30) + '...' : 'NULL');

  // Verificar dívidas no Railway
  console.log('=== DÍVIDAS NO RAILWAY ===');
  const debtsRes = await request('GET', '/debts', null, token);
  console.log(`Status: ${debtsRes.status}`);
  if (debtsRes.data && Array.isArray(debtsRes.data)) {
    console.log(`Total: ${debtsRes.data.length} dívidas`);
    debtsRes.data.forEach(d => {
      console.log(`  - ID: ${d.id}`);
      console.log(`    Cliente ID: ${d.customerId}`);
      console.log(`    Amount: ${d.amount || d.originalAmount || d.totalAmount}`);
      console.log(`    Status: ${d.status}`);
      console.log(`    Criada: ${d.createdAt}`);
      console.log('');
    });
  } else {
    console.log(JSON.stringify(debtsRes.data, null, 2));
  }
  
  // Buscar dívida específica
  console.log('\n=== BUSCA DÍVIDA ESPECÍFICA (nova) ===');
  const newDebtId = 'c9e9d4c9-5436-4b27-8bbc-5b2f50516e3b';
  const specificDebt = await request('GET', `/debts/${newDebtId}`, null, token);
  console.log(`Status: ${specificDebt.status}`);
  console.log(JSON.stringify(specificDebt.data, null, 2));

  // Verificar vendas recentes
  console.log('\n=== VENDAS RECENTES NO RAILWAY ===');
  const salesRes = await request('GET', '/sales?limit=10', null, token);
  console.log(`Status: ${salesRes.status}`);
  if (salesRes.data && Array.isArray(salesRes.data)) {
    console.log(`Total retornado: ${salesRes.data.length} vendas`);
    salesRes.data.slice(0, 5).forEach(s => {
      console.log(`  - ID: ${s.id}, Total: ${s.total}, Método: ${s.paymentMethod}, Cliente: ${s.customer?.name || 'N/A'}, Data: ${s.createdAt}`);
    });
  } else {
    console.log(JSON.stringify(salesRes.data, null, 2));
  }

  // Verificar clientes
  console.log('\n=== CLIENTES NO RAILWAY ===');
  const customersRes = await request('GET', '/customers', null, token);
  console.log(`Status: ${customersRes.status}`);
  if (customersRes.data && Array.isArray(customersRes.data)) {
    console.log(`Total: ${customersRes.data.length} clientes`);
    customersRes.data.forEach(c => {
      console.log(`  - ID: ${c.id}, Nome: ${c.name}, Telefone: ${c.phone || 'N/A'}`);
    });
  } else {
    console.log(JSON.stringify(customersRes.data, null, 2));
  }
}

main().catch(console.error);
