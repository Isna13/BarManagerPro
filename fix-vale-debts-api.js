/**
 * Script para criar dívidas retroativas para vendas VALE via API
 * 
 * Este script:
 * 1. Busca vendas VALE via API do Railway
 * 2. Verifica quais não têm dívida associada  
 * 3. Usa a API para criar dívidas
 * 
 * Uso: node fix-vale-debts-api.js
 */

const https = require('https');

const API_BASE = 'https://barmanagerbackend-production.up.railway.app/api/v1';

// Token de autenticação - pode precisar atualizar
let authToken = null;

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'admin@barmanager.com',
      password: 'admin123'
    });

    const url = new URL(`${API_BASE}/auth/login`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          authToken = json.access_token || json.token;
          console.log('✅ Login realizado com sucesso');
          resolve(authToken);
        } catch (e) {
          reject(new Error('Erro ao fazer parse do login: ' + body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Erro ao fazer parse: ' + body.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function apiPost(endpoint, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const url = new URL(`${API_BASE}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 FIX: Criar dívidas retroativas para vendas VALE');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Login
    await login();

    // 2. Buscar vendas VALE
    console.log('\n📋 Buscando vendas VALE no Railway...');
    const sales = await apiGet('/sales?limit=500');
    const allSales = Array.isArray(sales) ? sales : (sales.data || []);
    
    const valeSales = allSales.filter(s => 
      s.paymentMethod === 'VALE' || 
      (s.payments && s.payments.some(p => p.method === 'VALE'))
    );
    
    console.log(`📊 Total de vendas: ${allSales.length}`);
    console.log(`📊 Vendas VALE: ${valeSales.length}\n`);

    // 3. Buscar dívidas existentes
    console.log('📋 Buscando dívidas existentes...');
    const debts = await apiGet('/debts');
    const allDebts = Array.isArray(debts) ? debts : (debts.data || []);
    
    const debtsBySaleId = new Map();
    for (const debt of allDebts) {
      if (debt.saleId) {
        debtsBySaleId.set(debt.saleId, debt.id);
      }
    }
    console.log(`📊 Dívidas com saleId: ${debtsBySaleId.size}\n`);

    // 4. Encontrar vendas sem dívida
    const salesWithoutDebt = valeSales.filter(s => !debtsBySaleId.has(s.id));
    console.log(`❌ Vendas VALE SEM dívida: ${salesWithoutDebt.length}\n`);

    if (salesWithoutDebt.length === 0) {
      console.log('✅ Todas as vendas VALE já possuem dívida!');
      return;
    }

    // 5. Listar vendas
    console.log('📋 Vendas VALE que precisam de dívida:');
    console.log('─────────────────────────────────────────────────────────');
    
    for (const sale of salesWithoutDebt) {
      const customerName = sale.customer?.fullName || sale.customerName || 'SEM CLIENTE';
      console.log(`   ${sale.saleNumber} | ${(sale.total/100).toFixed(0)} FCFA | ${customerName} | ${sale.customerId ? '✅ ID' : '❌ SEM ID'}`);
    }
    
    // 6. Filtrar apenas com customerId
    const toFix = salesWithoutDebt.filter(s => s.customerId);
    console.log(`\n✅ Com cliente: ${toFix.length}`);
    console.log(`⚠️ Sem cliente (ignoradas): ${salesWithoutDebt.length - toFix.length}\n`);

    if (toFix.length === 0) {
      console.log('⚠️ Nenhuma venda VALE com cliente para criar dívida.');
      return;
    }

    // 7. Criar dívidas
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 Criando dívidas...\n');

    let created = 0;
    let errors = 0;

    for (const sale of toFix) {
      try {
        const debtData = {
          customerId: sale.customerId,
          saleId: sale.id,
          branchId: sale.branchId,
          amount: sale.total,
          originalAmount: sale.total,
          notes: `Dívida retroativa para venda ${sale.saleNumber}`
        };

        const result = await apiPost('/debts', debtData);
        
        if (result.status === 201 || result.status === 200) {
          console.log(`   ✅ ${sale.saleNumber}: Dívida criada`);
          created++;
        } else {
          console.log(`   ❌ ${sale.saleNumber}: ${JSON.stringify(result.data)}`);
          errors++;
        }
      } catch (e) {
        console.log(`   ❌ ${sale.saleNumber}: ${e.message}`);
        errors++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESULTADO:');
    console.log(`   ✅ Dívidas criadas: ${created}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro fatal:', error);
  }
}

main();
