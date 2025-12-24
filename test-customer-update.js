/**
 * Teste de diagnóstico de UPDATE de cliente no Railway
 * 
 * Verifica por que o UPDATE está falhando com "Internal server error"
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
  
  // 1. Listar clientes existentes
  console.log('=== CLIENTES NO RAILWAY ===\n');
  const customersRes = await client.get('/customers');
  const customers = customersRes.data;
  
  console.log(`Total de clientes: ${customers.length}\n`);
  customers.forEach(c => {
    console.log(`- ${c.fullName} (${c.id.substring(0,8)}...)`);
    console.log(`  Phone: ${c.phone}, Email: ${c.email}`);
    console.log(`  CreditLimit: ${c.creditLimit}, LoyaltyPoints: ${c.loyaltyPoints}`);
    console.log(`  UpdatedAt: ${c.updatedAt}`);
    console.log();
  });
  
  // 2. Tentar o mesmo UPDATE que está falhando
  const targetCustomerId = 'e9e91474-99d1-41e9-8a8a-2e2d8a501950'; // William Brandão
  
  console.log('\n=== TESTE DE UPDATE ===\n');
  console.log(`Tentando atualizar cliente: ${targetCustomerId}`);
  
  // Payload idêntico ao que está na fila de sync
  const updatePayload = {
    name: "Cusa sai Brandão",
    phone: "+245955377679",
    email: "william@gmail.com",
    creditLimit: 2000000,
    _deviceId: "b797fcca41de5347",
    _timestamp: "2025-12-23T16:59:00.000Z"
  };
  
  console.log('Payload:', JSON.stringify(updatePayload, null, 2));
  
  try {
    const updateRes = await client.put(`/customers/${targetCustomerId}`, updatePayload);
    console.log('\n✅ UPDATE SUCESSO!');
    console.log('Response:', JSON.stringify(updateRes.data, null, 2));
  } catch (error) {
    console.log('\n❌ UPDATE FALHOU!');
    console.log('Status:', error.response?.status);
    console.log('Error:', JSON.stringify(error.response?.data, null, 2));
    
    // Testar com payload limpo (sem _deviceId e _timestamp)
    console.log('\n--- Tentando com payload LIMPO ---');
    const cleanPayload = {
      name: "Cusa sai Brandão",
      phone: "+245955377679",
      email: "william@gmail.com",
      creditLimit: 2000000
    };
    
    console.log('Clean Payload:', JSON.stringify(cleanPayload, null, 2));
    
    try {
      const cleanRes = await client.put(`/customers/${targetCustomerId}`, cleanPayload);
      console.log('\n✅ CLEAN UPDATE SUCESSO!');
      console.log('Response:', JSON.stringify(cleanRes.data, null, 2));
    } catch (cleanError) {
      console.log('\n❌ CLEAN UPDATE TAMBÉM FALHOU!');
      console.log('Status:', cleanError.response?.status);
      console.log('Error:', JSON.stringify(cleanError.response?.data, null, 2));
    }
  }
  
  // 3. Verificar o que o Prisma aceita
  console.log('\n=== TESTE COM CAMPOS MÍNIMOS ===\n');
  
  const minimalPayload = {
    fullName: "William Teste"
  };
  
  console.log('Minimal Payload:', JSON.stringify(minimalPayload, null, 2));
  
  try {
    const minRes = await client.put(`/customers/${targetCustomerId}`, minimalPayload);
    console.log('\n✅ MINIMAL UPDATE SUCESSO!');
    console.log('Response:', JSON.stringify(minRes.data, null, 2));
  } catch (minError) {
    console.log('\n❌ MINIMAL UPDATE FALHOU!');
    console.log('Status:', minError.response?.status);
    console.log('Error:', JSON.stringify(minError.response?.data, null, 2));
  }
}

main().catch(e => {
  console.error('Erro fatal:', e.response?.data || e.message);
});
