/**
 * Script para VERIFICAR comandos pendentes de reset no servidor
 */

const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const EMAIL = 'isnatchuda1@gmail.com';
const PASSWORD = 'isna123';

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 VERIFICAR COMANDOS PENDENTES');
console.log('═══════════════════════════════════════════════════════');
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
    
    console.log('✅ Login OK');
    console.log('');
    
    // 2. Buscar comandos pendentes
    console.log('📋 Buscando comandos pendentes...');
    
    const pendingResult = await request({
      hostname: API_URL,
      port: 443,
      path: '/api/v1/admin/pending-commands?deviceId=all',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('');
    console.log('Status:', pendingResult.status);
    console.log('Resposta:', JSON.stringify(pendingResult.data, null, 2));
    console.log('');
    
    if (pendingResult.data.commands && pendingResult.data.commands.length > 0) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ Há comandos pendentes!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('O app mobile deveria detectar esses comandos ao sincronizar.');
      console.log('Se não está detectando, pode haver um problema no app.');
    } else {
      console.log('═══════════════════════════════════════════════════════');
      console.log('⚠️ Nenhum comando pendente encontrado');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('O comando pode já ter sido executado ou expirado (24h).');
      console.log('');
      console.log('Deseja criar um novo comando? Execute:');
      console.log('  node reset-mobile-local.js');
    }
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

main();
