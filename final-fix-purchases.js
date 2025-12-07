// Script FINAL para corrigir produtos e completar as compras
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Mapeamento: ID local -> ID Railway
const productMapping = {
  // Mundos - já existe no Railway com ID diferente
  '5dae0695-b644-4625-b372-3f9e17767232': '026fbed3-3328-415c-8afc-04febe772338',
  // Pé Tinto - precisa ser criado
  '2238662b-79de-467d-906c-93b5ebf921b3': null
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

  // 1. Criar Pé Tinto
  console.log('📦 Criando produto Pé Tinto...');
  const petintoRes = await request('POST', '/products', {
    id: '2238662b-79de-467d-906c-93b5ebf921b3',
    name: 'Pé Tinto',
    sku: 'PETINTO-001',
    categoryId: 'c8a5000a-cd35-410e-b1dc-6499ac11de36', // Cerveja
    unitPrice: 150000,
    costPrice: 120000,
    unitsPerBox: 24,
    branchId: 'main-branch',
    minStock: 10,
    maxStock: 500,
    currentStock: 30
  }, token);
  
  if (petintoRes.status === 201 || petintoRes.status === 200) {
    console.log('✅ Pé Tinto criado com sucesso!');
    productMapping['2238662b-79de-467d-906c-93b5ebf921b3'] = '2238662b-79de-467d-906c-93b5ebf921b3';
  } else {
    console.log(`❌ Erro: ${petintoRes.status}`, petintoRes.data?.message || petintoRes.data);
    // Tentar sem o ID específico
    console.log('   Tentando criar sem ID específico...');
    const petinto2Res = await request('POST', '/products', {
      name: 'Pé Tinto',
      sku: 'PETINTO-001',
      categoryId: 'c8a5000a-cd35-410e-b1dc-6499ac11de36',
      unitPrice: 150000,
      costPrice: 120000,
      unitsPerBox: 24,
      branchId: 'main-branch',
      minStock: 10,
      maxStock: 500,
      currentStock: 30
    }, token);
    
    if (petinto2Res.status === 201 || petinto2Res.status === 200) {
      productMapping['2238662b-79de-467d-906c-93b5ebf921b3'] = petinto2Res.data.id;
      console.log(`   ✅ Criado com ID: ${petinto2Res.data.id}`);
    } else {
      console.log(`   ❌ Erro final:`, petinto2Res.data?.message);
    }
  }

  // 2. Corrigir as compras incompletas
  console.log('\n📋 Corrigindo compras incompletas...');
  
  const purchasesToFix = [
    { 
      id: 'af979c33-1d77-4e04-a699-4470d61a2c5b', 
      number: 'CP251203-0003',
      localProductId: '5dae0695-b644-4625-b372-3f9e17767232', // Mundos
      qtyUnits: 30, 
      unitCost: 1100000 
    },
    { 
      id: '0cfa9102-fc73-4ba6-90be-8591c11af9a1', 
      number: 'CP251203-0002',
      localProductId: '2238662b-79de-467d-906c-93b5ebf921b3', // Pé Tinto
      qtyUnits: 30, 
      unitCost: 1200000 
    }
  ];

  for (const purchase of purchasesToFix) {
    console.log(`\n📦 Processando: ${purchase.number}`);
    
    // Obter o ID do produto correto (Railway)
    const railwayProductId = productMapping[purchase.localProductId];
    if (!railwayProductId) {
      console.log(`   ❌ Produto não mapeado: ${purchase.localProductId}`);
      continue;
    }
    console.log(`   Usando produto Railway: ${railwayProductId}`);
    
    // 1. Reabrir a compra (status -> pending)
    const reopenRes = await request('PUT', `/purchases/${purchase.id}`, { status: 'pending' }, token);
    if (reopenRes.status !== 200) {
      console.log(`   ❌ Não conseguiu reabrir: ${reopenRes.status}`);
      continue;
    }
    console.log('   ✅ Compra reaberta');
    
    // 2. Adicionar item
    const itemRes = await request('POST', `/purchases/${purchase.id}/items`, {
      productId: railwayProductId,
      qtyUnits: purchase.qtyUnits,
      unitCost: purchase.unitCost
    }, token);
    
    if (itemRes.status === 201 || itemRes.status === 200) {
      console.log(`   ✅ Item adicionado: ${purchase.qtyUnits} unidades`);
    } else {
      console.log(`   ❌ Erro ao adicionar item: ${itemRes.status}`, itemRes.data?.message);
    }
    
    // 3. Completar a compra
    const completeRes = await request('POST', `/purchases/${purchase.id}/complete`, null, token);
    if (completeRes.status === 200 || completeRes.status === 201) {
      console.log('   ✅ Compra finalizada');
    } else {
      // Fallback
      await request('PUT', `/purchases/${purchase.id}`, { status: 'completed' }, token);
      console.log('   ✅ Status atualizado para completed');
    }
  }

  // 3. Remover compras órfãs (PUR-*)
  console.log('\n🗑️ Verificando compras órfãs...');
  const orphanPurchases = [
    'fc16832b-97b8-4429-b89d-cb19c295103f', // PUR-1764760857483
    '054441d0-5f34-4bd6-b205-0a6ccf1d8ec7'  // PUR-1764716166201
  ];
  
  for (const id of orphanPurchases) {
    const deleteRes = await request('DELETE', `/purchases/${id}`, null, token);
    if (deleteRes.status === 200 || deleteRes.status === 204) {
      console.log(`   ✅ Compra ${id.substring(0, 8)}... removida`);
    } else {
      console.log(`   ⚠️ Não foi possível remover ${id.substring(0, 8)}... (${deleteRes.status})`);
    }
  }

  // Resultado final
  console.log('\n\n═══════════════════════════════════════');
  console.log('           RESULTADO FINAL');
  console.log('═══════════════════════════════════════\n');
  
  const finalProducts = await request('GET', '/products', null, token);
  console.log(`📦 Produtos: ${finalProducts.data?.length || 0}`);
  (finalProducts.data || []).forEach(p => console.log(`   • ${p.name}`));
  
  const finalPurchases = await request('GET', '/purchases', null, token);
  const purchases = finalPurchases.data || [];
  console.log(`\n🛒 Compras: ${purchases.length}`);
  
  let totalItems = 0;
  let totalValue = 0;
  purchases.forEach(p => {
    const icon = p.status === 'completed' ? '✅' : '⏳';
    const items = p.items?.length || 0;
    totalItems += items;
    totalValue += p.total || 0;
    console.log(`   ${icon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${items} itens)`);
  });
  
  console.log(`\n   📊 Total de itens: ${totalItems}`);
  console.log(`   💰 Valor total: ${(totalValue/100).toLocaleString()} FCFA`);
}

main().catch(console.error);
