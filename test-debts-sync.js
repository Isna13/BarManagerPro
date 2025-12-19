/**
 * Script de diagnóstico para verificar sincronização de dívidas
 * Executa diretamente no Railway para verificar estado dos dados
 */

const https = require('https');

const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function fetchAPI(endpoint, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${RAILWAY_API}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function login() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${RAILWAY_API}/auth/login`);
    const postData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.access_token);
        } catch {
          reject(new Error('Login failed'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔐 Fazendo login no Railway...');
  const token = await login();
  console.log('✅ Login realizado\n');

  // 1. Buscar todas as dívidas
  console.log('📊 DÍVIDAS NO RAILWAY:');
  console.log('='.repeat(60));
  
  const debts = await fetchAPI('/debts', token);
  
  if (Array.isArray(debts)) {
    console.log(`Total de dívidas: ${debts.length}`);
    
    const pending = debts.filter(d => d.status === 'pending');
    const partial = debts.filter(d => d.status === 'partial');
    const paid = debts.filter(d => d.status === 'paid');
    
    console.log(`  - Pendentes: ${pending.length}`);
    console.log(`  - Parciais: ${partial.length}`);
    console.log(`  - Pagas: ${paid.length}\n`);
    
    console.log('📋 LISTA DE DÍVIDAS PENDENTES:');
    console.log('-'.repeat(60));
    
    for (const debt of pending) {
      console.log(`\n  Dívida: ${debt.debtNumber || debt.debt_number}`);
      console.log(`    Cliente ID: ${debt.customerId || debt.customer_id}`);
      console.log(`    Valor: ${debt.originalAmount || debt.original_amount}`);
      console.log(`    Status: ${debt.status}`);
      console.log(`    Branch ID: ${debt.branchId || debt.branch_id}`);
      console.log(`    Sale ID: ${debt.saleId || debt.sale_id || 'N/A'}`);
    }
  } else {
    console.log('Resposta:', debts);
  }
  
  // 2. Buscar vendas com VALE
  console.log('\n\n📊 VENDAS COM MÉTODO VALE:');
  console.log('='.repeat(60));
  
  const sales = await fetchAPI('/sales?limit=100', token);
  
  if (Array.isArray(sales)) {
    const valeSales = sales.filter(s => 
      s.paymentMethod === 'VALE' || 
      (s.payments && s.payments.some(p => p.method === 'VALE'))
    );
    
    console.log(`Total de vendas VALE: ${valeSales.length}`);
    
    for (const sale of valeSales) {
      console.log(`\n  Venda: ${sale.saleNumber || sale.sale_number}`);
      console.log(`    ID: ${sale.id}`);
      console.log(`    Customer ID: ${sale.customerId || sale.customer_id || '❌ NULL'}`);
      console.log(`    Customer Name: ${sale.customerName || sale.customer_name || 'N/A'}`);
      console.log(`    Payment Method: ${sale.paymentMethod || sale.payment_method}`);
      console.log(`    Origin: ${sale.origin || 'unknown'}`);
      console.log(`    Total: ${sale.total}`);
      
      // Verificar se tem dívida associada
      const hasDebt = debts.find(d => 
        (d.saleId || d.sale_id) === sale.id ||
        (d.customerId || d.customer_id) === (sale.customerId || sale.customer_id)
      );
      console.log(`    Tem Dívida: ${hasDebt ? '✅ Sim' : '❌ Não'}`);
    }
  }

  // 3. Verificar clientes
  console.log('\n\n📊 CLIENTES CADASTRADOS:');
  console.log('='.repeat(60));
  
  const customers = await fetchAPI('/customers', token);
  
  if (Array.isArray(customers)) {
    console.log(`Total de clientes: ${customers.length}`);
    
    for (const customer of customers) {
      console.log(`\n  ${customer.fullName || customer.full_name}`);
      console.log(`    ID: ${customer.id}`);
      console.log(`    Código: ${customer.code}`);
      console.log(`    Limite: ${customer.creditLimit || customer.credit_limit || 0}`);
      console.log(`    Dívida Atual: ${customer.currentDebt || customer.current_debt || 0}`);
    }
  }
  
  console.log('\n\n✅ Diagnóstico completo!');
}

main().catch(console.error);
