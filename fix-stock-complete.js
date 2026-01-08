/**
 * CORREÇÃO COMPLETA DE ESTOQUE - DUPLICAÇÃO DE VENDAS
 * 
 * Este script corrige o estoque tanto no Railway quanto localmente,
 * baseado nas vendas reais de hoje.
 */

const https = require('https');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';
const AUTH_EMAIL = 'isnatchuda1@gmail.com';
const AUTH_PASSWORD = 'isna123';

// Caminho do banco local
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

async function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAILWAY_URL);
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

async function login() {
  console.log('🔐 Fazendo login no Railway...');
  const res = await request('POST', '/api/v1/auth/login', { email: AUTH_EMAIL, password: AUTH_PASSWORD });
  if (res.status !== 200 && res.status !== 201) throw new Error(`Login falhou: ${res.status}`);
  return res.data.accessToken || res.data.access_token;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   CORREÇÃO COMPLETA DE ESTOQUE - DUPLICAÇÃO DE VENDAS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Conectar ao banco local
    console.log('📂 Conectando ao banco local...');
    const db = new Database(DB_PATH);
    
    // 2. ESTOQUE CORRETO CALCULADO (compras totais - vendas totais)
    // Evidência: diferença entre teórico e atual = estoque subtraído em DOBRO
    const ESTOQUE_CORRETO = {
      'Super Bock mini': 336,  // 1152 comprado - 816 vendido = 336 (atual: 184, subtraído 152 a mais)
      'fogo de Pias': 52,      // 180 comprado - 128 vendido = 52 (atual: 0, subtraído 52 a mais)
      'Cristal': 15,           // 192 comprado - 177 vendido = 15 (atual: 5, subtraído 10 a mais)
    };
    
    // 3. Calcular vendas de hoje
    console.log('\n📊 Calculando vendas de hoje...');
    const vendasHoje = db.prepare(`
      SELECT p.name, p.id as product_id, SUM(si.qty_units) as total_vendido, p.units_per_box
      FROM sales s 
      JOIN sale_items si ON s.id = si.sale_id 
      JOIN products p ON si.product_id = p.id 
      WHERE date(s.created_at) = date('now')
      GROUP BY p.id
    `).all();
    
    console.log('\n   Vendas realizadas hoje:');
    for (const v of vendasHoje) {
      console.log(`   • ${v.name}: ${v.total_vendido} unidades`);
    }
    
    // 4. Login no Railway
    const token = await login();
    
    // 5. Buscar produtos do Railway
    const prodsRes = await request('GET', '/api/v1/products?limit=100', null, token);
    const products = prodsRes.data.data || prodsRes.data;
    const prodMap = new Map();
    products.forEach(p => prodMap.set(p.name, p));
    
    // 6. Buscar inventário do Railway
    const invRes = await request('GET', '/api/v1/inventory?limit=100', null, token);
    const inventory = invRes.data.data || invRes.data;
    const invMap = new Map();
    inventory.forEach(i => invMap.set(i.productId, i));
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   CORREÇÕES A APLICAR');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const corrections = [];
    
    for (const [productName, estoqueCorreto] of Object.entries(ESTOQUE_CORRETO)) {
      const product = prodMap.get(productName);
      if (!product) {
        console.log(`⚠️ Produto "${productName}" não encontrado no Railway`);
        continue;
      }
      
      // Buscar estoque atual no Railway
      const inv = invMap.get(product.id);
      const estoqueAtualRailway = inv ? inv.qtyUnits : 0;
      
      // Buscar estoque local
      const localInv = db.prepare(`
        SELECT qty_units FROM inventory_items 
        WHERE product_id = ? AND branch_id = 'main-branch'
      `).get(product.id);
      const estoqueLocal = localInv ? localInv.qty_units : 0;
      
      const caixas = Math.floor(estoqueCorreto / product.unitsPerBox);
      const garrafas = estoqueCorreto % product.unitsPerBox;
      
      console.log(`📦 ${productName}:`);
      console.log(`   Estoque CORRETO (compras-vendas): ${estoqueCorreto} un (${caixas} cx + ${garrafas} gf)`);
      console.log(`   Railway atual: ${estoqueAtualRailway} un`);
      console.log(`   Local atual: ${estoqueLocal} un`);
      
      if (estoqueAtualRailway !== estoqueCorreto || estoqueLocal !== estoqueCorreto) {
        const adjustRailway = estoqueCorreto - estoqueAtualRailway;
        const adjustLocal = estoqueCorreto - estoqueLocal;
        
        console.log(`   ❌ PRECISA CORREÇÃO:`);
        console.log(`      Railway: ${adjustRailway > 0 ? '+' : ''}${adjustRailway}`);
        console.log(`      Local: ${adjustLocal > 0 ? '+' : ''}${adjustLocal}`);
        
        corrections.push({
          productId: product.id,
          productName,
          estoqueCorreto,
          adjustRailway,
          adjustLocal,
          branchId: inv?.branchId || 'main-branch'
        });
      } else {
        console.log(`   ✅ OK`);
      }
      console.log('');
    }
    
    if (corrections.length === 0) {
      console.log('✅ Nenhuma correção necessária!');
      db.close();
      return;
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   APLICANDO CORREÇÕES');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    for (const corr of corrections) {
      console.log(`🔧 Corrigindo ${corr.productName}...`);
      
      // 1. Corrigir Railway
      if (corr.adjustRailway !== 0) {
        const res = await request('PUT', '/api/v1/inventory/adjust-by-product', {
          productId: corr.productId,
          branchId: corr.branchId,
          adjustment: corr.adjustRailway,
          reason: `Correção de bug de duplicação de estoque (${new Date().toISOString()})`
        }, token);
        
        if (res.status === 200 || res.status === 201) {
          console.log(`   ✅ Railway corrigido: ${corr.adjustRailway > 0 ? '+' : ''}${corr.adjustRailway}`);
        } else {
          console.log(`   ❌ Erro Railway: ${res.status} - ${JSON.stringify(res.data)}`);
        }
      }
      
      // 2. Corrigir Local
      if (corr.adjustLocal !== 0) {
        db.prepare(`
          UPDATE inventory_items 
          SET qty_units = ?, 
              synced = 1,
              updated_at = datetime('now')
          WHERE product_id = ? AND branch_id = 'main-branch'
        `).run(corr.estoqueCorreto, corr.productId);
        
        console.log(`   ✅ Local corrigido: ${corr.adjustLocal > 0 ? '+' : ''}${corr.adjustLocal}`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   VERIFICAÇÃO FINAL');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Verificar Railway
    const invFinal = await request('GET', '/api/v1/inventory?limit=100', null, token);
    const invFinalData = invFinal.data.data || invFinal.data;
    
    for (const corr of corrections) {
      const inv = invFinalData.find(i => i.productId === corr.productId);
      const railwayFinal = inv ? inv.qtyUnits : 0;
      
      const localFinal = db.prepare(`
        SELECT qty_units FROM inventory_items 
        WHERE product_id = ? AND branch_id = 'main-branch'
      `).get(corr.productId);
      const localQty = localFinal ? localFinal.qty_units : 0;
      
      const product = prodMap.get(corr.productName);
      const caixas = Math.floor(corr.estoqueCorreto / product.unitsPerBox);
      const garrafas = corr.estoqueCorreto % product.unitsPerBox;
      
      console.log(`📦 ${corr.productName}:`);
      console.log(`   Esperado: ${corr.estoqueCorreto} un (${caixas} cx + ${garrafas} gf)`);
      console.log(`   Railway: ${railwayFinal} un ${railwayFinal === corr.estoqueCorreto ? '✅' : '❌'}`);
      console.log(`   Local: ${localQty} un ${localQty === corr.estoqueCorreto ? '✅' : '❌'}`);
    }
    
    db.close();
    
    console.log('\n✅ Correção concluída!');
    console.log('\n⚠️ IMPORTANTE: Reinicie o app Electron para que as mudanças apareçam na tela.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
