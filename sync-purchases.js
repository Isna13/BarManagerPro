// Script para sincronizar todas as compras do banco local para o Railway
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Compras do banco local que precisam ser sincronizadas
const localPurchases = [
  {
    id: 'af979c33-1d77-4e04-a699-4470d61a2c5b',
    purchaseNumber: 'CP251203-0003',
    supplierId: '157b6b29-73dd-45bf-8c76-e135d0ab1947', // Precisa verificar se existe
    branchId: 'main-branch',
    total: 5500000,
    status: 'completed',
    items: [
      { id: 'e88fb707-e4a1-4be6-a8a4-7e3f89b51ff6', productId: '5dae0695-b644-4625-b372-3f9e17767232', qtyUnits: 30, unitCost: 1100000, total: 5500000 }
    ]
  },
  {
    id: '0cfa9102-fc73-4ba6-90be-8591c11af9a1',
    purchaseNumber: 'CP251203-0002',
    supplierId: '157b6b29-73dd-45bf-8c76-e135d0ab1947',
    branchId: 'main-branch',
    total: 6000000,
    status: 'completed',
    items: [
      { id: '37e7b604-8839-4683-abc6-304ece0c20ee', productId: '2238662b-79de-467d-906c-93b5ebf921b3', qtyUnits: 30, unitCost: 1200000, total: 6000000 }
    ]
  },
  {
    id: '56e7c5f1-6ba2-430d-b8b0-f8ad35d8b21a',
    purchaseNumber: 'CP251203-0001',
    supplierId: 'dac7de33-5f04-4225-bbf4-6aedd8942de6', // Alvalade
    branchId: 'main-branch',
    total: 5160000,
    status: 'completed',
    items: [
      { id: '020a52f1-030a-4c8e-845c-3776d289c92c', productId: 'fe8de121-7e47-475f-a2bf-1cc4517844bf', qtyUnits: 48, unitCost: 1080000, total: 2160000 },
      { id: '0fe5a344-660a-49e7-96bf-282add3ed09c', productId: '2ea37c49-e16d-4c0a-b36a-ec502f0b20b3', qtyUnits: 96, unitCost: 750000, total: 3000000 }
    ]
  },
  {
    id: '9543a5a2-3972-4e8b-a5e0-a1091bcf880e',
    purchaseNumber: 'CP251202-0001',
    supplierId: 'dac7de33-5f04-4225-bbf4-6aedd8942de6', // Alvalade
    branchId: 'main-branch',
    total: 20490000,
    status: 'completed',
    items: [
      { id: '4f1f2105-57a7-4f83-8fb3-52ec58fdec9f', productId: '3d25c55d-0847-4491-b62e-65be47093dbc', qtyUnits: 120, unitCost: 800000, total: 4000000 },
      { id: '92912892-84d9-4ac8-8508-4d8e87008954', productId: 'fe8de121-7e47-475f-a2bf-1cc4517844bf', qtyUnits: 72, unitCost: 1080000, total: 3240000 },
      { id: 'bacd2134-209a-4c16-ac7f-def9762583c1', productId: 'b4703cba-5992-4c56-a67b-c30588bb73a8', qtyUnits: 60, unitCost: 1000000, total: 5000000 },
      { id: '7f89838b-6c4c-46fc-8f58-856cc203ccf5', productId: 'c5b3a8cc-d072-4c01-8754-097b53fba8ce', qtyUnits: 192, unitCost: 750000, total: 6000000 },
      { id: 'ede7eb99-e2fc-4c55-8e94-2dc0f1e33154', productId: '2ea37c49-e16d-4c0a-b36a-ec502f0b20b3', qtyUnits: 72, unitCost: 750000, total: 2250000 }
    ]
  }
];

// IDs das compras vazias no Railway que precisam ser excluídas ou atualizadas
const emptyPurchasesInRailway = [
  '054441d0-5f34-4bd6-b205-0a6ccf1d8ec7',
  'fc16832b-97b8-4429-b89d-cb19c295103f'
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

  // Primeiro, verificar os fornecedores
  console.log('🔍 Verificando fornecedores...');
  const suppliersRes = await request('GET', '/suppliers', null, token);
  const suppliers = suppliersRes.data || [];
  console.log('Fornecedores disponíveis:');
  suppliers.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
  
  // Verificar se o fornecedor 157b6b29-73dd-45bf-8c76-e135d0ab1947 existe
  const supplierExists = suppliers.some(s => s.id === '157b6b29-73dd-45bf-8c76-e135d0ab1947');
  if (!supplierExists) {
    console.log('\n⚠️ Fornecedor 157b6b29-73dd-45bf-8c76-e135d0ab1947 não existe no Railway.');
    console.log('   Usando fornecedor Alvalade (dac7de33-5f04-4225-bbf4-6aedd8942de6) como substituto...');
  }

  // Sincronizar cada compra
  console.log('\n📦 SINCRONIZANDO COMPRAS...\n');
  
  for (const purchase of localPurchases) {
    console.log(`\n=== Processando: ${purchase.purchaseNumber} ===`);
    
    // Verificar se já existe
    const checkRes = await request('GET', `/purchases/${purchase.id}`, null, token);
    
    if (checkRes.status === 200 && checkRes.data) {
      console.log(`ℹ️ Compra já existe: ${purchase.id}`);
      console.log(`   Total atual: ${checkRes.data.total}, Itens: ${checkRes.data.items?.length || 0}`);
      
      // Se existe mas está vazia, atualizar
      if (checkRes.data.total === 0 || (checkRes.data.items?.length || 0) === 0) {
        console.log('   ⚠️ Compra existe mas está vazia/incompleta. Atualizando...');
        
        // Atualizar total
        const updateRes = await request('PUT', `/purchases/${purchase.id}`, {
          total: purchase.total,
          status: purchase.status
        }, token);
        
        if (updateRes.status === 200) {
          console.log(`   ✅ Total atualizado para ${purchase.total}`);
        } else {
          console.log(`   ❌ Erro ao atualizar: ${updateRes.status}`, updateRes.data);
        }
        
        // Adicionar itens
        for (const item of purchase.items) {
          const itemRes = await request('POST', `/purchases/${purchase.id}/items`, {
            productId: item.productId,
            qtyUnits: item.qtyUnits,
            unitCost: item.unitCost
          }, token);
          
          if (itemRes.status === 201 || itemRes.status === 200) {
            console.log(`   ✅ Item adicionado: ${item.qtyUnits} unidades`);
          } else {
            console.log(`   ❌ Erro ao adicionar item: ${itemRes.status}`, itemRes.data?.message || itemRes.data);
          }
        }
      }
      continue;
    }
    
    // Usar fornecedor existente se o original não existir
    let supplierId = purchase.supplierId;
    if (!suppliers.some(s => s.id === supplierId)) {
      supplierId = 'dac7de33-5f04-4225-bbf4-6aedd8942de6'; // Alvalade como fallback
      console.log(`   ⚠️ Usando fornecedor Alvalade como substituto`);
    }
    
    // Criar a compra
    console.log(`📤 Criando compra ${purchase.purchaseNumber}...`);
    const createRes = await request('POST', '/purchases', {
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      supplierId: supplierId,
      branchId: purchase.branchId,
      total: purchase.total,
      status: 'pending' // Criar como pending para poder adicionar itens
    }, token);
    
    if (createRes.status === 201 || createRes.status === 200) {
      console.log(`✅ Compra criada: ${purchase.id}`);
      
      // Adicionar itens
      console.log(`   Adicionando ${purchase.items.length} itens...`);
      for (const item of purchase.items) {
        const itemRes = await request('POST', `/purchases/${purchase.id}/items`, {
          productId: item.productId,
          qtyUnits: item.qtyUnits,
          unitCost: item.unitCost
        }, token);
        
        if (itemRes.status === 201 || itemRes.status === 200) {
          console.log(`   ✅ Item: ${item.qtyUnits} un x ${item.unitCost/100} = ${item.total/100} FCFA`);
        } else {
          console.log(`   ❌ Erro item: ${itemRes.status}`, itemRes.data?.message || itemRes.data);
        }
      }
      
      // Completar a compra se estava completed
      if (purchase.status === 'completed') {
        const completeRes = await request('POST', `/purchases/${purchase.id}/complete`, null, token);
        if (completeRes.status === 200 || completeRes.status === 201) {
          console.log(`   ✅ Compra marcada como completed`);
        } else {
          // Tentar atualizar status manualmente
          const updateRes = await request('PUT', `/purchases/${purchase.id}`, { status: 'completed' }, token);
          if (updateRes.status === 200) {
            console.log(`   ✅ Status atualizado para completed`);
          } else {
            console.log(`   ⚠️ Não foi possível marcar como completed: ${completeRes.status}`);
          }
        }
      }
    } else {
      console.log(`❌ Erro ao criar compra: ${createRes.status}`);
      console.log(JSON.stringify(createRes.data, null, 2));
    }
  }

  // Verificar resultado final
  console.log('\n\n=== RESULTADO FINAL ===');
  const finalRes = await request('GET', '/purchases', null, token);
  if (finalRes.status === 200) {
    const purchases = Array.isArray(finalRes.data) ? finalRes.data : finalRes.data?.data || [];
    console.log(`Total de compras no Railway: ${purchases.length}\n`);
    
    let totalValue = 0;
    purchases.forEach(p => {
      const itemCount = p.items?.length || 0;
      totalValue += p.total || 0;
      const statusIcon = p.status === 'completed' ? '✅' : '⏳';
      console.log(`${statusIcon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${itemCount} itens) - ${p.status}`);
    });
    console.log(`\n💰 Valor total de compras: ${(totalValue/100).toLocaleString()} FCFA`);
  }
}

main().catch(console.error);
