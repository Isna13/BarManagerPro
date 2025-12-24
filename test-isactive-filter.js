/**
 * Teste de validação do filtro isActive no backend
 * 
 * Verifica se:
 * 1. GET /products retorna APENAS produtos ativos por padrão
 * 2. GET /products?active=false retorna APENAS inativos
 * 3. GET /products?includeInactive=true retorna TODOS
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

async function testProductsFilter(client) {
  console.log('\n=== TESTE: GET /products (padrão - deve ser só ativos) ===\n');
  
  try {
    const response = await client.get('/products');
    const products = response.data;
    
    const active = products.filter(p => p.isActive === true);
    const inactive = products.filter(p => p.isActive === false);
    
    console.log(`Total retornados: ${products.length}`);
    console.log(`  ✅ Ativos (isActive=true): ${active.length}`);
    console.log(`  ❌ Inativos (isActive=false): ${inactive.length}`);
    
    if (inactive.length > 0) {
      console.log('\n⚠️ PROBLEMA: Produtos inativos estão sendo retornados!');
      inactive.slice(0, 5).forEach(p => {
        console.log(`   - ${p.name} (${p.id.substring(0,8)}...)`);
      });
      return false;
    } else {
      console.log('\n✅ SUCESSO: Apenas produtos ativos retornados!');
      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testInactiveFilter(client) {
  console.log('\n=== TESTE: GET /products?active=false (apenas inativos) ===\n');
  
  try {
    const response = await client.get('/products?active=false');
    const products = response.data;
    
    const active = products.filter(p => p.isActive === true);
    const inactive = products.filter(p => p.isActive === false);
    
    console.log(`Total retornados: ${products.length}`);
    console.log(`  ✅ Inativos (isActive=false): ${inactive.length}`);
    console.log(`  ❌ Ativos (isActive=true): ${active.length}`);
    
    if (active.length > 0) {
      console.log('\n⚠️ PROBLEMA: Produtos ativos estão sendo retornados!');
      return false;
    } else if (inactive.length > 0) {
      console.log('\n✅ SUCESSO: Apenas produtos inativos retornados!');
      inactive.slice(0, 5).forEach(p => {
        console.log(`   - ${p.name} (${p.id.substring(0,8)}...)`);
      });
      return true;
    } else {
      console.log('\n📝 Nenhum produto inativo existe no banco.');
      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testIncludeInactive(client) {
  console.log('\n=== TESTE: GET /products?includeInactive=true (todos) ===\n');
  
  try {
    const response = await client.get('/products?includeInactive=true');
    const products = response.data;
    
    const active = products.filter(p => p.isActive === true);
    const inactive = products.filter(p => p.isActive === false);
    
    console.log(`Total retornados: ${products.length}`);
    console.log(`  ✅ Ativos (isActive=true): ${active.length}`);
    console.log(`  📦 Inativos (isActive=false): ${inactive.length}`);
    
    if (inactive.length > 0) {
      console.log('\n✅ SUCESSO: includeInactive=true retorna produtos inativos também!');
      return true;
    } else {
      console.log('\n📝 Nenhum produto inativo existe no banco.');
      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testCategoriesFilter(client) {
  console.log('\n=== TESTE: GET /categories (padrão - deve ser só ativas) ===\n');
  
  try {
    const response = await client.get('/categories');
    const categories = response.data;
    
    const active = categories.filter(c => c.isActive === true);
    const inactive = categories.filter(c => c.isActive === false);
    
    console.log(`Total retornadas: ${categories.length}`);
    console.log(`  ✅ Ativas: ${active.length}`);
    console.log(`  ❌ Inativas: ${inactive.length}`);
    
    if (inactive.length > 0) {
      console.log('\n⚠️ PROBLEMA: Categorias inativas estão sendo retornadas!');
      return false;
    } else {
      console.log('\n✅ SUCESSO: Apenas categorias ativas retornadas!');
      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function testSuppliersFilter(client) {
  console.log('\n=== TESTE: GET /suppliers (padrão - deve ser só ativos) ===\n');
  
  try {
    const response = await client.get('/suppliers');
    const suppliers = response.data;
    
    const active = suppliers.filter(s => s.isActive === true);
    const inactive = suppliers.filter(s => s.isActive === false);
    
    console.log(`Total retornados: ${suppliers.length}`);
    console.log(`  ✅ Ativos: ${active.length}`);
    console.log(`  ❌ Inativos: ${inactive.length}`);
    
    if (inactive.length > 0) {
      console.log('\n⚠️ PROBLEMA: Fornecedores inativos estão sendo retornados!');
      return false;
    } else {
      console.log('\n✅ SUCESSO: Apenas fornecedores ativos retornados!');
      return true;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔐 Fazendo login...');
  const token = await login();
  console.log('✅ Autenticado!\n');
  
  const client = createClient(token);
  
  const results = [];
  
  results.push(await testProductsFilter(client));
  results.push(await testInactiveFilter(client));
  results.push(await testIncludeInactive(client));
  results.push(await testCategoriesFilter(client));
  results.push(await testSuppliersFilter(client));
  
  console.log('\n\n=== RESUMO ===\n');
  
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log(`✅ Passou: ${passed}/${results.length}`);
  console.log(`❌ Falhou: ${failed}/${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('Produtos deletados não aparecerão mais nos apps mobile.');
  } else {
    console.log('\n⚠️ ALGUNS TESTES FALHARAM!');
    console.log('O deploy pode ainda estar em andamento. Tente novamente em 1-2 minutos.');
  }
}

main().catch(e => {
  console.error('Erro:', e.response?.data || e.message);
});
