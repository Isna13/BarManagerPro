/**
 * Script para corrigir valores errados de compras no Railway PostgreSQL
 * 
 * O bug anterior multiplicava unitCost (custo por caixa) por totalUnits (unidades)
 * ao invés de multiplicar por qtyBoxes (caixas).
 * 
 * Correção: subtotal = (qty_units / units_per_box) * unit_cost
 */

const https = require('https');

const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app';

// Credenciais de admin (você pode alterar se necessário)
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

async function getProducts(token) {
  console.log('📦 Buscando produtos...');
  const res = await request('GET', '/api/v1/products?limit=1000', null, token);
  if (res.status !== 200) {
    throw new Error(`Falha ao buscar produtos: ${res.status}`);
  }
  const products = res.data.data || res.data;
  console.log(`   Encontrados ${products.length} produtos`);
  return products;
}

async function getPurchases(token) {
  console.log('🛒 Buscando compras...');
  const res = await request('GET', '/api/v1/purchases?limit=1000', null, token);
  if (res.status !== 200) {
    throw new Error(`Falha ao buscar compras: ${res.status}`);
  }
  const purchases = res.data.data || res.data;
  console.log(`   Encontradas ${purchases.length} compras`);
  return purchases;
}

async function getPurchaseDetails(token, purchaseId) {
  const res = await request('GET', `/api/v1/purchases/${purchaseId}`, null, token);
  if (res.status !== 200) {
    return null;
  }
  return res.data;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   CORREÇÃO DE VALORES DE COMPRAS NO RAILWAY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const token = await login();
    const products = await getProducts(token);
    const purchases = await getPurchases(token);
    
    // Criar mapa de produtos por ID
    const productMap = new Map();
    for (const p of products) {
      productMap.set(p.id, {
        name: p.name,
        unitsPerBox: p.unitsPerBox || p.units_per_box || 1
      });
    }
    
    console.log('\n📊 Analisando itens de compras...\n');
    
    let totalErros = 0;
    let totalCorrigido = 0;
    
    for (const purchase of purchases) {
      const details = await getPurchaseDetails(token, purchase.id);
      if (!details || !details.items || details.items.length === 0) {
        continue;
      }
      
      console.log(`\n📦 Compra ${purchase.id.substring(0, 8)}... (${new Date(purchase.createdAt).toLocaleDateString('pt-BR')})`);
      
      for (const item of details.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          console.log(`   ⚠️  Produto ${item.productId} não encontrado`);
          continue;
        }
        
        const unitsPerBox = product.unitsPerBox;
        const qtyUnits = item.qtyUnits || item.qty_units || 0;
        const qtyBoxes = item.qtyBoxes || item.qty_boxes || Math.floor(qtyUnits / unitsPerBox);
        const unitCost = item.unitCost || item.unit_cost || 0;
        const currentTotal = item.total || item.subtotal || 0;
        
        // Cálculo correto: caixas × custo por caixa
        const correctTotal = qtyBoxes * unitCost;
        
        // Se o valor atual for muito diferente do correto (mais de 10%), está errado
        const ratio = currentTotal > 0 ? correctTotal / currentTotal : 0;
        const isWrong = Math.abs(ratio - 1) > 0.1; // Tolerância de 10%
        
        if (isWrong && currentTotal > correctTotal) {
          totalErros++;
          console.log(`   ❌ ${product.name}:`);
          console.log(`      Atual: ${currentTotal.toLocaleString('pt-BR')} FCFA`);
          console.log(`      Correto: ${correctTotal.toLocaleString('pt-BR')} FCFA (${qtyBoxes} caixas × ${unitCost} FCFA)`);
          console.log(`      Erro: ${(currentTotal / correctTotal).toFixed(0)}x maior`);
        } else {
          console.log(`   ✅ ${product.name}: ${currentTotal.toLocaleString('pt-BR')} FCFA (OK)`);
        }
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   RESUMO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total de compras: ${purchases.length}`);
    console.log(`   Itens com erro: ${totalErros}`);
    
    if (totalErros > 0) {
      console.log('\n⚠️  Para corrigir os dados, você precisa executar SQL diretamente no PostgreSQL Railway.');
      console.log('\n📝 Execute este SQL no Railway PostgreSQL Console:\n');
      console.log(`
-- Corrigir purchase_items
UPDATE purchase_items pi
SET 
  subtotal = (pi.qty_units / NULLIF(p.units_per_box, 0)) * pi.unit_cost,
  total = (pi.qty_units / NULLIF(p.units_per_box, 0)) * pi.unit_cost
FROM products p
WHERE pi.product_id = p.id
  AND pi.total > ((pi.qty_units / NULLIF(p.units_per_box, 0)) * pi.unit_cost * 1.1);

-- Recalcular totais das compras
UPDATE purchases 
SET total_cost = (
  SELECT COALESCE(SUM(total), 0) 
  FROM purchase_items 
  WHERE purchase_id = purchases.id
);

-- Verificar resultado
SELECT 
  p.name as produto,
  pi.qty_units as unidades,
  pr.units_per_box as un_por_caixa,
  (pi.qty_units / pr.units_per_box) as caixas,
  pi.unit_cost as custo_caixa,
  pi.total as total_atual,
  ((pi.qty_units / pr.units_per_box) * pi.unit_cost) as total_correto
FROM purchase_items pi
JOIN products pr ON pi.product_id = pr.id
JOIN purchases p ON pi.purchase_id = p.id
ORDER BY p.created_at DESC
LIMIT 20;
`);
    } else {
      console.log('\n✅ Todos os valores parecem corretos!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
