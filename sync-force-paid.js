/**
 * Script para Sincronizar Dívidas Pagas do SQLite Local para o Railway
 * 
 * Este script:
 * 1. Autentica no Railway
 * 2. Lê as dívidas pagas do banco SQLite local
 * 3. Atualiza o status dessas dívidas no Railway via PATCH
 */

const https = require('https');
const path = require('path');

// Configuração
const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');

// Credenciais
const CREDENTIALS = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Função para fazer requisições HTTP
function httpRequest(method, endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
  console.log('🔄 Script de Sincronização de Dívidas Pagas');
  console.log('============================================\n');

  // 1. Autenticar no Railway
  console.log(`🔐 Autenticando como ${CREDENTIALS.email}...`);
  const loginResult = await httpRequest('POST', '/auth/login', CREDENTIALS);
  
  if (loginResult.status !== 200 && loginResult.status !== 201) {
    console.log(`❌ Falha no login: ${loginResult.data?.message || loginResult.status}`);
    return;
  }
  
  const token = loginResult.data.accessToken || loginResult.data.access_token;
  console.log('✅ Login bem-sucedido!\n');

  // 2. Buscar dívidas do Railway
  console.log('📡 Buscando dívidas do Railway...');
  const debtsResult = await httpRequest('GET', '/debts', null, token);
  
  if (debtsResult.status !== 200) {
    console.log(`❌ Erro ao buscar dívidas: ${debtsResult.data?.message || debtsResult.status}`);
    return;
  }
  
  const railwayDebts = debtsResult.data;
  console.log(`\n📊 Total de dívidas no Railway: ${railwayDebts.length}`);
  console.log('─────────────────────────────────────────\n');
  
  console.log('📋 Estado atual das dívidas no Railway:');
  railwayDebts.forEach(d => {
    const customerName = d.customer?.fullName || 'N/A';
    const original = d.originalAmount / 100;
    const paid = (d.paid || 0) / 100;
    const balance = d.balance / 100;
    const status = d.status;
    console.log(`  • ${customerName}: ${original} FCFA → Pago: ${paid}, Saldo: ${balance}, Status: ${status}`);
  });

  // 3. Identificar dívidas que precisam ser atualizadas (pendentes no Railway)
  const pendingDebts = railwayDebts.filter(d => d.status !== 'paid' && d.balance > 0);
  const paidDebts = railwayDebts.filter(d => d.status === 'paid' || d.balance === 0);
  
  console.log(`\n✅ Dívidas já pagas no Railway: ${paidDebts.length}`);
  console.log(`⏳ Dívidas pendentes no Railway: ${pendingDebts.length}`);

  if (pendingDebts.length === 0) {
    console.log('\n✨ Todas as dívidas já estão sincronizadas como pagas no Railway!');
    return;
  }

  // 4. Perguntar quais dívidas devem ser marcadas como pagas
  console.log('\n⚠️  As seguintes dívidas estão pendentes no Railway:');
  pendingDebts.forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.customer?.fullName}: ${d.balance/100} FCFA restantes (ID: ${d.id.substring(0,8)}...)`);
  });

  console.log('\n📝 Para sincronizar dívidas específicas como PAGAS, use:');
  console.log('   node sync-force-paid.js <debtId1> <debtId2> ...\n');
  
  // 5. Se passaram IDs como argumentos, atualizar
  const debtIdsToSync = process.argv.slice(2);
  
  if (debtIdsToSync.length > 0) {
    console.log(`\n🔄 Sincronizando ${debtIdsToSync.length} dívida(s) como PAGAS...\n`);
    
    for (const debtId of debtIdsToSync) {
      // Encontrar a dívida
      const debt = railwayDebts.find(d => d.id === debtId || d.id.startsWith(debtId));
      
      if (!debt) {
        console.log(`❌ Dívida não encontrada: ${debtId}`);
        continue;
      }
      
      console.log(`📤 Atualizando dívida de ${debt.customer?.fullName}...`);
      
      // Chamar PATCH para marcar como paga
      const updateResult = await httpRequest('PATCH', `/debts/${debt.id}`, {
        paidAmount: debt.originalAmount,
        balance: 0,
        status: 'paid'
      }, token);
      
      if (updateResult.status === 200 || updateResult.status === 201) {
        console.log(`   ✅ Dívida atualizada com sucesso!`);
      } else {
        console.log(`   ❌ Erro: ${updateResult.data?.message || updateResult.status}`);
      }
    }
    
    console.log('\n✨ Sincronização concluída!');
  }
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
