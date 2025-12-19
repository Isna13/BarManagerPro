// Script para comparar dívidas Railway vs Electron
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const credentials = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

function request(method, apiPath, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_URL,
      port: 443,
      path: `/api/v1${apiPath}`,
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

function querySqlite(dbPath, sql) {
  try {
    const result = execSync(`sqlite3.exe "${dbPath}" "${sql}"`, { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (e) {
    console.error('Erro SQLite:', e.message);
    return [];
  }
}

async function main() {
  // 1. Conectar ao banco local
  const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');
  console.log('📁 Banco local:', dbPath);

  // 2. Buscar dívidas locais
  const debtsRaw = querySqlite(dbPath, "SELECT id || '|' || customer_id || '|' || status FROM debts");
  const localDebts = debtsRaw.map(row => {
    const [id, customer_id, status] = row.split('|');
    return { id, customer_id, status };
  });
  const localDebtIds = new Set(localDebts.map(d => d.id));
  console.log(`\n📦 ELECTRON LOCAL: ${localDebts.length} dívidas`);
  console.log(`   - Pending: ${localDebts.filter(d => d.status === 'pending').length}`);
  console.log(`   - Partial: ${localDebts.filter(d => d.status === 'partial').length}`);
  console.log(`   - Paid: ${localDebts.filter(d => d.status === 'paid').length}`);

  // 3. Buscar clientes locais (para verificar quais existem)
  const customersRaw = querySqlite(dbPath, "SELECT id FROM customers");
  const localCustomerIds = new Set(customersRaw);
  console.log(`\n👥 CLIENTES LOCAIS: ${customersRaw.length}`);

  // 4. Autenticar no Railway
  console.log('\n🔐 Autenticando no Railway...');
  const authRes = await request('POST', '/auth/login', credentials);
  if (authRes.status !== 201 && authRes.status !== 200) {
    console.error('❌ Falha na autenticação');
    return;
  }
  const token = authRes.data.accessToken;

  // 5. Buscar dívidas do Railway
  const debtsRes = await request('GET', '/debts', null, token);
  const railwayDebts = debtsRes.data || [];
  console.log(`\n☁️ RAILWAY: ${railwayDebts.length} dívidas`);
  console.log(`   - Pending: ${railwayDebts.filter(d => d.status === 'pending').length}`);
  console.log(`   - Partial: ${railwayDebts.filter(d => d.status === 'partial').length}`);
  console.log(`   - Paid: ${railwayDebts.filter(d => d.status === 'paid').length}`);

  // 6. Comparar
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 COMPARAÇÃO RAILWAY × ELECTRON');
  console.log('═══════════════════════════════════════════════════');

  const missingDebts = railwayDebts.filter(d => !localDebtIds.has(d.id));
  const missingPending = missingDebts.filter(d => d.status === 'pending' || d.status === 'partial');
  
  console.log(`\n❌ DÍVIDAS FALTANTES NO ELECTRON: ${missingDebts.length}`);
  console.log(`   - Pendentes/Parciais faltando: ${missingPending.length}`);
  
  if (missingPending.length > 0) {
    console.log('\n🔴 DÍVIDAS PENDENTES QUE NÃO APARECEM NO ELECTRON:');
    console.log('─────────────────────────────────────────────────────');
    
    for (const debt of missingPending) {
      const customerId = debt.customerId || debt.customer_id;
      const customerName = debt.customer?.fullName || 'N/A';
      const hasCustomerLocal = localCustomerIds.has(customerId);
      const amount = (debt.amount || debt.originalAmount || 0) / 100;
      const balance = (debt.balance || 0) / 100;
      
      console.log(`\n   ID: ${debt.id}`);
      console.log(`   Cliente: ${customerName} (${customerId})`);
      console.log(`   Cliente existe local? ${hasCustomerLocal ? '✅ SIM' : '❌ NÃO - ESTE É O PROBLEMA!'}`);
      console.log(`   Valor: ${amount.toLocaleString('pt-BR')} FCFA`);
      console.log(`   Saldo: ${balance.toLocaleString('pt-BR')} FCFA`);
      console.log(`   Status: ${debt.status}`);
      console.log(`   Criado: ${debt.createdAt}`);
    }
  }

  // 7. Resumo de clientes faltantes
  const missingCustomerIds = new Set();
  for (const debt of missingPending) {
    const customerId = debt.customerId || debt.customer_id;
    if (!localCustomerIds.has(customerId)) {
      missingCustomerIds.add(customerId);
    }
  }
  
  if (missingCustomerIds.size > 0) {
    console.log('\n\n⚠️ CLIENTES QUE FALTAM NO ELECTRON:');
    console.log('─────────────────────────────────────────────────────');
    for (const customerId of missingCustomerIds) {
      const debts = missingPending.filter(d => (d.customerId || d.customer_id) === customerId);
      const customerName = debts[0]?.customer?.fullName || 'N/A';
      console.log(`   - ${customerName} (${customerId}) - ${debts.length} dívida(s) pendente(s)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📋 DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════');
  
  if (missingDebts.length === 0) {
    console.log('✅ Todas as dívidas do Railway estão sincronizadas no Electron!');
  } else if (missingCustomerIds.size > 0) {
    console.log('⚠️ PROBLEMA: Alguns clientes não existem localmente.');
    console.log('   A sincronização de clientes deve ocorrer ANTES da sincronização de dívidas.');
    console.log('   Sugestão: Forçar sync completo de customers no próximo ciclo.');
  } else {
    console.log('⚠️ PROBLEMA: Dívidas existem no Railway mas não foram sincronizadas.');
    console.log('   Pode ser causado por:');
    console.log('   1. Filtro updatedAfter impedindo sync de dívidas antigas');
    console.log('   2. Erro durante merge de dívidas');
    console.log('   3. Sync ainda não executado após criação das dívidas');
  }
}

main().catch(console.error);
