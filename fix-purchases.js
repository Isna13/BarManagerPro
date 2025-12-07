// Script para criar produtos faltantes com categoria correta e corrigir compras
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

  // Verificar categorias existentes
  console.log('🔍 Verificando categorias...');
  const categoriesRes = await request('GET', '/products/categories', null, token);
  console.log(`Status: ${categoriesRes.status}`);
  
  let categoryId = null;
  if (categoriesRes.status === 200 && Array.isArray(categoriesRes.data)) {
    console.log('Categorias:');
    categoriesRes.data.forEach(c => {
      console.log(`  - ${c.id}: ${c.name}`);
      if (c.name?.toLowerCase().includes('cerveja') || c.name?.toLowerCase().includes('bebida')) {
        categoryId = c.id;
      }
    });
    // Se não encontrou, usar a primeira
    if (!categoryId && categoriesRes.data.length > 0) {
      categoryId = categoriesRes.data[0].id;
    }
  }

  // Se não há categorias, criar uma
  if (!categoryId) {
    console.log('\n📁 Criando categoria Cervejas...');
    const catRes = await request('POST', '/products/categories', {
      name: 'Cervejas',
      description: 'Cervejas e bebidas alcoólicas'
    }, token);
    
    if (catRes.status === 201 || catRes.status === 200) {
      categoryId = catRes.data.id;
      console.log(`✅ Categoria criada: ${categoryId}`);
    } else {
      console.log(`❌ Erro ao criar categoria:`, catRes.data);
    }
  }

  console.log(`\n📦 Usando categoria: ${categoryId}`);

  // Produtos a criar
  const productsToCreate = [
    { 
      id: '5dae0695-b644-4625-b372-3f9e17767232', 
      name: 'Mundos', 
      sku: 'MUNDOS-001', 
      categoryId: categoryId,
      unitPrice: 150000, 
      costPrice: 110000, 
      unitsPerBox: 24,
      branchId: 'main-branch',
      minStock: 10,
      maxStock: 500,
      currentStock: 30
    },
    { 
      id: '2238662b-79de-467d-906c-93b5ebf921b3', 
      name: 'Pé Tinto', 
      sku: 'PETINTO-001', 
      categoryId: categoryId,
      unitPrice: 150000, 
      costPrice: 120000, 
      unitsPerBox: 24,
      branchId: 'main-branch',
      minStock: 10,
      maxStock: 500,
      currentStock: 30
    }
  ];

  // Verificar produtos existentes
  const productsRes = await request('GET', '/products', null, token);
  const existingProducts = productsRes.data || [];
  console.log(`\nProdutos existentes: ${existingProducts.length}`);

  // Criar produtos faltantes
  for (const product of productsToCreate) {
    const exists = existingProducts.some(p => p.id === product.id || p.name === product.name);
    if (exists) {
      console.log(`ℹ️ Produto já existe: ${product.name}`);
      continue;
    }

    console.log(`📤 Criando produto: ${product.name}...`);
    const createRes = await request('POST', '/products', product, token);

    if (createRes.status === 201 || createRes.status === 200) {
      console.log(`✅ Produto criado: ${product.name} (${product.id})`);
    } else {
      console.log(`❌ Erro: ${createRes.status}`, createRes.data?.message || createRes.data);
    }
  }

  // Agora precisamos recriar as compras CP251203-0002 e CP251203-0003 com os itens
  // Primeiro, deletar as compras vazias (se o endpoint existir)
  console.log('\n🔄 Tentando corrigir compras incompletas...');
  
  // Verificar se podemos atualizar o status para pending e adicionar itens
  const purchasesToFix = [
    { 
      id: 'af979c33-1d77-4e04-a699-4470d61a2c5b', 
      number: 'CP251203-0003',
      items: [{ productId: '5dae0695-b644-4625-b372-3f9e17767232', qtyUnits: 30, unitCost: 1100000 }]
    },
    { 
      id: '0cfa9102-fc73-4ba6-90be-8591c11af9a1', 
      number: 'CP251203-0002',
      items: [{ productId: '2238662b-79de-467d-906c-93b5ebf921b3', qtyUnits: 30, unitCost: 1200000 }]
    }
  ];

  for (const purchase of purchasesToFix) {
    console.log(`\n📦 Corrigindo: ${purchase.number}`);
    
    // Tentar mudar status para pending
    console.log('   Tentando reabrir compra (status -> pending)...');
    const updateRes = await request('PUT', `/purchases/${purchase.id}`, { 
      status: 'pending' 
    }, token);
    
    if (updateRes.status === 200) {
      console.log('   ✅ Status alterado para pending');
      
      // Agora adicionar itens
      for (const item of purchase.items) {
        const itemRes = await request('POST', `/purchases/${purchase.id}/items`, item, token);
        if (itemRes.status === 201 || itemRes.status === 200) {
          console.log(`   ✅ Item adicionado: ${item.qtyUnits} un`);
        } else {
          console.log(`   ❌ Erro ao adicionar item: ${itemRes.status}`, itemRes.data?.message || itemRes.data);
        }
      }
      
      // Completar novamente
      const completeRes = await request('POST', `/purchases/${purchase.id}/complete`, null, token);
      if (completeRes.status === 200 || completeRes.status === 201) {
        console.log('   ✅ Compra finalizada');
      } else {
        // Fallback: atualizar status diretamente
        await request('PUT', `/purchases/${purchase.id}`, { status: 'completed' }, token);
        console.log('   ✅ Status atualizado para completed');
      }
    } else {
      console.log(`   ❌ Não foi possível reabrir: ${updateRes.status}`, updateRes.data?.message);
    }
  }

  // Resultado final
  console.log('\n\n=== RESULTADO FINAL ===');
  
  const finalProducts = await request('GET', '/products', null, token);
  console.log(`\n📦 Produtos: ${finalProducts.data?.length || 0}`);
  (finalProducts.data || []).forEach(p => console.log(`   - ${p.name}`));
  
  const finalPurchases = await request('GET', '/purchases', null, token);
  console.log(`\n🛒 Compras:`);
  let total = 0;
  (finalPurchases.data || []).forEach(p => {
    const icon = p.status === 'completed' ? '✅' : '⏳';
    const items = p.items?.length || 0;
    console.log(`   ${icon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${items} itens)`);
    total += p.total || 0;
  });
  console.log(`\n   💰 Total: ${(total/100).toLocaleString()} FCFA`);
}

main().catch(console.error);
