/**
 * Script de migração: Criar dívidas retroativas para vendas VALE sem dívida
 * 
 * Este script identifica vendas com pagamento VALE que não possuem 
 * registro de dívida associado e cria as dívidas retroativamente.
 * 
 * Execução: node migrate-vale-debts.js
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

function postToRailway(endpoint, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: RAILWAY_HOST,
      path: `/api/v1${endpoint}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ success: true, raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 MIGRAÇÃO: Criar Dívidas para Vendas VALE');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Buscar todas as vendas
    console.log('📥 Buscando vendas...');
    const sales = await fetchFromRailway('/sales');
    console.log(`   Total de vendas: ${sales.length}`);

    // 2. Buscar todas as dívidas existentes
    console.log('📥 Buscando dívidas existentes...');
    const existingDebts = await fetchFromRailway('/debts');
    console.log(`   Dívidas existentes: ${existingDebts.length}`);

    // Criar set de saleIds que já têm dívida
    const salesWithDebt = new Set();
    for (const debt of existingDebts) {
      if (debt.saleId) {
        salesWithDebt.add(debt.saleId);
      }
    }

    // 3. Identificar vendas VALE sem dívida
    console.log('\n📊 Analisando vendas VALE...\n');
    
    const valeSalesWithoutDebt = [];

    for (const sale of sales) {
      const payments = sale.payments || [];
      const valePayment = payments.find(p => 
        p.method?.toUpperCase() === 'VALE' || 
        p.method?.toUpperCase() === 'FIADO' ||
        p.method?.toUpperCase() === 'DEBT'
      );

      if (valePayment) {
        // Verificar se tem dívida
        if (!salesWithDebt.has(sale.id)) {
          // Verificar se tem cliente
          if (sale.customerId) {
            valeSalesWithoutDebt.push({
              sale,
              payment: valePayment
            });
          } else {
            console.log(`   ⚠️ Venda ${sale.saleNumber || sale.id.slice(0,8)} VALE sem cliente - não é possível criar dívida`);
          }
        }
      }
    }

    console.log(`\n📈 RESUMO:`);
    console.log(`   - Vendas VALE sem dívida (com cliente): ${valeSalesWithoutDebt.length}`);

    if (valeSalesWithoutDebt.length === 0) {
      console.log('\n✅ Nenhuma dívida a criar. Tudo em ordem!');
      return;
    }

    // 4. Criar dívidas retroativas
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📝 CRIANDO DÍVIDAS RETROATIVAS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    let created = 0;
    let errors = 0;

    for (const { sale, payment } of valeSalesWithoutDebt) {
      const customerName = sale.customer?.name || sale.customerId?.slice(0,8);
      const amount = payment.amount || sale.total;
      
      console.log(`📌 Venda #${sale.saleNumber || sale.id.slice(0,8)}`);
      console.log(`   Cliente: ${customerName}`);
      console.log(`   Valor: ${(amount / 100).toLocaleString()} FCFA`);

      try {
        const debtData = {
          customerId: sale.customerId,
          saleId: sale.id,
          branchId: sale.branchId || 'main-branch',
          amount: amount,
          description: `Dívida retroativa - Venda ${sale.saleNumber || sale.id.slice(0,8)}`,
          notes: `Migração automática - Data original: ${sale.createdAt}`
        };

        await postToRailway('/debts', debtData);
        console.log(`   ✅ Dívida criada com sucesso\n`);
        created++;
      } catch (e) {
        console.log(`   ❌ Erro: ${e.message}\n`);
        errors++;
      }
    }

    // 5. Resumo final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESULTADO DA MIGRAÇÃO:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`   ✅ Dívidas criadas: ${created}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log(`   📋 Total processado: ${valeSalesWithoutDebt.length}`);

  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

main();
