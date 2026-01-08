/**
 * CORREÇÃO DE ESTOQUE - VALORES CALCULADOS
 * 
 * Estoque correto = Total Comprado - Total Vendido
 * 
 * Super Bock mini: 1152 - 816 = 336
 * fogo de Pias:    180 - 128 = 52
 * Cristal:         192 - 177 = 15
 */

const https = require('https');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';
const AUTH_EMAIL = 'isnatchuda1@gmail.com';
const AUTH_PASSWORD = 'isna123';

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

// VALORES CORRETOS: Compras - Vendas = Estoque Teórico
const ESTOQUE_CORRETO = {
  'Super Bock mini': 336,  // 1152 - 816
  'fogo de Pias': 52,      // 180 - 128
  'Cristal': 15,           // 192 - 177
};

async function request(method, urlPath, data = null, token = null) {
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

async function login() {
  console.log('🔐 Fazendo login no Railway...');
  const res = await request('POST', '/api/v1/auth/login', { email: AUTH_EMAIL, password: AUTH_PASSWORD });
  if (res.status !== 200 && res.status !== 201) throw new Error(`Login falhou: ${res.status}`);
  return res.data.accessToken || res.data.access_token;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        CORREÇÃO DE ESTOQUE - COMPRAS MENOS VENDAS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Conectar ao banco local
    console.log('📂 Conectando ao banco local...');
    const db = new Database(DB_PATH);
    
    // 2. Login no Railway
    const token = await login();
    console.log('✅ Login OK\n');

    // 3. Buscar produtos e IDs
    console.log('📋 Buscando produtos...');
    const produtos = db.prepare(`
      SELECT p.id, p.name, p.railway_id, i.qty_units as estoque_atual
      FROM products p
      LEFT JOIN inventory_items i ON p.id = i.product_id
      WHERE p.name IN (${Object.keys(ESTOQUE_CORRETO).map(() => '?').join(',')})
    `).all(...Object.keys(ESTOQUE_CORRETO));

    console.log('\n┌─────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ Produto                 │ Atual    │ Correto  │ Ajuste   │');
    console.log('├─────────────────────────┼──────────┼──────────┼──────────┤');

    const correcoes = [];
    for (const prod of produtos) {
      const correto = ESTOQUE_CORRETO[prod.name];
      const atual = prod.estoque_atual || 0;
      const ajuste = correto - atual;
      
      console.log(`│ ${prod.name.padEnd(23)} │ ${String(atual).padStart(8)} │ ${String(correto).padStart(8)} │ ${(ajuste >= 0 ? '+' : '') + ajuste}`.padEnd(66) + '│');
      
      if (ajuste !== 0) {
        correcoes.push({
          id: prod.id,
          name: prod.name,
          railwayId: prod.railway_id,
          atual,
          correto,
          ajuste
        });
      }
    }
    console.log('└─────────────────────────┴──────────┴──────────┴──────────┘\n');

    if (correcoes.length === 0) {
      console.log('✅ Todos os estoques já estão corretos!');
      db.close();
      return;
    }

    // 4. Aplicar correções LOCALMENTE
    console.log('🔧 Aplicando correções LOCAIS...');
    const updateLocal = db.prepare(`
      UPDATE inventory_items 
      SET qty_units = ?, updated_at = datetime('now'), synced = 1
      WHERE product_id = ?
    `);
    
    for (const c of correcoes) {
      updateLocal.run(c.correto, c.id);
      console.log(`   ✅ ${c.name}: ${c.atual} → ${c.correto}`);
    }

    // 5. Aplicar correções no RAILWAY
    console.log('\n🌐 Aplicando correções no RAILWAY...');
    for (const c of correcoes) {
      if (!c.railwayId) {
        console.log(`   ⚠️ ${c.name}: Sem railway_id, pulando...`);
        continue;
      }
      
      const res = await request('PUT', `/api/v1/inventory/adjust-by-product`, {
        productId: c.railwayId,
        adjustment: c.ajuste,
        reason: 'Correção: estoque = compras - vendas',
        movementType: 'adjustment'
      }, token);
      
      if (res.status === 200 || res.status === 201) {
        console.log(`   ✅ ${c.name}: ajuste de ${c.ajuste >= 0 ? '+' : ''}${c.ajuste}`);
      } else {
        console.log(`   ❌ ${c.name}: Erro ${res.status} - ${JSON.stringify(res.data)}`);
      }
    }

    // 6. Verificar Railway
    console.log('\n📊 Verificando Railway...');
    const inventoryRes = await request('GET', '/api/v1/inventory', null, token);
    if (inventoryRes.status === 200) {
      const items = inventoryRes.data;
      for (const c of correcoes) {
        const item = items.find(i => i.product?.id === c.railwayId || i.productId === c.railwayId);
        if (item) {
          const qty = item.qtyUnits || item.qty_units || 0;
          const status = qty === c.correto ? '✅' : '❌';
          console.log(`   ${status} ${c.name}: ${qty} (esperado: ${c.correto})`);
        }
      }
    }

    db.close();
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    CORREÇÃO CONCLUÍDA!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n⚠️  REINICIE O ELECTRON para ver os valores atualizados!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

main();
