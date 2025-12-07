// Script para verificar e sincronizar compras do banco local para o Railway
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
  
  if (authRes.status !== 201 && authRes.status !== 200) {
    console.error('❌ Falha na autenticação:', authRes);
    return;
  }
  
  const token = authRes.data.accessToken;
  console.log('✅ Autenticado!\n');

  // Verificar compras no Railway
  console.log('=== COMPRAS NO RAILWAY ===');
  const purchasesRes = await request('GET', '/purchases', null, token);
  console.log(`Status: ${purchasesRes.status}`);
  
  if (purchasesRes.status === 200) {
    const purchases = Array.isArray(purchasesRes.data) ? purchasesRes.data : purchasesRes.data?.data || [];
    console.log(`Total: ${purchases.length} compras\n`);
    
    purchases.forEach(p => {
      const itemCount = p.items?.length || 0;
      console.log(`  📦 ID: ${p.id}`);
      console.log(`     Número: ${p.purchaseNumber}`);
      console.log(`     Total: ${p.total} FCFA`);
      console.log(`     Status: ${p.status}`);
      console.log(`     Itens: ${itemCount}`);
      console.log(`     Criada: ${p.createdAt}`);
      console.log('');
    });
  } else {
    console.log('Erro:', JSON.stringify(purchasesRes.data, null, 2));
  }

  // Verificar fornecedores
  console.log('\n=== FORNECEDORES NO RAILWAY ===');
  const suppliersRes = await request('GET', '/suppliers', null, token);
  if (suppliersRes.status === 200) {
    const suppliers = Array.isArray(suppliersRes.data) ? suppliersRes.data : suppliersRes.data?.data || [];
    console.log(`Total: ${suppliers.length} fornecedores`);
    suppliers.forEach(s => {
      console.log(`  - ID: ${s.id}, Nome: ${s.name || s.fullName}`);
    });
  }
}

main().catch(console.error);
