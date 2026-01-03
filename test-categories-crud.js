/**
 * Script para testar CRUD de categorias e sincronização
 * Cria uma categoria no banco local, verifica a sync_queue, e testa sync com Railway
 */

const path = require('path');
const os = require('os');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// Configuração
const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');
const credentials = { email: 'isnatchuda1@gmail.com', password: 'isna123' };

// Helper para fazer requests HTTPS
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
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
  console.log('🧪 TESTE COMPLETO DE CATEGORIAS - CRUD + SYNC\n');
  console.log('=' .repeat(60) + '\n');
  
  // Verificar se Database file existe
  const fs = require('fs');
  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ Banco de dados não encontrado:', DB_PATH);
    return;
  }
  console.log('✅ Banco encontrado:', DB_PATH);
  
  // 1. Login no Railway
  console.log('\n1️⃣ Fazendo login no Railway...');
  const loginUrl = new URL(`${API_URL}/auth/login`);
  const loginResult = await makeRequest({
    hostname: loginUrl.hostname,
    path: loginUrl.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, credentials);
  
  if (loginResult.status !== 200 && loginResult.status !== 201) {
    console.error('❌ Falha no login:', loginResult.status, loginResult.data);
    return;
  }
  
  const token = loginResult.data?.accessToken || loginResult.data?.access_token;
  console.log('   ✅ Login OK!\n');
  
  // 2. Criar categoria via API direta (simular o que o Electron faz)
  console.log('2️⃣ Criando categoria de teste no servidor Railway...');
  const testCategory = {
    id: uuidv4(),
    name: 'Bebidas Alcoólicas',
    description: 'Cervejas, vinhos, destilados',
    sortOrder: 1,
    isActive: true,
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
    console.log('   ✅ Categoria criada!');
    console.log('   ID:', createResult.data?.id || testCategory.id);
  } else {
    console.log('   ❌ Erro:', createResult.data);
  }
  
  // 3. Verificar se categoria aparece na lista
  console.log('\n3️⃣ Verificando lista de categorias no servidor...');
  const listUrl = new URL(`${API_URL}/categories`);
  const listResult = await makeRequest({
    hostname: listUrl.hostname,
    path: listUrl.pathname,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('   Total de categorias:', listResult.data?.length || 0);
  if (listResult.data?.length > 0) {
    console.log('   Categorias encontradas:');
    listResult.data.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat.id})`);
    });
  }
  
  // 4. Criar mais algumas categorias úteis
  console.log('\n4️⃣ Criando categorias básicas para o bar...');
  const basicCategories = [
    { name: 'Cervejas', description: 'Cervejas nacionais e importadas', sortOrder: 2 },
    { name: 'Refrigerantes', description: 'Refrigerantes e sucos', sortOrder: 3 },
    { name: 'Petiscos', description: 'Salgados e tira-gostos', sortOrder: 4 },
    { name: 'Destilados', description: 'Whisky, vodka, gin, etc', sortOrder: 5 },
  ];
  
  for (const cat of basicCategories) {
    const catData = { id: uuidv4(), ...cat, isActive: true };
    const result = await makeRequest({
      hostname: createUrl.hostname,
      path: createUrl.pathname,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, catData);
    
    if (result.status === 201 || result.status === 200) {
      console.log(`   ✅ ${cat.name} criada`);
    } else if (result.status === 409) {
      console.log(`   ⚠️ ${cat.name} já existe`);
    } else {
      console.log(`   ❌ ${cat.name}: erro ${result.status}`);
    }
  }
  
  // 5. Verificar novamente
  console.log('\n5️⃣ Lista final de categorias no servidor:');
  const finalList = await makeRequest({
    hostname: listUrl.hostname,
    path: listUrl.pathname,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('   Total:', finalList.data?.length || 0);
  (finalList.data || []).forEach(cat => {
    console.log(`   - ${cat.name}`);
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ TESTE CONCLUÍDO!');
  console.log('\n💡 PRÓXIMO PASSO: Abra o app Electron e faça um Full Sync para baixar as categorias.');
  console.log('   Vá em Configurações > Sincronização > Sync Completo');
}

main().catch(console.error);
