/**
 * Script DIRETO para limpar os dados locais do App
 * 
 * Este script NÃO depende do app mobile detectar comandos.
 * Ele limpa os dados no SERVIDOR, e quando o app sincronizar,
 * baixará um banco "limpo".
 * 
 * ⚠️ ATENÇÃO: Isso vai zerar os dados do SERVIDOR também!
 * 
 * Uso: node reset-server-data.js
 */

const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const EMAIL = 'isnatchuda1@gmail.com';
const PASSWORD = 'isna123';

console.log('═══════════════════════════════════════════════════════');
console.log('🗑️  RESET DE DADOS DO SERVIDOR');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('⚠️  ATENÇÃO: Este script vai zerar os dados do SERVIDOR!');
console.log('   (vendas, caixas, estoque, etc.)');
console.log('');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch {
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

async function main() {
  try {
    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    
    const loginResult = await request({
      hostname: API_URL,
      port: 443,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, {
      email: EMAIL,
      password: PASSWORD,
    });
    
    const token = loginResult.data.accessToken || loginResult.data.access_token;
    if (!token) {
      console.log('❌ Token não recebido');
      return;
    }
    
    const user = loginResult.data.user;
    console.log('✅ Login OK');
    console.log(`   Usuário: ${user?.fullName}`);
    console.log(`   Role: ${user?.role}`);
    console.log('');
    
    // 2. Ver contagem de dados
    console.log('📊 Verificando quantidade de dados...');
    
    const countsResult = await request({
      hostname: API_URL,
      port: 443,
      path: '/api/v1/admin/data-counts',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (countsResult.data.error === -1) {
      console.log('❌ Apenas admins podem executar esta operação');
      console.log('   Seu usuário é: ' + user?.role);
      return;
    }
    
    console.log('Dados no servidor:');
    for (const [table, count] of Object.entries(countsResult.data)) {
      if (count > 0) {
        console.log(`   ${table}: ${count}`);
      }
    }
    console.log('');
    
    // 3. Resetar dados do servidor
    console.log('🗑️ Enviando comando de reset...');
    
    const resetResult = await request({
      hostname: API_URL,
      port: 443,
      path: '/api/v1/admin/reset-server-data',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, {
      confirmationCode: 'CONFIRMAR_RESET_DADOS',
    });
    
    console.log('');
    console.log('Resultado:', JSON.stringify(resetResult.data, null, 2));
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

main();
