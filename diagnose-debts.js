/**
 * Script de diagnóstico completo para o bug de Dívidas não aparecendo no Electron
 * 
 * Verifica:
 * 1. Quantas dívidas existem no Railway
 * 2. Quantos clientes existem
 * 3. Se todas as dívidas têm clientes válidos
 * 4. Se as vendas VALE têm customerId
 */

const axios = require('axios');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

async function login() {
  console.log('🔐 Fazendo login...');
  const response = await axios.post(`${API_URL}/auth/login`, {
    email: 'isnatchuda1@gmail.com',
    password: 'isna123'
  });
  return response.data.accessToken;
}

async function diagnose() {
  try {
    const token = await login();
    console.log('✅ Login OK\n');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // 1. Buscar todos os clientes
    console.log('═══════════════════════════════════════════════════════');
    console.log('1️⃣ CLIENTES');
    console.log('═══════════════════════════════════════════════════════');
    const customersResponse = await axios.get(`${API_URL}/customers`, { headers });
    const customers = customersResponse.data;
    console.log(`Total de clientes: ${customers.length}`);
    
    const customerIds = new Set(customers.map(c => c.id));
    console.log(`IDs únicos: ${customerIds.size}`);
    
    // 2. Buscar todas as dívidas
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('2️⃣ DÍVIDAS');
    console.log('═══════════════════════════════════════════════════════');
    const debtsResponse = await axios.get(`${API_URL}/debts`, { headers });
    const debts = debtsResponse.data;
    console.log(`Total de dívidas: ${debts.length}`);
    
    // Verificar dívidas com clientes inválidos
    const debtsWithInvalidCustomer = debts.filter(d => {
      const customerId = d.customerId || d.customer_id;
      return !customerIds.has(customerId);
    });
    console.log(`Dívidas com cliente inválido: ${debtsWithInvalidCustomer.length}`);
    
    if (debtsWithInvalidCustomer.length > 0) {
      console.log('⚠️ Dívidas com problema:');
      debtsWithInvalidCustomer.forEach(d => {
        console.log(`   ${d.debtNumber || d.debt_number} | customerId: ${d.customerId || d.customer_id}`);
      });
    }
    
    // 3. Buscar vendas com VALE
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('3️⃣ VENDAS COM VALE');
    console.log('═══════════════════════════════════════════════════════');
    const salesResponse = await axios.get(`${API_URL}/sales?limit=100`, { headers });
    const sales = salesResponse.data;
    
    const valeSales = sales.filter(s => 
      s.payments?.some(p => p.method === 'VALE') ||
      s.paymentMethod === 'VALE'
    );
    console.log(`Vendas com VALE: ${valeSales.length}`);
    
    const valeSalesWithoutCustomer = valeSales.filter(s => !s.customerId);
    console.log(`Vendas VALE sem customerId: ${valeSalesWithoutCustomer.length}`);
    
    if (valeSalesWithoutCustomer.length > 0) {
      console.log('⚠️ Vendas VALE sem cliente cadastrado:');
      valeSalesWithoutCustomer.forEach(s => {
        console.log(`   ${s.saleNumber} | type: ${s.type} | customerName: ${s.customerName || 'N/A'}`);
      });
    }
    
    // 4. Verificar dívidas pendentes
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('4️⃣ DÍVIDAS PENDENTES (devem aparecer no Electron)');
    console.log('═══════════════════════════════════════════════════════');
    const pendingDebts = debts.filter(d => d.status === 'pending');
    console.log(`Dívidas pendentes: ${pendingDebts.length}`);
    
    // Agrupar por cliente
    const debtsByCustomer = {};
    pendingDebts.forEach(d => {
      const customerId = d.customerId || d.customer_id;
      if (!debtsByCustomer[customerId]) {
        debtsByCustomer[customerId] = [];
      }
      debtsByCustomer[customerId].push(d);
    });
    
    console.log('\nResumo por cliente:');
    for (const [customerId, customerDebts] of Object.entries(debtsByCustomer)) {
      const customer = customers.find(c => c.id === customerId);
      const customerName = customer?.name || customer?.fullName || 'Desconhecido';
      const totalBalance = customerDebts.reduce((sum, d) => sum + (d.balance || 0), 0);
      console.log(`   ${customerName}: ${customerDebts.length} dívidas, saldo: ${totalBalance / 100} FCFA`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ DIAGNÓSTICO COMPLETO');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

diagnose();
