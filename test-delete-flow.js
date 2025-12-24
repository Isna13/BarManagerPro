/**
 * Teste de verificação de DELETE no Railway
 * 
 * Este script verifica:
 * 1. Se o DELETE está sendo enviado corretamente para o backend
 * 2. Se o produto é marcado como isActive=false no Railway
 * 3. Se os apps mobile estão filtrando produtos inativos
 */

const axios = require('axios');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const TEST_EMAIL = 'isnatchuda1@gmail.com';
const TEST_PASSWORD = 'isna123';

async function login() {
  const response = await axios.post(`${API_URL}/auth/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  console.log('Token prefix:', response.data.accessToken?.substring(0, 50));
  return response.data.accessToken;
}

let globalToken = null;

async function getProducts(token, includeInactive = false) {
  // Buscar produtos - por padrão pode não incluir inativos
  const url = includeInactive 
    ? `${API_URL}/products?active=false`  // Buscar inativos
    : `${API_URL}/products`;               // Buscar todos (ou só ativos?)
  
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  return response.data;
}

// Criar axios client com interceptor para debug
function createClient(token) {
  const client = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  client.interceptors.request.use(config => {
    console.log(`   📡 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  });
  
  return client;
}

async function testDeleteFlow(token) {
  console.log('\n=== TESTE COMPLETO DE DELETE ===\n');
  
  const client = createClient(token);
  
  // 1. Criar um produto de teste
  console.log('1️⃣ Criando produto de teste...');
  const testProduct = {
    sku: `DELETE-TEST-${Date.now()}`,
    name: `Produto Delete Test ${new Date().toISOString()}`,
    description: 'Teste de exclusão',
    categoryId: 'b5f58bd9-2fe8-4f61-9db2-9a1f21e6c99c', // Cerveja
    branchId: 'c2bf9b2d-7ba7-4e53-8e0f-ad5a50a7f91e', // Branch principal
    basePrice: 10.00,
    isActive: true
  };
  
  const createResponse = await client.post('/products', testProduct);
  const productId = createResponse.data.id;
  console.log(`   ✅ Produto criado: ${productId}`);
  
  // 2. Verificar que o produto existe e está ativo
  console.log('\n2️⃣ Verificando produto criado...');
  const beforeDelete = await client.get(`/products/${productId}`);
  console.log(`   isActive ANTES do delete: ${beforeDelete.data.isActive}`);
  
  // 3. Enviar DELETE
  console.log('\n3️⃣ Enviando DELETE ao endpoint...');
  try {
    const deleteResponse = await client.delete(`/products/${productId}`);
    console.log(`   Response status: ${deleteResponse.status}`);
    console.log(`   Response data:`, JSON.stringify(deleteResponse.data).substring(0, 300));
  } catch (error) {
    console.log(`   ❌ Erro no DELETE: ${error.response?.status} - ${error.response?.data?.message}`);
    return;
  }
  
  // 4. Verificar estado após delete
  console.log('\n4️⃣ Verificando produto APÓS delete...');
  try {
    const afterDelete = await client.get(`/products/${productId}`);
    console.log(`   isActive APÓS delete: ${afterDelete.data.isActive}`);
    
    if (afterDelete.data.isActive === false) {
      console.log('   ✅ DELETE funcionou - isActive = false');
    } else {
      console.log('   ❌ PROBLEMA: isActive ainda é true!');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('   ✅ Produto não encontrado (hard delete)');
    } else {
      console.log(`   ❌ Erro ao verificar: ${error.response?.status}`);
    }
  }
  
  // 5. Verificar listagem padrão de produtos
  console.log('\n5️⃣ Verificando listagem de produtos (sem filtro)...');
  const allProducts = await getProducts(token, false);
  const foundInList = allProducts.find(p => p.id === productId);
  
  if (foundInList) {
    console.log(`   ⚠️ Produto AINDA aparece na listagem padrão!`);
    console.log(`   isActive: ${foundInList.isActive}`);
  } else {
    console.log('   ✅ Produto NÃO aparece na listagem padrão (correto)');
  }
  
  // 6. Verificar se aparece quando pedimos inativos
  console.log('\n6️⃣ Verificando listagem de produtos INATIVOS...');
  const inactiveProducts = await getProducts(token, true);
  const foundInInactive = inactiveProducts.find(p => p.id === productId);
  
  if (foundInInactive) {
    console.log(`   ✅ Produto aparece na listagem de inativos (isActive: ${foundInInactive.isActive})`);
  } else {
    console.log('   ❓ Produto não encontrado nem na lista de inativos');
  }
  
  return productId;
}

async function checkExistingDeletedProducts(token) {
  console.log('\n\n=== VERIFICANDO PRODUTOS DELETADOS EXISTENTES ===\n');
  
  const client = createClient(token);
  
  // IDs de produtos que foram deletados do sync_queue (completados)
  const deletedIds = [
    '6462dcb1-7371-4892-862a-7ee34a8bd9e6',  // TEST-1766504133983
    'b6bb279c-dd7c-41ac-a627-7541e277e568',  // TEST-BC-NONE
    'cc92e499-650a-4cb0-aa6d-ad0bd0b752ae',  // TEST-DESC-EMPTY
    '6bb41723-8a81-4fbd-9a97-9afe6bc87252',  // TEST-BC-EMPTY
    '9569e20f-0737-448e-9648-0376d856de1a',  // TEST-BC-NULL
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  // TEST-001
  ];
  
  for (const id of deletedIds) {
    try {
      const response = await client.get(`/products/${id}`);
      console.log(`🔍 ${id.substring(0,8)}... → isActive: ${response.data.isActive} | name: ${response.data.name}`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`🔍 ${id.substring(0,8)}... → 404 NOT FOUND (bom - removido)`);
      } else {
        console.log(`🔍 ${id.substring(0,8)}... → Erro: ${error.response?.status}`);
      }
    }
  }
}

async function main() {
  try {
    console.log('🔐 Fazendo login...');
    const token = await login();
    console.log('✅ Autenticado!\n');
    
    // Verificar produtos que já foram "deletados"
    await checkExistingDeletedProducts(token);
    
    // Teste completo do fluxo de delete
    await testDeleteFlow(token);
    
    console.log('\n\n=== CONCLUSÃO ===\n');
    console.log('Se o DELETE está marcado como "completed" mas o produto ainda');
    console.log('aparece nos apps mobile, o problema pode ser:');
    console.log('');
    console.log('1. O backend não está processando o DELETE corretamente');
    console.log('2. O DELETE está marcando isActive=false mas os apps não filtram');
    console.log('3. Os apps mobile estão cacheando dados antigos');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
  }
}

main();
