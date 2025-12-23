/**
 * Script para TESTAR endpoints do servidor
 * Verifica se as entidades problemáticas estão retornando dados
 */

const https = require('https');

const API_URL = 'barmanagerbackend-production.up.railway.app';
const EMAIL = 'isnatchuda1@gmail.com';
const PASSWORD = 'isna123';

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 TESTE DE ENDPOINTS DO SERVIDOR');
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
    
    // 2. Testar endpoints problemáticos
    const endpoints = [
      { name: 'Fornecedores', path: '/api/v1/suppliers' },
      { name: 'Compras', path: '/api/v1/purchases?limit=500' },
      { name: 'Caixas', path: '/api/v1/cash-box?limit=500' },
      { name: 'Caixa Atual', path: '/api/v1/cash-box/current' },
      { name: 'Produtos', path: '/api/v1/products' },
      { name: 'Categorias', path: '/api/v1/categories' },
    ];
    
    console.log('📋 TESTANDO ENDPOINTS:');
    console.log('');
    
    for (const endpoint of endpoints) {
      try {
        const result = await request({
          hostname: API_URL,
          port: 443,
          path: endpoint.path,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const items = Array.isArray(result.data) ? result.data : result.data?.data || [];
        const count = Array.isArray(items) ? items.length : (result.data?.id ? 1 : 0);
        
        if (result.status === 200) {
          console.log(`✅ ${endpoint.name}: ${count} itens`);
          
          // Mostrar primeiro item como amostra
          if (count > 0 && Array.isArray(items)) {
            const sample = items[0];
            console.log(`   Amostra: id=${sample.id}, name=${sample.name || sample.boxNumber || sample.purchaseNumber || 'N/A'}`);
          } else if (result.data?.id) {
            console.log(`   Amostra: id=${result.data.id}, status=${result.data.status}`);
          }
        } else if (result.status === 404) {
          console.log(`⚠️ ${endpoint.name}: endpoint não encontrado (404)`);
        } else if (result.status === 403) {
          console.log(`⚠️ ${endpoint.name}: sem permissão (403)`);
        } else {
          console.log(`❌ ${endpoint.name}: erro ${result.status}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Se todos endpoints retornam dados, o problema está no');
    console.log('MERGE LOCAL (salvando no SQLite) do app Electron.');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

main();
