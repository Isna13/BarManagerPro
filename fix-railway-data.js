// Script para corrigir dados no Railway
const https = require('https');

const API_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';

let authToken = '';

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'admin@barmanager.com',
      password: 'Admin@123456'
    });

    const url = new URL(API_URL + '/auth/login');
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          authToken = result.accessToken;
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function fetchAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function postAPI(endpoint, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function putAPI(endpoint, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url = new URL(API_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('CORRECAO DE DADOS NO RAILWAY');
  console.log('='.repeat(60));
  console.log();

  // Login no Railway
  console.log('Fazendo login no Railway...');
  await login();
  console.log('Login OK\n');

  // ============ AJUSTAR ESTOQUES ============
  console.log('AJUSTANDO ESTOQUES');
  console.log('-'.repeat(40));
  
  const inventory = await fetchAPI('/inventory');
  
  // Estoques iniciais desejados (valores realistas)
  const stockTargets = {
    'Cristal mini': 100,
    'Preta 33cl': 80,
    'Sagres': 120,
    'Super Bock mini': 100,
    'XL': 50
  };

  for (const item of inventory) {
    const productName = item.product?.name;
    const currentQty = item.qtyUnits;
    const targetQty = stockTargets[productName] || 50;
    const adjustment = targetQty - currentQty;

    if (adjustment !== 0) {
      console.log(`${productName}: ${currentQty} -> ${targetQty} (ajuste: ${adjustment > 0 ? '+' : ''}${adjustment})`);
      
      // Usar endpoint de ajuste de estoque
      const result = await putAPI('/inventory/adjust', {
        inventoryItemId: item.id,
        qtyUnits: targetQty,
        reason: 'Ajuste inicial de estoque - correção de valores negativos'
      });
      
      if (result.status === 200 || result.status === 201) {
        console.log(`  ✓ Ajustado com sucesso`);
      } else {
        console.log(`  ✗ Erro: ${JSON.stringify(result.data)}`);
      }
    }
  }

  console.log('\n✓ Correções concluídas!');
  console.log('\nVerificando resultado...');
  
  const newInventory = await fetchAPI('/inventory');
  newInventory.forEach(item => {
    console.log(`  - ${item.product?.name}: ${item.qtyUnits} unidades`);
  });
}

main().catch(console.error);
