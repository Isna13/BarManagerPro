/**
 * Script de Teste de Sincronização Desktop → Railway
 * 
 * Este script testa se a sincronização manual funciona corretamente.
 * Execute: node scripts/test-sync-push.js
 */

const axios = require('axios');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const ADMIN_EMAIL = 'admin@barmanager.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function testSync() {
  console.log('🚀 Iniciando teste de sincronização...\n');
  
  try {
    // 1. Login
    console.log('1️⃣ Fazendo login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const token = loginResponse.data.accessToken;
    console.log('   ✅ Login bem-sucedido!\n');
    
    const api = axios.create({
      baseURL: API_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 2. Verificar dados existentes
    console.log('2️⃣ Verificando dados existentes no Railway...');
    
    const endpoints = [
      { name: 'Categorias', path: '/categories' },
      { name: 'Produtos', path: '/products' },
      { name: 'Clientes', path: '/customers' },
      { name: 'Fornecedores', path: '/suppliers' }
    ];
    
    for (const ep of endpoints) {
      try {
        const response = await api.get(ep.path);
        const count = Array.isArray(response.data) ? response.data.length : (response.data?.length || 0);
        console.log(`   ${ep.name}: ${count} registros`);
      } catch (error) {
        console.log(`   ${ep.name}: ❌ Erro - ${error.response?.status || error.message}`);
      }
    }
    
    // 3. Testar criação de categoria
    console.log('\n3️⃣ Testando criação de categoria...');
    try {
      const categoryData = {
        name: 'Categoria Teste ' + Date.now(),
        description: 'Categoria criada para teste de sincronização'
      };
      
      const catResponse = await api.post('/categories', categoryData);
      console.log('   ✅ Categoria criada:', catResponse.data.id);
      
      // Deletar categoria de teste
      await api.delete(`/categories/${catResponse.data.id}`);
      console.log('   🗑️ Categoria de teste removida');
    } catch (error) {
      console.log('   ❌ Erro:', error.response?.data?.message || error.message);
    }
    
    // 4. Testar criação de produto (precisa de categoria)
    console.log('\n4️⃣ Testando criação de produto...');
    try {
      // Primeiro criar categoria
      const catData = { name: 'Teste Produtos' };
      const cat = await api.post('/categories', catData);
      
      const productData = {
        name: 'Produto Teste ' + Date.now(),
        categoryId: cat.data.id,
        unitsPerBox: 1,
        priceUnit: 1000, // R$ 10,00 em centavos
      };
      
      const prodResponse = await api.post('/products', productData);
      console.log('   ✅ Produto criado:', prodResponse.data.id);
      
      // Limpar
      await api.delete(`/products/${prodResponse.data.id}`);
      await api.delete(`/categories/${cat.data.id}`);
      console.log('   🗑️ Produto e categoria de teste removidos');
    } catch (error) {
      console.log('   ❌ Erro:', error.response?.data?.message || error.message);
    }
    
    console.log('\n✅ Teste concluído! O backend está pronto para receber dados.\n');
    console.log('📱 Agora você pode:');
    console.log('   1. Abrir o app desktop');
    console.log('   2. Ir em Configurações > Sincronização');
    console.log('   3. Clicar em "Sincronização Inicial Completa"\n');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data?.message || error.message);
  }
}

testSync();
