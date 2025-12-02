// Script para diagnosticar problemas de vendas no Railway
const https = require('https');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
let authToken = null;

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  console.log('🔐 Fazendo login...');
  const result = await makeRequest('POST', '/auth/login', {
    email: 'isnatchuda1@gmail.com',
    password: 'admin123'
  });
  
  if (result.status === 200 || result.status === 201) {
    authToken = result.data.accessToken;
    console.log('✅ Login OK');
    return true;
  } else {
    console.error('❌ Erro no login:', result.data);
    return false;
  }
}

async function analyzeSales() {
  console.log('\n📊 Analisando vendas no Railway...\n');
  
  const result = await makeRequest('GET', '/sales?limit=20');
  
  if (result.status !== 200) {
    console.error('❌ Erro ao buscar vendas:', result);
    return;
  }
  
  const sales = result.data;
  console.log(`📦 Total de vendas encontradas: ${sales.length}\n`);
  
  let salesWithZeroTotal = 0;
  let salesWithItems = 0;
  let salesWithPayments = 0;
  let salesWithoutCustomerName = 0;
  
  console.log('═'.repeat(100));
  console.log('ID'.padEnd(40) + 'Total'.padStart(12) + 'Itens'.padStart(8) + 'Pgtos'.padStart(8) + 'Status'.padStart(12) + 'Cliente'.padStart(20));
  console.log('═'.repeat(100));
  
  for (const sale of sales) {
    const total = sale.total || 0;
    const items = sale.items?.length || 0;
    const payments = sale.payments?.length || 0;
    const status = sale.status || 'unknown';
    const customerName = sale.customer?.fullName || sale.customer?.name || 'Sem cliente';
    
    if (total === 0) salesWithZeroTotal++;
    if (items > 0) salesWithItems++;
    if (payments > 0) salesWithPayments++;
    if (!sale.customer?.fullName && !sale.customer?.name) salesWithoutCustomerName++;
    
    // Formatar total em FCFA
    const totalFormatted = (total / 100).toLocaleString('fr-FR') + ' FCFA';
    
    console.log(
      sale.id.substring(0, 38).padEnd(40) + 
      totalFormatted.padStart(12) + 
      items.toString().padStart(8) + 
      payments.toString().padStart(8) + 
      status.padStart(12) + 
      customerName.substring(0, 18).padStart(20)
    );
    
    // Se tem itens, mostrar detalhes
    if (items > 0) {
      let itemTotal = 0;
      for (const item of sale.items) {
        itemTotal += item.total || item.subtotal || 0;
        console.log(`    └─ ${(item.product?.name || 'Produto?').substring(0, 30)} x${item.qtyUnits} = ${((item.total || 0) / 100).toLocaleString()} FCFA`);
      }
      if (total !== itemTotal) {
        console.log(`    ⚠️ DISCREPÂNCIA: Total da venda (${total/100}) ≠ Soma dos itens (${itemTotal/100})`);
      }
    }
  }
  
  console.log('═'.repeat(100));
  console.log('\n📈 RESUMO:');
  console.log(`   - Vendas com total = 0: ${salesWithZeroTotal}/${sales.length}`);
  console.log(`   - Vendas com itens: ${salesWithItems}/${sales.length}`);
  console.log(`   - Vendas com pagamentos: ${salesWithPayments}/${sales.length}`);
  console.log(`   - Vendas sem nome do cliente: ${salesWithoutCustomerName}/${sales.length}`);
  
  if (salesWithZeroTotal > 0) {
    console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
    console.log('   Há vendas com total = 0. Isso pode significar:');
    console.log('   1. Os itens não estão sendo sincronizados corretamente');
    console.log('   2. Os itens são enviados antes da venda principal');
    console.log('   3. O método updateSaleTotals não está sendo chamado');
  }
}

async function analyzeCustomers() {
  console.log('\n📊 Analisando clientes no Railway...\n');
  
  const result = await makeRequest('GET', '/customers');
  
  if (result.status !== 200) {
    console.error('❌ Erro ao buscar clientes:', result);
    return;
  }
  
  const customers = result.data;
  console.log(`📦 Total de clientes: ${customers.length}\n`);
  
  let customersWithoutName = 0;
  let customersWithSales = 0;
  
  for (const customer of customers) {
    const name = customer.fullName || customer.firstName || customer.name;
    if (!name || name.trim() === '') {
      customersWithoutName++;
      console.log(`⚠️ Cliente sem nome: ${customer.id} (code: ${customer.code})`);
    }
  }
  
  console.log('\n📈 RESUMO CLIENTES:');
  console.log(`   - Clientes sem nome: ${customersWithoutName}/${customers.length}`);
}

async function main() {
  console.log('🔍 DIAGNÓSTICO DE VENDAS - BarManager Pro');
  console.log('=========================================\n');
  
  if (!(await login())) {
    return;
  }
  
  await analyzeSales();
  await analyzeCustomers();
  
  console.log('\n✅ Diagnóstico concluído!');
}

main().catch(console.error);
