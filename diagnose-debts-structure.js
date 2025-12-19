/**
 * Diagnóstico das dívidas existentes
 */
const https = require('https');

const RAILWAY_HOST = 'barmanagerbackend-production.up.railway.app';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDJiYjhjNi1kZmUyLTQwNTgtYmI5Yi00ZTkwZDEwM2YwNGUiLCJlbWFpbCI6ImlzbmF0Y2h1ZGExQGdtYWlsLmNvbSIsInJvbGUiOiJjYXNoaWVyIiwiYnJhbmNoSWQiOm51bGwsImlhdCI6MTc2NjA5MTU3MywiZXhwIjoxNzY2Njk2MzczfQ.RK_XodIoMd5n2xQDcTIfz-u-bGVMfeyUaw5NSZVgpQo';

function fetchFromRailway(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: RAILWAY_HOST,
      path: `/api/v1${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 ESTRUTURA DAS DÍVIDAS EXISTENTES');
  console.log('═══════════════════════════════════════════════════════════\n');

  const debts = await fetchFromRailway('/debts');
  
  console.log(`Total de dívidas: ${debts.length}\n`);
  
  // Agrupar por status
  const byStatus = {};
  const bySaleId = { with: 0, without: 0 };
  
  for (const debt of debts) {
    // Por status
    byStatus[debt.status] = (byStatus[debt.status] || 0) + 1;
    
    // Por saleId
    if (debt.saleId) {
      bySaleId.with++;
    } else {
      bySaleId.without++;
    }
  }

  console.log('📊 Por Status:');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`   - ${status}: ${count}`);
  }

  console.log('\n📊 Por SaleId:');
  console.log(`   - Com saleId: ${bySaleId.with}`);
  console.log(`   - Sem saleId: ${bySaleId.without}`);

  // Mostrar exemplos de dívidas pendentes
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 AMOSTRA DE DÍVIDAS PENDENTES (primeiras 5):');
  console.log('═══════════════════════════════════════════════════════════\n');

  const pendingDebts = debts.filter(d => d.status === 'pending').slice(0, 5);
  for (const debt of pendingDebts) {
    console.log(`📌 Dívida #${debt.debtNumber}`);
    console.log(`   ID: ${debt.id}`);
    console.log(`   Cliente: ${debt.customer?.name || debt.customerId}`);
    console.log(`   Valor: ${(debt.balance / 100).toLocaleString()} FCFA`);
    console.log(`   SaleId: ${debt.saleId || 'NÃO ASSOCIADA'}`);
    console.log(`   Criada em: ${debt.createdAt}`);
    console.log(`   Notes: ${debt.notes || '-'}`);
    console.log('');
  }
}

main().catch(console.error);
