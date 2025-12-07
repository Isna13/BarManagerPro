// Script para sincronizar produtos faltantes do banco local para o Railway
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Produtos do banco local que precisam ser sincronizados
const localProducts = [
  {
    id: '2238662b-79de-467d-906c-93b5ebf921b3',
    name: 'Pé Tinto',
    sku: 'BEB-006',
    unitPrice: 250000,
    costPrice: 200000,
    categoryId: '5446415e-16af-477e-9e80-dbf46b8a2251', // Vinho de garrafa tinto
    unitsPerBox: 24
  },
  {
    id: '5dae0695-b644-4625-b372-3f9e17767232',
    name: 'Mundos',
    sku: 'BEB-007',
    unitPrice: 250000,
    costPrice: 183333,
    categoryId: '5446415e-16af-477e-9e80-dbf46b8a2251', // Vinho de garrafa tinto
    unitsPerBox: 24
  }
];

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

  // Verificar produtos existentes no Railway
  console.log('🔍 Verificando produtos no Railway...');
  const productsRes = await request('GET', '/products', null, token);
  const existingProducts = productsRes.data || [];
  console.log(`Produtos existentes: ${existingProducts.length}`);
  existingProducts.forEach(p => console.log(`   - ${p.id.substring(0, 8)}... : ${p.name}`));

  // Sincronizar produtos faltantes
  console.log('\n📦 Sincronizando produtos faltantes...\n');
  
  for (const product of localProducts) {
    // Verificar se já existe pelo ID
    const existsById = existingProducts.some(p => p.id === product.id);
    // Verificar se já existe pelo nome
    const existsByName = existingProducts.some(p => p.name === product.name);
    
    if (existsById) {
      console.log(`ℹ️ ${product.name} já existe (mesmo ID)`);
      continue;
    }
    
    if (existsByName) {
      const existing = existingProducts.find(p => p.name === product.name);
      console.log(`ℹ️ ${product.name} já existe com ID diferente: ${existing.id}`);
      console.log(`   ID local: ${product.id}`);
      continue;
    }
    
    console.log(`📤 Criando produto: ${product.name}...`);
    
    const createRes = await request('POST', '/products', {
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      unitPrice: product.unitPrice,
      costPrice: product.costPrice,
      unitsPerBox: product.unitsPerBox,
      minStock: 10,
      maxStock: 500,
      currentStock: 0
    }, token);

    if (createRes.status === 201 || createRes.status === 200) {
      console.log(`   ✅ Criado com sucesso!`);
    } else {
      console.log(`   ❌ Erro ${createRes.status}: ${createRes.data?.message || JSON.stringify(createRes.data)}`);
    }
  }

  // Agora completar a compra CP251203-0002 que usa Pé Tinto
  console.log('\n\n📦 Corrigindo compra CP251203-0002...');
  
  // Verificar se Pé Tinto foi criado
  const updatedProducts = await request('GET', '/products', null, token);
  const petinto = updatedProducts.data?.find(p => p.name === 'Pé Tinto');
  
  if (petinto) {
    console.log(`   Pé Tinto encontrado: ${petinto.id}`);
    
    // Reabrir compra
    const reopenRes = await request('PUT', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', { status: 'pending' }, token);
    if (reopenRes.status === 200) {
      console.log('   ✅ Compra reaberta');
      
      // Adicionar item
      const itemRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/items', {
        productId: petinto.id,
        qtyUnits: 30,
        unitCost: 1200000
      }, token);
      
      if (itemRes.status === 201 || itemRes.status === 200) {
        console.log('   ✅ Item adicionado');
        
        // Completar
        const completeRes = await request('POST', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1/complete', null, token);
        if (completeRes.status === 200 || completeRes.status === 201) {
          console.log('   ✅ Compra finalizada');
        } else {
          await request('PUT', '/purchases/0cfa9102-fc73-4ba6-90be-8591c11af9a1', { status: 'completed' }, token);
          console.log('   ✅ Status atualizado para completed');
        }
      } else {
        console.log(`   ❌ Erro ao adicionar item: ${itemRes.status}`, itemRes.data?.message);
      }
    } else {
      console.log(`   ❌ Erro ao reabrir: ${reopenRes.status}`);
    }
  } else {
    console.log('   ❌ Pé Tinto não encontrado no Railway');
  }

  // Resultado final
  console.log('\n\n═══════════════════════════════════════');
  console.log('           RESULTADO FINAL');
  console.log('═══════════════════════════════════════\n');
  
  const finalProducts = await request('GET', '/products', null, token);
  console.log(`📦 Produtos: ${finalProducts.data?.length || 0}`);
  (finalProducts.data || []).forEach(p => console.log(`   • ${p.name} (${p.id.substring(0, 8)}...)`));
  
  const finalPurchases = await request('GET', '/purchases', null, token);
  const purchases = finalPurchases.data || [];
  console.log(`\n🛒 Compras:`);
  
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
