/**
 * Script para corrigir o estoque no Railway
 * 
 * O bug das compras também afetou o estoque - o inventário foi incrementado
 * com os valores errados das compras anteriores.
 */

const https = require('https');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';
const AUTH_EMAIL = 'isnatchuda1@gmail.com';
const AUTH_PASSWORD = 'isna123';

// Correções de estoque necessárias
const STOCK_CORRECTIONS = [
  {
    productName: 'Super Bock mini',
    currentQty: 1144,  // Errado (47 caixas + 16 garrafas)
    correctQty: 424,   // Correto (17 caixas + 16 garrafas)
    unitsPerBox: 24,
  },
  {
    productName: 'fogo de Pias',
    currentQty: 126,   // Errado (10 caixas + 6 garrafas)
    correctQty: 30,    // Correto (2 caixas + 6 garrafas)
    unitsPerBox: 12,
  },
];

async function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAILWAY_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function login() {
  console.log('🔐 Fazendo login no Railway...');
  const res = await request('POST', '/api/v1/auth/login', {
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD
  });
  
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Falha no login: ${res.status} - ${JSON.stringify(res.data)}`);
  }
  
  console.log('✅ Login bem-sucedido!\n');
  return res.data.accessToken || res.data.access_token;
}

async function getProducts(token) {
  const res = await request('GET', '/api/v1/products?limit=1000', null, token);
  if (res.status !== 200) {
    throw new Error(`Falha ao buscar produtos: ${res.status}`);
  }
  return res.data.data || res.data;
}

async function getInventory(token) {
  const res = await request('GET', '/api/v1/inventory?limit=1000', null, token);
  if (res.status !== 200) {
    throw new Error(`Falha ao buscar inventário: ${res.status}`);
  }
  return res.data.data || res.data;
}

async function adjustStock(token, productId, branchId, adjustment, reason) {
  const res = await request('PUT', `/api/v1/inventory/adjust-by-product`, {
    productId: productId,
    branchId: branchId,
    adjustment: adjustment,
    reason: reason
  }, token);
  
  return res;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   CORREÇÃO DE ESTOQUE NO RAILWAY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const token = await login();
    
    // Buscar produtos
    console.log('📦 Buscando produtos...');
    const products = await getProducts(token);
    
    // Buscar inventário atual
    console.log('📊 Buscando inventário atual...\n');
    const inventory = await getInventory(token);
    
    // Criar mapa de produtos por nome
    const productMap = new Map();
    for (const p of products) {
      productMap.set(p.name.toLowerCase(), p);
    }
    
    // Criar mapa de inventário por productId
    const inventoryMap = new Map();
    for (const inv of inventory) {
      inventoryMap.set(inv.productId, inv);
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   CORREÇÕES A APLICAR');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    for (const correction of STOCK_CORRECTIONS) {
      const product = productMap.get(correction.productName.toLowerCase());
      
      if (!product) {
        console.log(`❌ Produto "${correction.productName}" não encontrado!`);
        continue;
      }
      
      const inv = inventoryMap.get(product.id);
      const currentStock = inv ? inv.qtyUnits : 0;
      
      console.log(`📦 ${correction.productName}:`);
      console.log(`   Estoque atual no Railway: ${currentStock} unidades`);
      console.log(`   Valor esperado (correto): ${correction.correctQty} unidades`);
      
      const adjustment = correction.correctQty - currentStock;
      
      if (adjustment === 0) {
        console.log(`   ✅ Estoque já está correto!\n`);
        continue;
      }
      
      console.log(`   Ajuste necessário: ${adjustment} unidades`);
      
      // Pegar branchId do inventário
      const branchId = inv ? inv.branchId : null;
      if (!branchId) {
        console.log(`   ❌ Não foi possível encontrar branchId para este produto!\n`);
        continue;
      }
      
      // Aplicar correção
      const reason = `Correção de estoque - Bug de compras (era ${currentStock}, corrigido para ${correction.correctQty})`;
      const res = await adjustStock(token, product.id, branchId, adjustment, reason);
      
      if (res.status === 200 || res.status === 201) {
        console.log(`   ✅ Estoque corrigido com sucesso!\n`);
      } else {
        console.log(`   ❌ Erro ao corrigir: ${res.status} - ${JSON.stringify(res.data)}\n`);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   VERIFICAÇÃO FINAL');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Verificar novamente
    const newInventory = await getInventory(token);
    const newInventoryMap = new Map();
    for (const inv of newInventory) {
      newInventoryMap.set(inv.productId, inv);
    }
    
    for (const correction of STOCK_CORRECTIONS) {
      const product = productMap.get(correction.productName.toLowerCase());
      if (!product) continue;
      
      const inv = newInventoryMap.get(product.id);
      const currentStock = inv ? inv.qtyUnits : 0;
      const boxes = Math.floor(currentStock / correction.unitsPerBox);
      const units = currentStock % correction.unitsPerBox;
      
      console.log(`📦 ${correction.productName}: ${currentStock} unidades (${boxes} caixas + ${units} garrafas)`);
      
      if (currentStock === correction.correctQty) {
        console.log(`   ✅ CORRETO!\n`);
      } else {
        console.log(`   ⚠️ Ainda diferente do esperado (${correction.correctQty})\n`);
      }
    }
    
    console.log('✅ Correção de estoque concluída!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
