// Script para criar Pé Tinto com os campos corretos do DTO
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

  // Criar Pé Tinto com campos corretos do DTO
  console.log('📦 Criando Pé Tinto com campos corretos...');
  const createRes = await request('POST', '/products', {
    id: '2238662b-79de-467d-906c-93b5ebf921b3',
    name: 'Pé Tinto',
    sku: 'BEB-006',
    categoryId: '5446415e-16af-477e-9e80-dbf46b8a2251', // Vinho de garrafa tinto (do banco local)
    priceUnit: 250000,  // Campo correto
    costUnit: 200000,   // Campo correto
    unitsPerBox: 24
  }, token);

  console.log(`Status: ${createRes.status}`);
  if (createRes.status === 201 || createRes.status === 200) {
    console.log('✅ Pé Tinto criado!');
    console.log(JSON.stringify(createRes.data, null, 2));
  } else {
    console.log('❌ Erro:', JSON.stringify(createRes.data, null, 2));
    
    // Tentar sem categoryId (pode não existir no Railway)
    console.log('\n📦 Tentando sem categoryId...');
    const createRes2 = await request('POST', '/products', {
      id: '2238662b-79de-467d-906c-93b5ebf921b3',
      name: 'Pé Tinto',
      sku: 'BEB-006',
      priceUnit: 250000,
      costUnit: 200000,
      unitsPerBox: 24
    }, token);
    
    console.log(`Status: ${createRes2.status}`);
    if (createRes2.status === 201 || createRes2.status === 200) {
      console.log('✅ Pé Tinto criado!');
    } else {
      console.log('❌ Erro:', JSON.stringify(createRes2.data, null, 2));
      
      // Verificar categorias disponíveis
      console.log('\n🔍 Categorias disponíveis:');
      const catsRes = await request('GET', '/products/categories', null, token);
      (catsRes.data || []).forEach(c => console.log(`   - ${c.id}: ${c.name}`));
      
      // Tentar com categoria Cerveja
      console.log('\n📦 Tentando com categoria Cerveja...');
      const createRes3 = await request('POST', '/products', {
        id: '2238662b-79de-467d-906c-93b5ebf921b3',
        name: 'Pé Tinto',
        sku: 'BEB-006',
        categoryId: 'c8a5000a-cd35-410e-b1dc-6499ac11de36', // Cerveja
        priceUnit: 250000,
        costUnit: 200000,
        unitsPerBox: 24
      }, token);
      
      console.log(`Status: ${createRes3.status}`);
      console.log(JSON.stringify(createRes3.data, null, 2));
    }
  }

  // Se criou, atualizar a compra
  const productsRes = await request('GET', '/products', null, token);
  const petinto = productsRes.data?.find(p => p.name === 'Pé Tinto');
  
  if (petinto) {
    console.log(`\n✅ Pé Tinto encontrado: ${petinto.id}`);
    
    // Reabrir e adicionar item à compra
    console.log('\n📦 Corrigindo compra CP251203-0002...');
    await request('PUT', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', { status: 'pending' }, token);
    
    const itemRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/items', {
      productId: petinto.id,
      qtyUnits: 30,
      unitCost: 1200000
    }, token);
    
    if (itemRes.status === 201 || itemRes.status === 200) {
      console.log('   ✅ Item adicionado');
      await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/complete', null, token);
      console.log('   ✅ Compra finalizada');
    } else {
      console.log(`   ❌ Erro: ${itemRes.status}`, itemRes.data?.message);
    }
  }

  // Resultado final
  console.log('\n=== RESULTADO FINAL ===');
  const finalProducts = await request('GET', '/products', null, token);
  console.log(`Produtos: ${finalProducts.data?.length}`);
  
  const finalPurchases = await request('GET', '/purchases', null, token);
  (finalPurchases.data || []).forEach(p => {
    const icon = p.status === 'completed' ? '✅' : '⏳';
    console.log(`${icon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${p.items?.length || 0} itens)`);
  });
}

main().catch(console.error);
