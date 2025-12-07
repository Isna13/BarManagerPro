const Database = require('better-sqlite3');
const path = require('path');
const https = require('https');

const dbPath = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
const db = new Database(dbPath);

console.log('=== CAIXAS NO BANCO LOCAL ===');
const cashBoxes = db.prepare('SELECT id, box_number, status, opened_at, closed_at, opening_cash, closing_cash, synced FROM cash_boxes ORDER BY opened_at DESC LIMIT 10').all();
cashBoxes.forEach(cb => {
  console.log('ID:', cb.id);
  console.log('  Status:', cb.status, '| Synced:', cb.synced);
  console.log('  Abertura:', cb.opened_at);
  console.log('  Fechamento:', cb.closed_at);
  console.log('  Opening:', cb.opening_cash, '| Closing:', cb.closing_cash);
  console.log('');
});

console.log('=== FILA DE SINCRONIZAÇÃO (cash_box) ===');
const syncQueue = db.prepare(`SELECT * FROM sync_queue WHERE entity = 'cash_box' ORDER BY created_at DESC LIMIT 10`).all();
if (syncQueue.length === 0) {
  console.log('Nenhum item de cash_box na fila');
} else {
  syncQueue.forEach(sq => {
    console.log('ID:', sq.id, '| Entity ID:', sq.entity_id);
    console.log('  Op:', sq.operation, '| Status:', sq.status, '| Retries:', sq.retry_count);
    console.log('  Error:', sq.error_message || 'none');
    console.log('');
  });
}

// Agora verificar no Railway
console.log('\n=== VERIFICANDO NO RAILWAY ===');

const loginData = JSON.stringify({email:'isnatchuda1@gmail.com', password:'isna123'});
const loginOptions = {
  hostname: 'barmanagerbackend-production.up.railway.app',
  port: 443,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': loginData.length}
};

const loginReq = https.request(loginOptions, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const json = JSON.parse(body);
    const token = json.accessToken;
    
    if (!token) {
      console.log('Erro ao fazer login');
      db.close();
      return;
    }
    
    console.log('Login OK, buscando caixas do Railway...\n');
    
    // Buscar caixas do Railway
    const opts = {
      hostname: 'barmanagerbackend-production.up.railway.app',
      port: 443,
      path: '/api/v1/cash-box/history?limit=10',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token }
    };
    
    https.get(opts, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        console.log('=== CAIXAS NO RAILWAY ===');
        const railwayCashBoxes = JSON.parse(data);
        
        railwayCashBoxes.forEach(cb => {
          console.log('ID:', cb.id);
          console.log('  Status:', cb.status);
          console.log('  Abertura:', cb.openedAt);
          console.log('  Fechamento:', cb.closedAt);
          console.log('  Opening:', cb.openingCash, '| Closing:', cb.closingCash);
          console.log('');
        });
        
        // Comparar
        console.log('\n=== COMPARAÇÃO ===');
        const localClosed = cashBoxes.filter(cb => cb.status === 'closed');
        const railwayIds = new Set(railwayCashBoxes.map(cb => cb.id));
        
        const missingInRailway = localClosed.filter(cb => !railwayIds.has(cb.id));
        
        if (missingInRailway.length === 0) {
          console.log('✅ Todos os caixas fechados locais estão no Railway!');
        } else {
          console.log('❌ Caixas fechados locais que NÃO estão no Railway:');
          missingInRailway.forEach(cb => {
            console.log('  -', cb.id, '| Fechado em:', cb.closed_at);
          });
        }
        
        // Verificar caixa atual
        console.log('\n=== CAIXA ATUAL ===');
        const localOpen = cashBoxes.find(cb => cb.status === 'open');
        if (localOpen) {
          console.log('Local: Caixa aberto -', localOpen.id);
        } else {
          console.log('Local: Nenhum caixa aberto');
        }
        
        // Buscar caixa atual no Railway
        https.get({
          hostname: 'barmanagerbackend-production.up.railway.app',
          port: 443,
          path: '/api/v1/cash-box/current',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token }
        }, (r2) => {
          let data2 = '';
          r2.on('data', c => data2 += c);
          r2.on('end', () => {
            if (data2 && data2 !== 'null') {
              const current = JSON.parse(data2);
              if (current && current.id) {
                console.log('Railway: Caixa aberto -', current.id, '| Status:', current.status);
              } else {
                console.log('Railway: Nenhum caixa aberto');
              }
            } else {
              console.log('Railway: Nenhum caixa aberto');
            }
            
            db.close();
          });
        });
      });
    });
  });
});

loginReq.write(loginData);
loginReq.end();
