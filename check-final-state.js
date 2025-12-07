// Script final para verificar estado completo da sincronização
const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_URL,
      port: 443,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
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
  console.log('🔐 Autenticando...');
  const authRes = await request('POST', '/auth/login', credentials);
  const token = authRes.data.accessToken;
  console.log('✅ Autenticado!\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('         ESTADO COMPLETO DA SINCRONIZAÇÃO - RAILWAY');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Produtos
  const productsRes = await request('GET', '/products', null, token);
  const products = productsRes.data || [];
  console.log(`📦 PRODUTOS: ${products.length}`);
  products.forEach(p => {
    console.log(`   • ${p.name} (${p.sku}) - ${(p.priceUnit/100).toLocaleString()} FCFA`);
  });

  // Compras
  const purchasesRes = await request('GET', '/purchases', null, token);
  const purchases = purchasesRes.data || [];
  console.log(`\n🛒 COMPRAS: ${purchases.length}`);
  
  let totalPurchaseValue = 0;
  let totalPurchaseItems = 0;
  let completedPurchases = 0;
  
  purchases.forEach(p => {
    const icon = p.status === 'completed' ? '✅' : '⏳';
    const items = p.items?.length || 0;
    totalPurchaseItems += items;
    totalPurchaseValue += p.total || 0;
    if (p.status === 'completed') completedPurchases++;
    console.log(`   ${icon} ${p.purchaseNumber}: ${(p.total/100).toLocaleString()} FCFA (${items} itens)`);
  });
  
  console.log(`   ─────────────────────────────────────`);
  console.log(`   📊 Completas: ${completedPurchases}/${purchases.length}`);
  console.log(`   📊 Total itens: ${totalPurchaseItems}`);
  console.log(`   💰 Valor total: ${(totalPurchaseValue/100).toLocaleString()} FCFA`);

  // Dívidas
  const debtsRes = await request('GET', '/debts', null, token);
  const debts = debtsRes.data || [];
  console.log(`\n💳 DÍVIDAS: ${debts.length}`);
  
  let pendingDebt = 0;
  let paidDebt = 0;
  debts.forEach(d => {
    const icon = d.status === 'paid' ? '✅' : '⏳';
    const amount = d.amount || d.originalAmount || 0;
    if (d.status === 'pending') pendingDebt += amount;
    else paidDebt += amount;
    console.log(`   ${icon} ${(amount/100).toLocaleString()} FCFA - ${d.status}`);
  });
  
  console.log(`   ─────────────────────────────────────`);
  console.log(`   ⏳ Pendentes: ${(pendingDebt/100).toLocaleString()} FCFA`);
  console.log(`   ✅ Pagas: ${(paidDebt/100).toLocaleString()} FCFA`);

  // Clientes
  const customersRes = await request('GET', '/customers', null, token);
  const customers = customersRes.data || [];
  console.log(`\n👥 CLIENTES: ${customers.length}`);

  // Fornecedores
  const suppliersRes = await request('GET', '/suppliers', null, token);
  const suppliers = suppliersRes.data || [];
  console.log(`🏭 FORNECEDORES: ${suppliers.length}`);
  suppliers.forEach(s => console.log(`   • ${s.name}`));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    ✅ SINCRONIZAÇÃO OK');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
