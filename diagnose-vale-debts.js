/**
 * Script de diagnóstico: Vendas VALE sem dívidas
 * Identifica vendas com pagamento VALE que não geraram dívida
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
  console.log('🔍 DIAGNÓSTICO: Vendas VALE sem Dívidas');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Buscar todas as vendas
    console.log('📥 Buscando vendas...');
    const sales = await fetchFromRailway('/sales');
    console.log(`   Total de vendas: ${sales.length}`);

    // 2. Buscar todas as dívidas
    console.log('📥 Buscando dívidas...');
    const debts = await fetchFromRailway('/debts');
    console.log(`   Total de dívidas: ${debts.length}`);

    // 3. Criar mapa de saleId -> debt
    const debtBySaleId = new Map();
    for (const debt of debts) {
      if (debt.saleId) {
        debtBySaleId.set(debt.saleId, debt);
      }
    }
    console.log(`   Dívidas com saleId: ${debtBySaleId.size}`);

    // 4. Identificar vendas VALE
    console.log('\n📊 Analisando vendas com pagamento VALE...\n');
    
    const valeSales = [];
    const valeSalesWithoutDebt = [];
    const valeSalesWithDebt = [];

    for (const sale of sales) {
      // Verificar pagamentos
      const payments = sale.payments || [];
      const hasValePayment = payments.some(p => 
        p.method?.toUpperCase() === 'VALE' || 
        p.method?.toUpperCase() === 'FIADO' ||
        p.method?.toUpperCase() === 'DEBT'
      );

      if (hasValePayment) {
        valeSales.push(sale);
        
        // Verificar se tem dívida associada
        const hasDebt = debtBySaleId.has(sale.id) || 
          debts.some(d => d.saleId === sale.id);

        if (hasDebt) {
          valeSalesWithDebt.push(sale);
        } else {
          valeSalesWithoutDebt.push(sale);
        }
      }
    }

    console.log(`📈 RESUMO:`);
    console.log(`   - Vendas com pagamento VALE: ${valeSales.length}`);
    console.log(`   - Com dívida registrada: ${valeSalesWithDebt.length} ✅`);
    console.log(`   - SEM dívida registrada: ${valeSalesWithoutDebt.length} ❌`);

    // 5. Detalhar vendas sem dívida
    if (valeSalesWithoutDebt.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('❌ VENDAS VALE SEM DÍVIDA REGISTRADA:');
      console.log('═══════════════════════════════════════════════════════════\n');

      for (const sale of valeSalesWithoutDebt) {
        const valePayment = sale.payments?.find(p => 
          p.method?.toUpperCase() === 'VALE' || 
          p.method?.toUpperCase() === 'FIADO' ||
          p.method?.toUpperCase() === 'DEBT'
        );

        console.log(`📌 Venda #${sale.saleNumber || sale.id.slice(0,8)}`);
        console.log(`   ID: ${sale.id}`);
        console.log(`   Data: ${sale.createdAt}`);
        console.log(`   Cliente: ${sale.customer?.name || sale.customerId || 'SEM CLIENTE'}`);
        console.log(`   Valor VALE: ${(valePayment?.amount / 100).toLocaleString()} FCFA`);
        console.log(`   Total Venda: ${(sale.total / 100).toLocaleString()} FCFA`);
        console.log(`   Origem: ${sale.source || sale.origin || 'desconhecida'}`);
        console.log(`   Status: ${sale.status}`);
        console.log('');
      }
    }

    // 6. Verificar se há vendas do Mobile especificamente
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📱 ANÁLISE POR ORIGEM:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const byOrigin = {};
    for (const sale of valeSales) {
      const origin = sale.source || sale.origin || 'unknown';
      if (!byOrigin[origin]) {
        byOrigin[origin] = { total: 0, withDebt: 0, withoutDebt: 0 };
      }
      byOrigin[origin].total++;
      
      const hasDebt = debtBySaleId.has(sale.id) || debts.some(d => d.saleId === sale.id);
      if (hasDebt) {
        byOrigin[origin].withDebt++;
      } else {
        byOrigin[origin].withoutDebt++;
      }
    }

    for (const [origin, stats] of Object.entries(byOrigin)) {
      console.log(`📍 Origem: ${origin}`);
      console.log(`   - Total VALE: ${stats.total}`);
      console.log(`   - Com dívida: ${stats.withDebt} ✅`);
      console.log(`   - Sem dívida: ${stats.withoutDebt} ${stats.withoutDebt > 0 ? '❌' : '✅'}`);
      console.log('');
    }

    // 7. Verificar estrutura dos payments
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 ESTRUTURA DOS PAGAMENTOS VALE:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const sampleSale = valeSales[0];
    if (sampleSale) {
      console.log('Exemplo de venda VALE:');
      console.log(JSON.stringify({
        id: sampleSale.id,
        saleNumber: sampleSale.saleNumber,
        customerId: sampleSale.customerId,
        total: sampleSale.total,
        status: sampleSale.status,
        source: sampleSale.source,
        payments: sampleSale.payments?.map(p => ({
          method: p.method,
          amount: p.amount,
          status: p.status
        }))
      }, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();
