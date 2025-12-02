// Script para testar a API de vendas
const https = require('https');

const BASE_URL = 'barmanagerbackend-production.up.railway.app';

// Primeiro fazer login para obter token
function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'isnatchuda1@gmail.com',
      password: 'isna123'
    });

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Login response status:', res.statusCode);
        console.log('Login response:', data.substring(0, 200));
        try {
          const json = JSON.parse(data);
          resolve(json.accessToken || json.access_token);
        } catch (e) {
          reject(new Error('Failed to parse login response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Buscar vendas
function getSales(token, startDate, endDate) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: '/api/v1/sales?' + params.toString(),
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(Array.isArray(json) ? json : json.data || []);
        } catch (e) {
          reject(new Error('Failed to parse sales response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔐 Fazendo login...');
    const token = await login();
    if (!token) {
      console.error('❌ Login falhou - sem token');
      return;
    }
    console.log('✅ Token obtido:', token.substring(0, 20) + '...');

    // Datas para teste
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log('\n📊 Testando filtros de vendas...\n');

    // Sem filtro
    console.log('=== SEM FILTRO ===');
    const allSales = await getSales(token);
    console.log('Total de vendas:', allSales.length);
    if (allSales.length > 0) {
      console.log('Primeira:', allSales[0].createdAt, '-', allSales[0].customerName || 'Sem nome');
      console.log('Última:', allSales[allSales.length-1].createdAt, '-', allSales[allSales.length-1].customerName || 'Sem nome');
    }

    // Hoje
    console.log('\n=== HOJE ===');
    console.log('startDate:', todayStart.toISOString());
    console.log('endDate:', todayEnd.toISOString());
    const todaySales = await getSales(token, todayStart.toISOString(), todayEnd.toISOString());
    console.log('Vendas de hoje:', todaySales.length);
    todaySales.forEach(s => {
      console.log(`  - ${s.customerName || 'Sem nome'} | ${s.total} FCFA | ${s.status} | ${s.createdAt}`);
    });

    // Semana
    console.log('\n=== SEMANA (últimos 7 dias) ===');
    console.log('startDate:', weekStart.toISOString());
    console.log('endDate:', todayEnd.toISOString());
    const weekSales = await getSales(token, weekStart.toISOString(), todayEnd.toISOString());
    console.log('Vendas da semana:', weekSales.length);

    // Mês
    console.log('\n=== MÊS (desde dia 1) ===');
    console.log('startDate:', monthStart.toISOString());
    console.log('endDate:', todayEnd.toISOString());
    const monthSales = await getSales(token, monthStart.toISOString(), todayEnd.toISOString());
    console.log('Vendas do mês:', monthSales.length);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();
