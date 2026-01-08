/**
 * SCRIPT DE CORREÇÃO DE ESTOQUE - RAILWAY
 * =========================================
 * 
 * Este script corrige o estoque no servidor Railway
 * baseado no cálculo correto: Compras - Vendas
 * 
 * EXECUTAR COM CUIDADO - PRODUÇÃO!
 */

const https = require('https');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';
const AUTH_EMAIL = 'isnatchuda1@gmail.com';
const AUTH_PASSWORD = 'isna123';

function request(method, urlPath, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, RAILWAY_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : {} });
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
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    🔧 CORREÇÃO DE ESTOQUE - RAILWAY (PRODUÇÃO)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  // Login
  console.log('🔐 Fazendo login...');
  const loginRes = await request('POST', '/api/v1/auth/login', { 
    email: AUTH_EMAIL, 
    password: AUTH_PASSWORD 
  });
  
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error(`Login falhou: ${loginRes.status}`);
  }
  const token = loginRes.data.accessToken || loginRes.data.access_token;
  console.log('✅ Login OK\n');
  
  // Buscar dados
  console.log('📊 Calculando estoque correto (Compras - Vendas)...\n');
  
  const purchasesRes = await request('GET', '/api/v1/purchases?include=items', null, token);
  const salesRes = await request('GET', '/api/v1/sales?limit=5000', null, token);
  const invRes = await request('GET', '/api/v1/inventory', null, token);
  
  // Calcular estoque correto
  const stockByProduct = {};
  
  // Processar COMPRAS (entrada)
  if (Array.isArray(purchasesRes.data)) {
    for (const purchase of purchasesRes.data) {
      if (purchase.status !== 'completed') continue;
      if (!purchase.items || !Array.isArray(purchase.items)) continue;
      
      for (const item of purchase.items) {
        const prodId = item.productId || item.product_id;
        const prodName = item.product?.name || prodId;
        const qty = item.qtyUnits || item.qty_units || 0;
        
        if (!stockByProduct[prodId]) {
          stockByProduct[prodId] = { 
            name: prodName, 
            compras: 0, 
            vendas: 0,
            productId: prodId
          };
        }
        stockByProduct[prodId].compras += qty;
      }
    }
  }
  
  // Processar VENDAS (saída)
  if (Array.isArray(salesRes.data)) {
    for (const sale of salesRes.data) {
      if (sale.status === 'cancelled' || sale.status === 'voided') continue;
      if (!sale.items || !Array.isArray(sale.items)) continue;
      
      for (const item of sale.items) {
        const prodId = item.productId || item.product_id;
        const prodName = item.product?.name || prodId;
        const qty = item.qtyUnits || item.quantity || 0;
        
        if (!stockByProduct[prodId]) {
          stockByProduct[prodId] = { 
            name: prodName, 
            compras: 0, 
            vendas: 0,
            productId: prodId
          };
        }
        stockByProduct[prodId].vendas += qty;
      }
    }
  }
  
  // Mapear estoque atual
  const currentStock = {};
  if (Array.isArray(invRes.data)) {
    invRes.data.forEach(item => {
      if (item.product) {
        currentStock[item.product.id] = {
          atual: item.qtyUnits || 0,
          branchId: item.branchId || item.branch_id || 'main-branch',
          name: item.product.name
        };
      }
    });
  }
  
  // Calcular correções
  const corrections = [];
  
  for (const [prodId, data] of Object.entries(stockByProduct)) {
    const correto = data.compras - data.vendas;
    const atual = currentStock[prodId]?.atual || 0;
    const branchId = currentStock[prodId]?.branchId || 'main-branch';
    const diff = atual - correto;
    
    if (diff !== 0) {
      corrections.push({
        productId: prodId,
        name: data.name,
        compras: data.compras,
        vendas: data.vendas,
        correto: Math.max(0, correto), // Não permitir negativo
        atual,
        adjustment: Math.max(0, correto) - atual,
        branchId
      });
    }
  }
  
  if (corrections.length === 0) {
    console.log('✅ Estoque já está correto! Nenhuma correção necessária.\n');
    return;
  }
  
  // Mostrar correções
  console.log('┌────────────────────────────┬─────────┬────────┬─────────┬────────┬──────────┐');
  console.log('│ Produto                    │ Compras │ Vendas │ CORRETO │ Atual  │ Ajuste   │');
  console.log('├────────────────────────────┼─────────┼────────┼─────────┼────────┼──────────┤');
  
  for (const c of corrections) {
    const name = (c.name || '').substring(0, 26).padEnd(26);
    const compras = String(c.compras).padStart(7);
    const vendas = String(c.vendas).padStart(6);
    const correto = String(c.correto).padStart(7);
    const atual = String(c.atual).padStart(6);
    const adj = (c.adjustment >= 0 ? '+' : '') + c.adjustment;
    console.log(`│ ${name} │ ${compras} │ ${vendas} │ ${correto} │ ${atual} │ ${adj.padStart(8)} │`);
  }
  
  console.log('└────────────────────────────┴─────────┴────────┴─────────┴────────┴──────────┘');
  console.log('');
  console.log(`📋 Total: ${corrections.length} produtos precisam de correção`);
  console.log('');
  
  // Perguntar confirmação
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    rl.question('⚠️  CONFIRMAR CORREÇÃO? (digite "SIM" para continuar): ', resolve);
  });
  rl.close();
  
  if (answer !== 'SIM') {
    console.log('\n❌ Correção cancelada.\n');
    return;
  }
  
  // Aplicar correções
  console.log('\n🔧 Aplicando correções...\n');
  
  let success = 0;
  let failed = 0;
  
  for (const c of corrections) {
    try {
      const res = await request('PUT', '/api/v1/inventory/adjust-by-product', {
        productId: c.productId,
        branchId: c.branchId,
        adjustment: c.adjustment,
        reason: `Correção forense: Compras(${c.compras}) - Vendas(${c.vendas}) = ${c.correto}`,
      }, token);
      
      if (res.status === 200 || res.status === 201) {
        console.log(`   ✅ ${c.name}: ${c.atual} → ${c.correto}`);
        success++;
      } else {
        console.log(`   ❌ ${c.name}: Erro ${res.status} - ${JSON.stringify(res.data)}`);
        failed++;
      }
    } catch (e) {
      console.log(`   ❌ ${c.name}: ${e.message}`);
      failed++;
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                     RESULTADO DA CORREÇÃO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   ✅ Sucesso: ${success}`);
  console.log(`   ❌ Falhas:  ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  if (failed === 0) {
    console.log('🎉 ESTOQUE CORRIGIDO COM SUCESSO!\n');
    console.log('PRÓXIMOS PASSOS:');
    console.log('1. Reiniciar o app Electron no PC de produção');
    console.log('2. Aguardar sincronização automática');
    console.log('3. Verificar se os valores estão corretos\n');
  }
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});
