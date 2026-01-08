/**
 * Script para chamar o endpoint de correção de compras no Railway
 * Execute após o deploy do Railway estar completo
 */

const https = require('https');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';
const AUTH_EMAIL = 'isnatchuda1@gmail.com';
const AUTH_PASSWORD = 'isna123';

async function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAILWAY_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function login() {
  console.log('🔐 Fazendo login no Railway...');
  const res = await request('POST', '/api/v1/auth/login', {
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD
  });
  
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Falha no login: ${res.status} - ${JSON.stringify(res.data)}`);
  }
  
  console.log('✅ Login bem-sucedido!');
  return res.data.accessToken || res.data.access_token;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   EXECUTAR CORREÇÃO DE COMPRAS NO RAILWAY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const token = await login();
    
    console.log('\n🔧 Chamando endpoint de correção...');
    console.log('   POST /api/v1/purchases/fix-totals\n');
    
    const res = await request('POST', '/api/v1/purchases/fix-totals', {}, token);
    
    if (res.status !== 200 && res.status !== 201) {
      console.log(`❌ Erro: ${res.status}`);
      console.log(JSON.stringify(res.data, null, 2));
      
      if (res.status === 404) {
        console.log('\n⚠️  Endpoint não encontrado. O deploy do Railway pode ainda estar em andamento.');
        console.log('   Aguarde 1-2 minutos e tente novamente.');
      }
      return;
    }
    
    console.log('✅ Correção executada com sucesso!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   RESULTADO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Mensagem: ${res.data.message}`);
    console.log(`   Total de itens: ${res.data.totalItems}`);
    console.log(`   Itens corrigidos: ${res.data.correctedItems}`);
    
    if (res.data.corrections && res.data.corrections.length > 0) {
      console.log('\n📋 Detalhes das correções:');
      for (const c of res.data.corrections) {
        console.log(`   • ${c.productName}: ${c.before.toLocaleString('pt-BR')} → ${c.after.toLocaleString('pt-BR')} FCFA (era ${c.ratio.toFixed(0)}x maior)`);
      }
    }
    
    console.log('\n✅ Dados do Railway PostgreSQL corrigidos!');
    console.log('   Os valores corretos serão sincronizados para os PCs na próxima sincronização.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
