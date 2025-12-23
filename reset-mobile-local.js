/**
 * Script para Zerar Dados Locais do App Vendas Manager Pro
 * 
 * Este script envia um comando de reset para o servidor Railway.
 * O app mobile irá detectar este comando na próxima sincronização
 * e limpar todos os dados locais automaticamente.
 * 
 * Uso: node reset-mobile-local.js
 */

const https = require('https');

// Configuração
const API_URL = 'barmanagerbackend-production.up.railway.app';
const EMAIL = 'isnatchuda1@gmail.com';
const PASSWORD = 'isna123';

console.log('═══════════════════════════════════════════════════════');
console.log('🗑️  RESET DE DADOS LOCAIS - VENDAS MANAGER PRO');
console.log('═══════════════════════════════════════════════════════');
console.log('');

// Função para fazer requisição HTTPS
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
    
    if (loginResult.status !== 200 && loginResult.status !== 201) {
      console.log('❌ Erro no login:', loginResult.data);
      return;
    }
    
    const token = loginResult.data.accessToken || loginResult.data.access_token || loginResult.data.token;
    if (!token) {
      console.log('❌ Token não recebido:', loginResult.data);
      return;
    }
    
    const user = loginResult.data.user;
    console.log('✅ Login realizado com sucesso!');
    console.log(`   Usuário: ${user?.fullName || user?.name || EMAIL}`);
    console.log(`   Role: ${user?.role}`);
    console.log('');
    
    // Verificar se é admin
    if (!['admin', 'owner'].includes(user?.role)) {
      console.log(`⚠️  AVISO: Seu usuário é "${user?.role}", não "admin" ou "owner".`);
      console.log('   O reset pode ser rejeitado pelo servidor.');
      console.log('');
    }
    console.log('');
    
    // 2. Enviar comando de reset
    console.log('📤 Enviando comando de reset para o servidor...');
    
    const resetResult = await request({
      hostname: API_URL,
      port: 443,
      path: '/api/v1/admin/reset-mobile-data',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, {
      confirmationCode: 'CONFIRMAR_RESET_MOBILE',
      deviceId: 'all', // Resetar todos os dispositivos
    });
    
    console.log('');
    
    if (resetResult.data.success) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ COMANDO DE RESET CRIADO COM SUCESSO!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('📱 O que vai acontecer agora:');
      console.log('');
      console.log('   1. Abra o app Vendas Manager Pro no celular');
      console.log('   2. Aguarde a sincronização automática (ou force manualmente)');
      console.log('   3. O app irá detectar o comando e limpar os dados locais');
      console.log('   4. Os dados serão baixados novamente do servidor');
      console.log('');
      console.log(`📋 ID do Comando: ${resetResult.data.commandId}`);
      console.log('');
    } else {
      console.log('❌ Erro ao criar comando:', resetResult.data.message);
    }
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

main();
