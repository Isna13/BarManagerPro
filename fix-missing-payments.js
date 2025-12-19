/**
 * Script para corrigir vendas sem registro de pagamento no Railway
 * 
 * Problema: Vendas de mesa sincronizadas do mobile sem criar registro na tabela payments
 * Resultado: Electron mostra "Outro" em vez do método correto
 * 
 * Este script:
 * 1. Busca todas as vendas que não têm payments
 * 2. Cria um registro de payment com método padrão CASH (para vendas antigas)
 *    ou usa o paymentMethod da venda se disponível
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

async function fixMissingPayments() {
  try {
    const token = await login();
    console.log('✅ Login OK');
    
    const headers = { Authorization: `Bearer ${token}` };
    
    // Buscar todas as vendas
    console.log('\n📋 Buscando vendas sem pagamentos...');
    const salesResponse = await axios.get(`${API_URL}/sales?limit=100`, { headers });
    const allSales = salesResponse.data;
    
    // Filtrar vendas sem payments
    const salesWithoutPayments = allSales.filter(s => !s.payments || s.payments.length === 0);
    
    console.log(`📊 Total de vendas: ${allSales.length}`);
    console.log(`❌ Vendas sem payments: ${salesWithoutPayments.length}`);
    
    if (salesWithoutPayments.length === 0) {
      console.log('\n✅ Todas as vendas têm pagamentos!');
      return;
    }
    
    console.log('\n🔧 Corrigindo vendas...\n');
    
    let fixed = 0;
    let errors = 0;
    
    for (const sale of salesWithoutPayments) {
      try {
        // Determinar método de pagamento
        // Prioridade: paymentMethod da venda > CASH (default para vendas antigas)
        const method = sale.paymentMethod || 'CASH';
        
        console.log(`  📝 Venda ${sale.saleNumber}:`);
        console.log(`     customerName: ${sale.customerName || 'Avulso'}`);
        console.log(`     total: ${sale.total}`);
        console.log(`     método: ${method}`);
        
        // Criar payment
        await axios.post(`${API_URL}/sales/${sale.id}/payments`, {
          method: method,
          amount: sale.total || 0
        }, { headers });
        
        console.log(`     ✅ Payment criado!`);
        fixed++;
      } catch (err) {
        console.log(`     ❌ Erro: ${err.response?.data?.message || err.message}`);
        errors++;
      }
    }
    
    console.log('\n════════════════════════════════════════');
    console.log('📊 RESUMO:');
    console.log(`   ✅ Corrigidas: ${fixed}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log('════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

fixMissingPayments();
