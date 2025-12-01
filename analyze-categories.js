// Script para limpar categorias duplicadas no Railway
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

async function main() {
  console.log('='.repeat(60));
  console.log('ANALISE DE CATEGORIAS NO RAILWAY');
  console.log('='.repeat(60));
  console.log();

  // Login no Railway
  console.log('Fazendo login no Railway...');
  await login();
  console.log('Login OK\n');

  // ============ PRODUTOS COM CATEGORIAS ============
  console.log('PRODUTOS E SUAS CATEGORIAS');
  console.log('-'.repeat(40));
  
  const products = await fetchAPI('/products');
  products.forEach(prod => {
    console.log(`  - ${prod.name}: categoria=${prod.category?.name || 'sem categoria'} (id: ${prod.categoryId || 'N/A'})`);
  });

  console.log('\n');

  // ============ TODAS AS CATEGORIAS ============
  console.log('ANALISE DE CATEGORIAS');
  console.log('-'.repeat(40));
  
  const categories = await fetchAPI('/products/categories');
  
  // Agrupar por nome
  const byName = {};
  categories.forEach(cat => {
    if (!byName[cat.name]) {
      byName[cat.name] = [];
    }
    byName[cat.name].push(cat.id);
  });

  console.log('Categorias por nome:');
  Object.entries(byName).forEach(([name, ids]) => {
    console.log(`  - ${name}: ${ids.length} registro(s)`);
  });

  console.log('\nIDs unicos por categoria:');
  Object.entries(byName).forEach(([name, ids]) => {
    console.log(`  ${name}:`);
    ids.slice(0, 3).forEach(id => console.log(`    - ${id}`));
    if (ids.length > 3) console.log(`    ... e mais ${ids.length - 3}`);
  });

  // Categorias que os produtos usam
  const usedCategoryIds = new Set(products.map(p => p.categoryId).filter(Boolean));
  console.log('\nCategorias em uso pelos produtos:', usedCategoryIds.size);
  usedCategoryIds.forEach(id => {
    const cat = categories.find(c => c.id === id);
    console.log(`  - ${cat?.name || 'N/A'} (${id})`);
  });
}

main().catch(console.error);
