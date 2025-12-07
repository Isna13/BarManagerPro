// Script para investigar e corrigir a discrepância de IDs dos produtos
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

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
  const token = authRes.data.accessToken;
  console.log('✅ Autenticado!\n');

  // Verificar produtos no Railway com IDs completos
  console.log('=== PRODUTOS NO RAILWAY ===');
  const productsRes = await request('GET', '/products', null, token);
  const products = productsRes.data || [];
  
  products.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`   Nome: ${p.name}`);
    console.log('');
  });

  console.log('\n=== IDs ESPERADOS DO BANCO LOCAL ===');
  console.log('Mundos: 5dae0695-b644-4625-b372-3f9e17767232');
  console.log('Pé Tinto: 2238662b-79de-467d-906c-93b5ebf921b3');
  
  // Verificar se esses IDs existem
  console.log('\n=== VERIFICAÇÃO DIRETA ===');
  
  const mundosCheck = await request('GET', '/products/5dae0695-b644-4625-b372-3f9e17767232', null, token);
  console.log(`Mundos (local ID): ${mundosCheck.status === 200 ? '✅ Existe' : '❌ Não existe'}`);
  
  const petintoCheck = await request('GET', '/products/2238662b-79de-467d-906c-93b5ebf921b3', null, token);
  console.log(`Pé Tinto (local ID): ${petintoCheck.status === 200 ? '✅ Existe' : '❌ Não existe'}`);

  // Procurar "Mundos" no Railway
  const mundosInRailway = products.find(p => p.name === 'Mundos');
  if (mundosInRailway) {
    console.log(`\nMundos no Railway tem ID: ${mundosInRailway.id}`);
    console.log('⚠️ IDs são diferentes!');
  }

  // Verificar compras com detalhes
  console.log('\n\n=== COMPRAS COM DETALHES ===');
  const purchasesRes = await request('GET', '/purchases', null, token);
  const purchases = purchasesRes.data || [];
  
  for (const p of purchases) {
    console.log(`\n📦 ${p.purchaseNumber} (${p.id})`);
    console.log(`   Total: ${p.total} | Status: ${p.status}`);
    console.log(`   Itens: ${p.items?.length || 0}`);
    if (p.items && p.items.length > 0) {
      p.items.forEach(i => {
        console.log(`      - ${i.product?.name || i.productId}: ${i.qtyUnits} un x ${i.unitCost}`);
      });
    }
  }
}

main().catch(console.error);
