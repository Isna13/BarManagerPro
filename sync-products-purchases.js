// Script para sincronizar produtos e fornecedores faltantes, depois completar as compras
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Produtos do banco local que podem estar faltando no Railway
const localProducts = [
  { id: '5dae0695-b644-4625-b372-3f9e17767232', name: 'Mundos', sku: 'MUNDOS-001', categoryId: 'category-cervejas', unitPrice: 150000, costPrice: 110000, unitsPerBox: 24 },
  { id: '2238662b-79de-467d-906c-93b5ebf921b3', name: 'Pé Tinto', sku: 'PETINTO-001', categoryId: 'category-cervejas', unitPrice: 150000, costPrice: 120000, unitsPerBox: 24 }
];

// Fornecedor faltante
const missingSupplier = {
  id: '157b6b29-73dd-45bf-8c76-e135d0ab1947',
  name: 'Fornecedor Novo',
  phone: '+245955000000'
};

// Itens que falharam - precisam ser adicionados após criar os produtos
const pendingItems = [
  { purchaseId: 'af979c33-1d77-4e04-a699-4470d61a2c5b', productId: '5dae0695-b644-4625-b372-3f9e17767232', qtyUnits: 30, unitCost: 1100000 }, // Mundos
  { purchaseId: '0cfa9102-fc73-4ba6-90be-8591c11af9a1', productId: '2238662b-79de-467d-906c-93b5ebf921b3', qtyUnits: 30, unitCost: 1200000 }  // Pé Tinto
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
  
  if (authRes.status !== 201 && authRes.status !== 200) {
    console.error('❌ Falha na autenticação:', authRes);
    return;
  }
  
  const token = authRes.data.accessToken;
  console.log('✅ Autenticado!\n');

  // Verificar produtos existentes
  console.log('🔍 Verificando produtos no Railway...');
  const productsRes = await request('GET', '/products', null, token);
  const existingProducts = productsRes.data || [];
  console.log(`Total de produtos no Railway: ${existingProducts.length}`);
  existingProducts.forEach(p => console.log(`  - ${p.id.substring(0, 8)}... : ${p.name}`));

  // Criar produtos faltantes
  console.log('\n📦 Criando produtos faltantes...');
  for (const product of localProducts) {
    const exists = existingProducts.some(p => p.id === product.id);
    if (exists) {
      console.log(`ℹ️ Produto já existe: ${product.name}`);
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
      branchId: 'main-branch',
      minStock: 10,
      maxStock: 500,
      currentStock: 0
    }, token);

    if (createRes.status === 201 || createRes.status === 200) {
      console.log(`✅ Produto criado: ${product.name}`);
    } else {
      console.log(`❌ Erro ao criar produto: ${createRes.status}`, createRes.data?.message || createRes.data);
    }
  }

  // Agora adicionar os itens pendentes às compras
  console.log('\n📋 Adicionando itens pendentes às compras...');
  for (const item of pendingItems) {
    // Primeiro, verificar se a compra está como pending (necessário para adicionar itens)
    const purchaseRes = await request('GET', `/purchases/${item.purchaseId}`, null, token);
    
    if (purchaseRes.status !== 200) {
      console.log(`❌ Compra não encontrada: ${item.purchaseId}`);
      continue;
    }

    const purchase = purchaseRes.data;
    console.log(`\n📦 Compra: ${purchase.purchaseNumber} (status: ${purchase.status})`);

    // Se está completed, precisamos reabrir (mas o backend não permite isso)
    // Vamos tentar adicionar o item de qualquer forma ou atualizar diretamente
    if (purchase.status === 'completed') {
      console.log(`   ⚠️ Compra já está completed. Tentando adicionar item mesmo assim...`);
    }

    const itemRes = await request('POST', `/purchases/${item.purchaseId}/items`, {
      productId: item.productId,
      qtyUnits: item.qtyUnits,
      unitCost: item.unitCost
    }, token);

    if (itemRes.status === 201 || itemRes.status === 200) {
      console.log(`   ✅ Item adicionado: ${item.qtyUnits} unidades`);
    } else {
      console.log(`   ❌ Erro: ${itemRes.status}`, itemRes.data?.message || itemRes.data);
    }
  }

  // Verificar resultado final
  console.log('\n\n=== RESULTADO FINAL ===');
  
  // Produtos
  const finalProducts = await request('GET', '/products', null, token);
  console.log(`\n📦 Produtos no Railway: ${finalProducts.data?.length || 0}`);
  
  // Compras
  const finalPurchases = await request('GET', '/purchases', null, token);
  if (finalPurchases.status === 200) {
    const purchases = Array.isArray(finalPurchases.data) ? finalPurchases.data : finalPurchases.data?.data || [];
    console.log(`\n🛒 Compras no Railway: ${purchases.length}`);
    
    let totalValue = 0;
    purchases.forEach(p => {
      const itemCount = p.items?.length || 0;
      totalValue += p.total || 0;
      const statusIcon = p.status === 'completed' ? '✅' : '⏳';
      console.log(`   ${statusIcon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${itemCount} itens)`);
    });
    console.log(`\n   💰 Total: ${(totalValue/100).toLocaleString()} FCFA`);
  }
}

main().catch(console.error);
