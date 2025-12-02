// Script para verificar dados no Railway
const https = require('https');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

let authToken = '';

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'admin@barmanager.com',
      password: 'Admin@123456'
    });

    const url = new URL(API_URL + '/auth/login');
    const options = {
      hostname: url.hostname,
      port: 443,
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
          const result = JSON.parse(body);
          authToken = result.accessToken;
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
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
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('VERIFICACAO DE DADOS NO RAILWAY');
  console.log('='.repeat(60));
  console.log();

  // Login no Railway
  console.log('Fazendo login no Railway...');
  await login();
  console.log('Login OK\n');

  // ============ INVENTARIO ============
  console.log('INVENTARIO');
  console.log('-'.repeat(40));
  const inventory = await fetchAPI('/inventory');
  console.log('Total de itens no inventario:', Array.isArray(inventory) ? inventory.length : 'erro');
  
  if (Array.isArray(inventory)) {
    inventory.forEach(item => {
      console.log(`  - ${item.product?.name || 'Produto'}: ${item.qtyUnits} unidades (minStock: ${item.minStock})`);
    });
  }
  console.log();

  // ============ MOVIMENTACOES ============
  console.log('MOVIMENTACOES');
  console.log('-'.repeat(40));
  const movements = await fetchAPI('/inventory/movements?limit=10');
  console.log('Movimentacoes retornadas:', Array.isArray(movements) ? movements.length : 'erro');
  
  if (Array.isArray(movements)) {
    movements.slice(0, 5).forEach(mov => {
      const prodName = mov.inventoryItem?.product?.name || 'Produto';
      console.log(`  - ${prodName}: ${mov.type} ${mov.qtyUnits} un - ${mov.reason || 'sem motivo'}`);
    });
  } else {
    console.log('Resposta:', JSON.stringify(movements, null, 2).substring(0, 500));
  }
  console.log();

  // ============ PRODUTOS ============
  console.log('PRODUTOS');
  console.log('-'.repeat(40));
  const products = await fetchAPI('/products');
  console.log('Total de produtos:', Array.isArray(products) ? products.length : 'erro');
  
  if (Array.isArray(products)) {
    products.forEach(prod => {
      console.log(`  - ${prod.name}: preco=${prod.priceUnit}, custo=${prod.costUnit}`);
    });
  }
  console.log();

  // ============ CATEGORIAS ============
  console.log('CATEGORIAS');
  console.log('-'.repeat(40));
  const categories = await fetchAPI('/products/categories');
  console.log('Total de categorias:', Array.isArray(categories) ? categories.length : 'erro');
  
  if (Array.isArray(categories)) {
    categories.forEach(cat => {
      console.log(`  - ${cat.name}`);
    });
  }
  console.log();

  // ============ VENDAS ============
  console.log('VENDAS');
  console.log('-'.repeat(40));
  const sales = await fetchAPI('/sales?limit=15');
  console.log('Total de vendas:', Array.isArray(sales) ? sales.length : 'erro');
  
  if (Array.isArray(sales)) {
    sales.forEach(sale => {
      const itemsCount = sale.items?.length || 0;
      const itemsTotal = sale.items?.reduce((sum, i) => sum + (i.total || 0), 0) || 0;
      console.log(`  - ${sale.saleNumber}: ID=${sale.id.substring(0,8)}... | Total=${(sale.total || 0)/100} FCFA | Items=${itemsCount} | ${sale.status}`);
    });
    
    // Buscar venda específica
    console.log('\n  Buscando venda 28775190...');
    const targetSale = sales.find(s => s.id.startsWith('28775190'));
    if (targetSale) {
      console.log('    ENCONTRADA!', targetSale.saleNumber);
    } else {
      console.log('    Nao encontrada com esse ID');
    }
  } else {
    console.log('  Resposta:', JSON.stringify(sales).substring(0, 200));
  }
  console.log();

  // ============ DIVIDAS ============
  console.log('DIVIDAS');
  console.log('-'.repeat(40));
  const debts = await fetchAPI('/debts');
  console.log('Total de dividas:', Array.isArray(debts) ? debts.length : 'erro');
  
  if (Array.isArray(debts)) {
    debts.forEach(debt => {
      const customerName = debt.customer?.fullName || debt.customer?.name || 'N/A';
      const paymentsCount = debt.payments?.length || 0;
      console.log(`  - ${debt.debtNumber}: ${customerName} | Saldo=${(debt.balance || 0)/100} FCFA | Pagamentos=${paymentsCount} | ${debt.status}`);
    });
  } else {
    console.log('  Resposta:', JSON.stringify(debts).substring(0, 200));
  }
  console.log();

  // ============ CLIENTES ============
  console.log('CLIENTES');
  console.log('-'.repeat(40));
  const customers = await fetchAPI('/customers');
  console.log('Total de clientes:', Array.isArray(customers) ? customers.length : 'erro');
  
  if (Array.isArray(customers)) {
    customers.forEach(cust => {
      console.log(`  - ${cust.fullName || cust.name}: Divida atual=${(cust.currentDebt || 0)/100} FCFA | Pontos=${cust.loyaltyPoints || 0}`);
    });
  }
}

main().catch(console.error);
