/**
 * Script para analisar a estrutura dos dados retornados pelo servidor
 * Identifica campos e formatos para debug de sincronização
 */

const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const EMAIL = 'isnatchuda1@gmail.com';
const PASSWORD = 'isna123';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
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
  console.log('🔍 Analisando estrutura de dados do servidor...\n');
  
  // Login
  const loginResult = await request({
    hostname: API_URL,
    port: 443,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: EMAIL, password: PASSWORD });
  
  const token = loginResult.data.accessToken || loginResult.data.access_token;
  if (!token) {
    console.log('❌ Falha no login');
    return;
  }
  console.log('✅ Login OK\n');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 1. Analisar Compras
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 ESTRUTURA DE COMPRAS (purchases):');
  console.log('═══════════════════════════════════════════════════════');
  
  const purchases = await request({
    hostname: API_URL,
    port: 443,
    path: '/api/v1/purchases?limit=5',
    method: 'GET',
    headers,
  });
  
  if (purchases.data && purchases.data.length > 0) {
    console.log(`Total: ${purchases.data.length} compras`);
    console.log('\nPrimeira compra (campos):');
    const firstPurchase = purchases.data[0];
    Object.keys(firstPurchase).forEach(key => {
      const value = firstPurchase[key];
      const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
      console.log(`  ${key}: ${type} = ${JSON.stringify(value).substring(0, 80)}`);
    });
    
    console.log('\nTodas as compras (supplier_id / supplierId):');
    purchases.data.forEach(p => {
      console.log(`  ${p.id}: supplierId=${p.supplierId}, supplier_id=${p.supplier_id}, supplier?.id=${p.supplier?.id}`);
    });
  } else {
    console.log('Nenhuma compra retornada ou erro:', purchases.data);
  }

  // 2. Analisar Fornecedores (para comparar IDs)
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📦 FORNECEDORES (para comparação de IDs):');
  console.log('═══════════════════════════════════════════════════════');
  
  const suppliers = await request({
    hostname: API_URL,
    port: 443,
    path: '/api/v1/suppliers',
    method: 'GET',
    headers,
  });
  
  if (suppliers.data && suppliers.data.length > 0) {
    console.log('IDs dos fornecedores:');
    suppliers.data.forEach(s => {
      console.log(`  ${s.id}: ${s.name}`);
    });
  }

  // 3. Analisar Caixas
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('💰 ESTRUTURA DE CAIXAS (cash_boxes):');
  console.log('═══════════════════════════════════════════════════════');
  
  const cashBoxes = await request({
    hostname: API_URL,
    port: 443,
    path: '/api/v1/cash-box?limit=5',
    method: 'GET',
    headers,
  });
  
  if (cashBoxes.data && cashBoxes.data.length > 0) {
    console.log(`Total: ${cashBoxes.data.length} caixas`);
    console.log('\nPrimeiro caixa (campos):');
    const firstBox = cashBoxes.data[0];
    Object.keys(firstBox).forEach(key => {
      const value = firstBox[key];
      const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
      console.log(`  ${key}: ${type} = ${JSON.stringify(value).substring(0, 80)}`);
    });
  } else {
    console.log('Nenhum caixa retornado ou erro:', cashBoxes.data);
  }

  console.log('\n✅ Análise concluída');
}

main().catch(console.error);
