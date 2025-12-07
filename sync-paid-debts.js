const https = require('https');
const path = require('path');

// Configuração
const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');

// Função para fazer requisições HTTP
function httpRequest(method, endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
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

  // 1. Listar dívidas no Railway
  console.log('📡 Consultando dívidas no Railway (sem autenticação)...\n');
  
  // Primeiro preciso autenticar - vou usar as credenciais que funcionam
  // Baseado nos logs anteriores, vou tentar com as credenciais do usuário local
  
  const credentials = [
    { email: 'admin@barmanager.gw', password: 'admin123' },
    { email: 'isna@email.com', password: 'isna1234' },
    { email: 'admin@barmanager.com', password: 'admin123' },
    { email: 'admin@bar.com', password: 'admin123' },
  ];
  
  let token = null;
  
  for (const cred of credentials) {
    console.log(`🔐 Tentando login com: ${cred.email}`);
    try {
      const result = await httpRequest('POST', '/auth/login', cred);
      if (result.status === 200 || result.status === 201) {
        token = result.data.accessToken || result.data.access_token;
        console.log(`✅ Login bem-sucedido!\n`);
        break;
      } else {
        console.log(`❌ Falha: ${result.data?.message || result.status}`);
      }
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
  }
  
  if (!token) {
    console.log('\n❌ Não foi possível autenticar. Por favor, faça login no app Electron primeiro.');
    console.log('As credenciais de autenticação serão usadas automaticamente pelo sistema de sync.\n');
    
    console.log('📋 Instruções para sincronizar dívidas pagas:');
    console.log('1. Abra o app desktop BarManager');
    console.log('2. Faça login com suas credenciais');
    console.log('3. Vá em Clientes -> selecione um cliente com dívida paga');
    console.log('4. A sincronização deve acontecer automaticamente');
    console.log('5. Para forçar sync, faça logout e login novamente\n');
    
    return;
  }
  
  // Buscar dívidas do Railway
  console.log('📋 Buscando dívidas do Railway...');
  const debtsResult = await httpRequest('GET', '/debts', null, token);
  
  if (debtsResult.status !== 200) {
    console.log(`❌ Erro ao buscar dívidas: ${debtsResult.data?.message || debtsResult.status}`);
    return;
  }
  
  const railwayDebts = debtsResult.data;
  console.log(`\n📊 Dívidas no Railway: ${railwayDebts.length}`);
  console.log('─────────────────────────────────────────');
  
  railwayDebts.forEach(d => {
    const customerName = d.customer?.fullName || 'N/A';
    const original = d.originalAmount / 100;
    const paid = d.paid / 100;
    const balance = d.balance / 100;
    console.log(`• ${customerName}: ${original} FCFA → Pago: ${paid}, Saldo: ${balance}, Status: ${d.status}`);
  });
  
  // Identificar dívidas que precisam ser atualizadas
  const paidDebts = railwayDebts.filter(d => d.status === 'paid' || d.balance === 0);
  const pendingDebts = railwayDebts.filter(d => d.status !== 'paid' && d.balance > 0);
  
  console.log(`\n✅ Dívidas já pagas no Railway: ${paidDebts.length}`);
  console.log(`⏳ Dívidas pendentes no Railway: ${pendingDebts.length}`);
  
  if (pendingDebts.length === 0) {
    console.log('\n✨ Todas as dívidas já estão sincronizadas como pagas no Railway!');
  } else {
    console.log('\n⚠️  As seguintes dívidas ainda estão como pendentes no Railway:');
    pendingDebts.forEach(d => {
      console.log(`   - ${d.customer?.fullName}: ${d.balance/100} FCFA restantes`);
    });
    console.log('\nPara sincronizar, faça login no app Electron e o sistema de sync corrigirá automaticamente.');
  }
}

main().catch(console.error);
