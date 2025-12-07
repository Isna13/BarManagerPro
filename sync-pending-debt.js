// Script para sincronizar dívidas pendentes do banco local para o Railway
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Dívida pendente a sincronizar
const pendingDebt = {
  id: 'c9e9d4c9-5436-4b27-8bbc-5b2f50516e3b',
  customerId: '411d8920-20b7-4f13-b152-154767b1c131',
  saleId: '165ba695-f4f7-4f9e-9c1d-9f67cc6680bb',
  branchId: 'main-branch',
  amount: 240000,
  notes: 'Vale referente à venda SALE-1764780649316 - Sincronizado via script'
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
  
  if (authRes.status !== 201 && authRes.status !== 200) {
    console.error('❌ Falha na autenticação:', authRes);
    return;
  }
  
  const token = authRes.data.accessToken;
  console.log('✅ Autenticado!\n');

  // Verificar se a dívida já existe
  console.log('🔍 Verificando se dívida já existe...');
  const checkRes = await request('GET', `/debts/${pendingDebt.id}`, null, token);
  
  if (checkRes.status === 200) {
    console.log('ℹ️ Dívida já existe no Railway:', pendingDebt.id);
    console.log(JSON.stringify(checkRes.data, null, 2));
    return;
  }

  // Criar a dívida
  console.log('\n📤 Criando dívida no Railway...');
  console.log('Dados:', JSON.stringify(pendingDebt, null, 2));
  
  const createRes = await request('POST', '/debts', pendingDebt, token);
  
  if (createRes.status === 201 || createRes.status === 200) {
    console.log('\n✅ Dívida criada com sucesso!');
    console.log(JSON.stringify(createRes.data, null, 2));
  } else {
    console.log('\n❌ Erro ao criar dívida:');
    console.log(`Status: ${createRes.status}`);
    console.log(JSON.stringify(createRes.data, null, 2));
  }

  // Verificar todas as dívidas
  console.log('\n=== TODAS AS DÍVIDAS NO RAILWAY ===');
  const allDebts = await request('GET', '/debts', null, token);
  if (allDebts.status === 200 && Array.isArray(allDebts.data)) {
    console.log(`Total: ${allDebts.data.length} dívidas`);
    allDebts.data.forEach(d => {
      const statusEmoji = d.status === 'paid' ? '✅' : '⏳';
      console.log(`  ${statusEmoji} ID: ${d.id.substring(0, 8)}... | Valor: ${d.amount} FCFA | Status: ${d.status}`);
    });
  }
}

main().catch(console.error);
