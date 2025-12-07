// Script para verificar estado do caixa no Railway
const https = require('https');

const RAILWAY_URL = 'barmanagerbackend-production.up.railway.app';
const API_PREFIX = '/api/v1';

// Credenciais para login
const credentials = {
  email: 'admin@barmanager.com',
  password: 'admin123'
};

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function checkCashBoxState() {
  console.log('='.repeat(60));
  console.log('VERIFICAÇÃO DE ESTADO DO CAIXA NO RAILWAY');
  console.log('='.repeat(60));
  console.log('');
  
  // 1. Login
  console.log('1. Fazendo login...');
  const loginResponse = await makeRequest({
    hostname: RAILWAY_URL,
    path: API_PREFIX + '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify(credentials));
  
  if (loginResponse.status !== 200 && loginResponse.status !== 201) {
    console.log('❌ Erro no login:', loginResponse.data);
    return;
  }
  
  const token = loginResponse.data.access_token;
  console.log('✅ Login OK');
  console.log('');
  
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // 2. Verificar caixa atual
  console.log('2. Verificando caixa atual (aberto)...');
  const currentResponse = await makeRequest({
    hostname: RAILWAY_URL,
    path: API_PREFIX + '/cash-box/current',
    method: 'GET',
    headers: authHeaders
  });
  
  console.log('   Status:', currentResponse.status);
  if (currentResponse.status === 200) {
    if (currentResponse.data) {
      console.log('   📦 CAIXA ABERTO NO RAILWAY:');
      console.log('      ID:', currentResponse.data.id);
      console.log('      Box Number:', currentResponse.data.boxNumber);
      console.log('      Status:', currentResponse.data.status);
      console.log('      Opened At:', currentResponse.data.openedAt);
      console.log('      Opening Cash:', currentResponse.data.openingCash);
    } else {
      console.log('   ✅ Nenhum caixa aberto no Railway');
    }
  } else if (currentResponse.status === 404) {
    console.log('   ✅ Nenhum caixa aberto (404)');
  } else {
    console.log('   Resposta:', JSON.stringify(currentResponse.data, null, 2));
  }
  console.log('');
  
  // 3. Verificar histórico
  console.log('3. Verificando histórico de caixas fechados...');
  const historyResponse = await makeRequest({
    hostname: RAILWAY_URL,
    path: API_PREFIX + '/cash-box/history?limit=10',
    method: 'GET',
    headers: authHeaders
  });
  
  console.log('   Status:', historyResponse.status);
  if (historyResponse.status === 200 && Array.isArray(historyResponse.data)) {
    console.log('   📋 HISTÓRICO DE CAIXAS FECHADOS:');
    historyResponse.data.forEach((box, i) => {
      console.log(`   ${i + 1}. ID: ${box.id}`);
      console.log(`      Box Number: ${box.boxNumber}`);
      console.log(`      Status: ${box.status}`);
      console.log(`      Opened: ${box.openedAt}`);
      console.log(`      Closed: ${box.closedAt}`);
      console.log(`      Opening: ${box.openingCash} | Closing: ${box.closingCash}`);
      console.log('');
    });
    if (historyResponse.data.length === 0) {
      console.log('   ⚠️ Nenhum caixa fechado encontrado no histórico');
    }
  } else {
    console.log('   Resposta:', JSON.stringify(historyResponse.data, null, 2));
  }
  console.log('');
  
  // 4. Listar todos os caixas (para debug)
  console.log('4. Verificando TODOS os caixas no Railway...');
  const allResponse = await makeRequest({
    hostname: RAILWAY_URL,
    path: API_PREFIX + '/cash-box/all',
    method: 'GET',
    headers: authHeaders
  });
  
  if (allResponse.status === 200 && Array.isArray(allResponse.data)) {
    console.log('   📋 TODOS OS CAIXAS NO RAILWAY:');
    allResponse.data.forEach((box, i) => {
      const statusIcon = box.status === 'open' ? '🟢' : '🔴';
      console.log(`   ${i + 1}. ${statusIcon} ID: ${box.id}`);
      console.log(`      Box Number: ${box.boxNumber}`);
      console.log(`      Status: ${box.status}`);
      console.log(`      Opened: ${box.openedAt}`);
      if (box.closedAt) console.log(`      Closed: ${box.closedAt}`);
      console.log('');
    });
    
    const openBoxes = allResponse.data.filter(b => b.status === 'open');
    const closedBoxes = allResponse.data.filter(b => b.status === 'closed');
    console.log(`   📊 Resumo: ${openBoxes.length} abertos, ${closedBoxes.length} fechados`);
  } else if (allResponse.status === 404) {
    console.log('   ⚠️ Endpoint /cash-box/all não existe');
  } else {
    console.log('   Status:', allResponse.status);
    console.log('   Resposta:', JSON.stringify(allResponse.data, null, 2));
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('VERIFICAÇÃO CONCLUÍDA');
  console.log('='.repeat(60));
}

checkCashBoxState().catch(console.error);
