/**
 * Sincroniza estoque correto (compras - vendas) com o Railway
 */

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';
const AUTH_EMAIL = 'isnatchuda1@gmail.com';
const AUTH_PASSWORD = 'isna123';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

function sqlite(query) {
  const cmd = `sqlite3 "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (e) {
    console.error('Erro SQL:', e.message);
    return '';
  }
}

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

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         SINCRONIZAR ESTOQUE CORRETO COM RAILWAY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Login
  console.log('🔐 Fazendo login...');
  const loginRes = await request('POST', '/api/v1/auth/login', { email: AUTH_EMAIL, password: AUTH_PASSWORD });
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error(`Login falhou: ${loginRes.status}`);
  }
  const token = loginRes.data.accessToken || loginRes.data.access_token;
  console.log('✅ Login OK\n');

  // Buscar inventário Railway
  console.log('📡 Buscando inventário Railway...');
  const invRes = await request('GET', '/api/v1/inventory', null, token);
  const railwayInventory = invRes.data;
  console.log(`   ${railwayInventory.length} itens no Railway\n`);

  // Criar mapa Railway: nome -> { id, qty }
  const railwayMap = {};
  for (const item of railwayInventory) {
    if (item.product) {
      railwayMap[item.product.name] = {
        id: item.product.id,
        qty: item.qtyUnits || 0
      };
    }
  }

  // Buscar estoque local correto
  console.log('📂 Buscando estoque local...');
  const localQuery = `
    SELECT p.name, i.qty_units 
    FROM products p 
    JOIN inventory_items i ON p.id = i.product_id
  `;
  const localData = sqlite(localQuery);
  
  if (!localData) {
    console.log('⚠️ Nenhum produto local encontrado');
    return;
  }

  // Calcular diferenças
  const corrections = [];
  const lines = localData.split('\n');
  
  console.log('\n┌─────────────────────────┬──────────┬──────────┬──────────┐');
  console.log('│ Produto                 │ Local    │ Railway  │ Ajuste   │');
  console.log('├─────────────────────────┼──────────┼──────────┼──────────┤');

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 2) continue;
    
    const [name, localQty] = parts;
    const localQtyNum = parseInt(localQty) || 0;
    
    const railwayItem = railwayMap[name];
    if (!railwayItem) continue;
    
    const railwayQty = railwayItem.qty;
    const adjustment = localQtyNum - railwayQty;
    
    if (adjustment !== 0) {
      console.log(`│ ${(name || '').substring(0,23).padEnd(23)} │ ${String(localQtyNum).padStart(8)} │ ${String(railwayQty).padStart(8)} │ ${(adjustment >= 0 ? '+' : '') + adjustment}`.padEnd(66) + '│');
      corrections.push({ railwayId: railwayItem.id, name, adjustment });
    }
  }
  
  console.log('└─────────────────────────┴──────────┴──────────┴──────────┘\n');

  if (corrections.length === 0) {
    console.log('✅ Railway já está sincronizado!');
    return;
  }

  // Aplicar correções
  console.log(`🔧 Aplicando ${corrections.length} correções no Railway...\n`);
  
  for (const c of corrections) {
    try {
      const res = await request('PUT', '/api/v1/inventory/adjust-by-product', {
        productId: c.railwayId,
        branchId: 'main-branch',
        adjustment: c.adjustment,
        reason: 'Sync: compras - vendas'
      }, token);
      
      if (res.status === 200 || res.status === 201) {
        console.log(`   ✅ ${c.name}: ${c.adjustment >= 0 ? '+' : ''}${c.adjustment}`);
      } else {
        console.log(`   ❌ ${c.name}: Erro ${res.status}`);
      }
    } catch (e) {
      console.log(`   ❌ ${c.name}: ${e.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    SINCRONIZAÇÃO CONCLUÍDA!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
