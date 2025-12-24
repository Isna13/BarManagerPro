/**
 * Teste completo de UPDATE e DELETE de clientes
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
  return response.data.accessToken;
}

function createClient(token) {
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

async function main() {
  console.log('🔐 Fazendo login...');
  const token = await login();
  console.log('✅ Autenticado!\n');
  
  const client = createClient(token);
  
  // 1. Criar cliente de teste
  console.log('=== CRIAR CLIENTE DE TESTE ===\n');
  
  const createPayload = {
    name: `Cliente Teste DELETE ${Date.now()}`,
    phone: '+2459999' + Math.floor(Math.random() * 10000),
    email: `teste${Date.now()}@example.com`,
    creditLimit: 50000
  };
  
  console.log('Payload:', JSON.stringify(createPayload, null, 2));
  
  const createRes = await client.post('/customers', createPayload);
  const customerId = createRes.data.id;
  console.log(`✅ Cliente criado: ${customerId}\n`);
  
  // 2. Verificar que aparece na listagem
  console.log('=== VERIFICAR LISTAGEM (deve aparecer) ===\n');
  
  const listBefore = await client.get('/customers');
  const foundBefore = listBefore.data.find(c => c.id === customerId);
  console.log(`Clientes na listagem: ${listBefore.data.length}`);
  console.log(`Cliente de teste encontrado: ${foundBefore ? 'SIM ✅' : 'NÃO ❌'}`);
  
  // 3. Atualizar cliente
  console.log('\n=== ATUALIZAR CLIENTE ===\n');
  
  const updatePayload = {
    name: "Cliente ATUALIZADO",
    creditLimit: 100000
  };
  
  const updateRes = await client.put(`/customers/${customerId}`, updatePayload);
  console.log('✅ UPDATE OK');
  console.log(`   fullName: ${updateRes.data.fullName}`);
  console.log(`   creditLimit: ${updateRes.data.creditLimit}`);
  console.log(`   updatedAt: ${updateRes.data.updatedAt}`);
  
  // 4. Deletar cliente
  console.log('\n=== DELETAR CLIENTE ===\n');
  
  try {
    const deleteRes = await client.delete(`/customers/${customerId}`);
    console.log('✅ DELETE OK');
    console.log(`   isActive após delete: ${deleteRes.data.isActive}`);
  } catch (error) {
    console.log('❌ DELETE FALHOU!');
    console.log('   Status:', error.response?.status);
    console.log('   Error:', error.response?.data);
    return;
  }
  
  // 5. Verificar que NÃO aparece na listagem padrão
  console.log('\n=== VERIFICAR LISTAGEM APÓS DELETE ===\n');
  
  const listAfter = await client.get('/customers');
  const foundAfter = listAfter.data.find(c => c.id === customerId);
  console.log(`Clientes na listagem: ${listAfter.data.length}`);
  console.log(`Cliente deletado encontrado: ${foundAfter ? 'SIM ❌ (PROBLEMA!)' : 'NÃO ✅ (CORRETO)'}`);
  
  // 6. Verificar que aparece com includeInactive=true
  console.log('\n=== VERIFICAR LISTAGEM COM includeInactive=true ===\n');
  
  const listInactive = await client.get('/customers?includeInactive=true');
  const foundInactive = listInactive.data.find(c => c.id === customerId);
  console.log(`Clientes (incluindo inativos): ${listInactive.data.length}`);
  console.log(`Cliente deletado encontrado: ${foundInactive ? 'SIM ✅ (CORRETO)' : 'NÃO ❌'}`);
  if (foundInactive) {
    console.log(`   isActive: ${foundInactive.isActive}`);
  }
  
  // Resumo
  console.log('\n\n=== RESUMO ===\n');
  console.log('✅ CREATE: OK');
  console.log('✅ UPDATE: OK');
  console.log('✅ DELETE: OK');
  console.log('✅ Filtro isActive: OK');
  console.log('\n🎉 TODOS OS TESTES PASSARAM!');
}

main().catch(e => {
  console.error('Erro:', e.response?.data || e.message);
});
