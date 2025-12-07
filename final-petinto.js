// Script final para criar Pé Tinto com SKU único
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

  // Verificar se Pé Tinto já existe (buscar por nome)
  console.log('🔍 Verificando produtos existentes...');
  const productsRes = await request('GET', '/products', null, token);
  const products = productsRes.data || [];
  
  const petintoExisting = products.find(p => p.name === 'Pé Tinto');
  
  let petintoId = null;
  
  if (petintoExisting) {
    console.log(`✅ Pé Tinto já existe: ${petintoExisting.id}`);
    petintoId = petintoExisting.id;
  } else {
    // Criar com SKU único baseado em timestamp
    const uniqueSku = `PETINTO-${Date.now()}`;
    console.log(`📦 Criando Pé Tinto com SKU: ${uniqueSku}...`);
    
    const petintoRes = await request('POST', '/products', {
      name: 'Pé Tinto',
      sku: uniqueSku,
      categoryId: 'c8a5000a-cd35-410e-b1dc-6499ac11de36',
      priceUnit: 150000, // usando priceUnit ao invés de unitPrice
      costUnit: 120000,  // usando costUnit ao invés de costPrice
      unitsPerBox: 24,
      minStock: 10,
      maxStock: 500,
      isActive: true
    }, token);
    
    console.log(`Status: ${petintoRes.status}`);
    
    if (petintoRes.status === 201 || petintoRes.status === 200) {
      petintoId = petintoRes.data.id;
      console.log(`✅ Pé Tinto criado: ${petintoId}`);
    } else {
      console.log('❌ Erro:', JSON.stringify(petintoRes.data, null, 2));
      return;
    }
  }
  
  // Adicionar à compra CP251203-0002
  console.log('\n📦 Processando compra CP251203-0002...');
  
  // Verificar estado atual
  const purchaseRes = await request('GET', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', null, token);
  console.log(`Estado atual: ${purchaseRes.data?.status}, Itens: ${purchaseRes.data?.items?.length || 0}`);
  
  if ((purchaseRes.data?.items?.length || 0) === 0) {
    // Reabrir compra
    console.log('   Reabrindo compra...');
    await request('PUT', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', { status: 'pending' }, token);
    
    // Adicionar item
    console.log('   Adicionando item...');
    const itemRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/items', {
      productId: petintoId,
      qtyUnits: 30,
      unitCost: 1200000
    }, token);
    
    if (itemRes.status === 201 || itemRes.status === 200) {
      console.log('   ✅ Item adicionado!');
      
      // Completar
      const completeRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/complete', null, token);
      if (completeRes.status === 200 || completeRes.status === 201) {
        console.log('   ✅ Compra finalizada!');
      } else {
        await request('PUT', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', { status: 'completed' }, token);
        console.log('   ✅ Status atualizado para completed');
      }
    } else {
      console.log('   ❌ Erro ao adicionar item:', itemRes.status, itemRes.data?.message);
    }
  } else {
    console.log('   ℹ️ Compra já tem itens');
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
  console.log(`\n🛒 Compras:`);
  
  let totalItems = 0;
  let totalValue = 0;
  let completedCount = 0;
  
  purchases.forEach(p => {
    const icon = p.status === 'completed' ? '✅' : '⏳';
    const items = p.items?.length || 0;
    totalItems += items;
    totalValue += p.total || 0;
    if (p.status === 'completed') completedCount++;
    console.log(`   ${icon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${items} itens)`);
  });
  
  console.log(`\n   📊 Total de itens: ${totalItems}`);
  console.log(`   📊 Compras completas: ${completedCount}/${purchases.length}`);
  console.log(`   💰 Valor total: ${(totalValue/100).toLocaleString()} FCFA`);
}

main().catch(console.error);
