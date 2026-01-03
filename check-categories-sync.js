/**
 * Script para verificar categorias no servidor Railway
 * e testar a sincronização
 */

const https = require('https');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

// Lista de credenciais para tentar
const credentialsList = [
  { email: 'isnatchuda1@gmail.com', password: 'isna123' },
  { email: 'admin@barmanager.com', password: 'Admin@123' },
  { email: 'admin@admin.com', password: 'Admin@123' },
];

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
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
  console.log('🔍 Verificando categorias no servidor Railway...\n');
  
  // 1. Login para obter token (tentar várias credenciais)
  console.log('1️⃣ Fazendo login...');
  let token = null;
  
  for (const credentials of credentialsList) {
    console.log(`   Tentando ${credentials.email}...`);
    const loginUrl = new URL(`${API_URL}/auth/login`);
    const loginResult = await makeRequest({
      hostname: loginUrl.hostname,
      path: loginUrl.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, credentials);
    
    if (loginResult.status === 200 || loginResult.status === 201) {
      token = loginResult.data?.accessToken || loginResult.data?.access_token || loginResult.data?.token;
      if (token) {
        console.log(`   ✅ Login bem sucedido com ${credentials.email}!\n`);
        break;
      }
    }
  }
  
  if (!token) {
    console.error('❌ Não foi possível fazer login com nenhuma credencial');
    return;
  }
  
  // 2. Buscar categorias no servidor
  console.log('2️⃣ Buscando categorias no servidor...');
  const categoriesUrl = new URL(`${API_URL}/categories`);
  const categoriesResult = await makeRequest({
    hostname: categoriesUrl.hostname,
    path: categoriesUrl.pathname,
    method: 'GET',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  console.log('\n📦 Resultado da busca de categorias:');
  console.log('   Status:', categoriesResult.status);
  
  if (categoriesResult.status === 200) {
    const categories = categoriesResult.data;
    if (Array.isArray(categories)) {
      console.log('   Total de categorias:', categories.length);
      if (categories.length > 0) {
        console.log('\n   📋 Lista de categorias:');
        categories.forEach((cat, i) => {
          console.log(`      ${i + 1}. ${cat.name} (ID: ${cat.id})`);
          if (cat.description) console.log(`         Descrição: ${cat.description}`);
        });
      } else {
        console.log('\n   ⚠️ Nenhuma categoria encontrada no servidor!');
      }
    } else if (categoriesResult.data?.data && Array.isArray(categoriesResult.data.data)) {
      // Pode vir em formato paginado
      const categories = categoriesResult.data.data;
      console.log('   Total de categorias:', categories.length);
      if (categories.length > 0) {
        console.log('\n   📋 Lista de categorias:');
        categories.forEach((cat, i) => {
          console.log(`      ${i + 1}. ${cat.name} (ID: ${cat.id})`);
        });
      } else {
        console.log('\n   ⚠️ Nenhuma categoria encontrada no servidor!');
      }
    } else {
      console.log('   📦 Resposta:', JSON.stringify(categoriesResult.data, null, 2));
    }
  } else {
    console.log('   ❌ Erro:', categoriesResult.data);
  }
  
  // 3. Testar criação de categoria
  console.log('\n3️⃣ Testando criação de categoria...');
  const testCategory = {
    name: 'Categoria Teste Sync',
    description: 'Criada para testar sincronização',
    isActive: true
  };
  
  const createUrl = new URL(`${API_URL}/categories`);
  const createResult = await makeRequest({
    hostname: createUrl.hostname,
    path: createUrl.pathname,
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, testCategory);
  
  console.log('   Status:', createResult.status);
  if (createResult.status === 201 || createResult.status === 200) {
    console.log('   ✅ Categoria criada com sucesso!');
    console.log('   📦 Dados:', JSON.stringify(createResult.data, null, 2));
    
    // 4. Deletar categoria de teste
    const createdId = createResult.data?.id;
    if (createdId) {
      console.log('\n4️⃣ Deletando categoria de teste...');
      const deleteUrl = new URL(`${API_URL}/categories/${createdId}`);
      const deleteResult = await makeRequest({
        hostname: deleteUrl.hostname,
        path: deleteUrl.pathname,
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('   Status:', deleteResult.status);
      if (deleteResult.status === 200 || deleteResult.status === 204) {
        console.log('   ✅ Categoria de teste deletada!');
      } else {
        console.log('   ⚠️ Erro ao deletar:', deleteResult.data);
      }
    }
  } else {
    console.log('   ❌ Erro ao criar categoria:', createResult.data);
  }
  
  console.log('\n✅ Verificação concluída!');
}

main().catch(console.error);
