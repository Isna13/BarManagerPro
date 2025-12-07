// Script para criar Pé Tinto e completar CP251203-0002
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
  const token = authRes.data.accessToken;
  console.log('✅ Autenticado!\n');

  // Primeiro, verificar o que está causando o erro 500 - listar categorias e branches
  console.log('🔍 Verificando branches...');
  const branchesRes = await request('GET', '/branches', null, token);
  console.log('Branches:', JSON.stringify(branchesRes.data, null, 2));

  // Verificar se main-branch existe
  const mainBranchRes = await request('GET', '/branches/main-branch', null, token);
  console.log(`\nmain-branch: ${mainBranchRes.status === 200 ? '✅ Existe' : '❌ Não existe'}`);

  // Tentar criar produto sem branchId
  console.log('\n📦 Tentando criar Pé Tinto sem branchId...');
  const petintoRes = await request('POST', '/products', {
    name: 'Pé Tinto',
    sku: 'PETINTO-001',
    categoryId: 'c8a5000a-cd35-410e-b1dc-6499ac11de36',
    unitPrice: 150000,
    costPrice: 120000,
    unitsPerBox: 24,
    minStock: 10,
    maxStock: 500,
    currentStock: 30
  }, token);
  
  console.log(`Status: ${petintoRes.status}`);
  console.log(JSON.stringify(petintoRes.data, null, 2));

  if (petintoRes.status === 201 || petintoRes.status === 200) {
    const petintoId = petintoRes.data.id;
    console.log(`\n✅ Pé Tinto criado: ${petintoId}`);
    
    // Agora adicionar à compra CP251203-0002
    console.log('\n📦 Adicionando item à compra CP251203-0002...');
    
    // Reabrir compra
    const reopenRes = await request('PUT', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', { status: 'pending' }, token);
    console.log(`Reabrir: ${reopenRes.status}`);
    
    // Adicionar item
    const itemRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/items', {
      productId: petintoId,
      qtyUnits: 30,
      unitCost: 1200000
    }, token);
    console.log(`Adicionar item: ${itemRes.status}`, itemRes.data?.message || '');
    
    // Completar
    const completeRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/complete', null, token);
    console.log(`Completar: ${completeRes.status}`);
  }

  // Resultado final
  console.log('\n\n=== COMPRAS FINAIS ===');
  const purchasesRes = await request('GET', '/purchases', null, token);
  (purchasesRes.data || []).forEach(p => {
    const icon = p.status === 'completed' ? '✅' : '⏳';
    console.log(`${icon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${p.items?.length || 0} itens)`);
  });
}

main().catch(console.error);
