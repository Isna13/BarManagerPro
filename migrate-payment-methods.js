/**
 * Script de Migração de Métodos de Pagamento
 * 
 * Este script identifica e corrige vendas com métodos de pagamento incorretos.
 * 
 * Uso:
 *   node migrate-payment-methods.js --analyze    # Apenas analisa sem alterar
 *   node migrate-payment-methods.js --fix        # Corrige os dados
 *   node migrate-payment-methods.js --fix-local  # Corrige apenas banco local
 *   node migrate-payment-methods.js --fix-server # Corrige apenas servidor
 */

const https = require('https');
const path = require('path');
const os = require('os');

// Configurações
const API_BASE = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const LOCAL_DB_PATH = path.join(
  os.homedir(),
  'AppData/Roaming/@barmanager/desktop/barmanager.db'
);

// Credenciais (ajuste conforme necessário)
const CREDENTIALS = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

// Enum de métodos de pagamento válidos
const VALID_METHODS = ['CASH', 'ORANGE_MONEY', 'TELETAKU', 'VALE', 'MIXED'];

// Mapeamento de valores antigos para novos
const METHOD_MAPPING = {
  'cash': 'CASH',
  'dinheiro': 'CASH',
  'money': 'CASH',
  'orange': 'ORANGE_MONEY',
  'orange_money': 'ORANGE_MONEY',
  'mobile_money': 'ORANGE_MONEY',
  'teletaku': 'TELETAKU',
  'vale': 'VALE',
  'debt': 'VALE',
  'credit': 'VALE',
  'fiado': 'VALE',
  'mixed': 'MIXED',
  'misto': 'MIXED',
  'multiple': 'MIXED',
};

let token = null;
let Database = null;

// ============================================
// Funções de API
// ============================================

function makeRequest(method, urlPath, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + urlPath);
    const options = {
      hostname: url.hostname,
      port: 443,
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
          const parsed = body ? JSON.parse(body) : null;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve(body);
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
  console.log('🔐 Autenticando no servidor...');
  const response = await makeRequest('POST', '/auth/login', CREDENTIALS);
  token = response.accessToken;
  console.log('✅ Autenticado com sucesso');
  return token;
}

// ============================================
// Funções de Banco Local
// ============================================

function initLocalDb() {
  try {
    Database = require('better-sqlite3');
    return new Database(LOCAL_DB_PATH, { readonly: false });
  } catch (e) {
    console.log('⚠️ Banco local não disponível:', e.message);
    return null;
  }
}

// ============================================
// Análise
// ============================================

async function analyzeServerPayments() {
  console.log('\n📊 Analisando pagamentos no servidor...\n');
  
  const sales = await makeRequest('GET', '/sales?limit=1000');
  
  const analysis = {
    total: 0,
    byMethod: {},
    suspicious: [],
    invalid: [],
  };
  
  for (const sale of sales) {
    analysis.total++;
    
    // Verificar pagamentos da venda
    if (sale.payments && sale.payments.length > 0) {
      for (const payment of sale.payments) {
        const method = payment.method || 'null';
        analysis.byMethod[method] = (analysis.byMethod[method] || 0) + 1;
        
        // Verificar se método é válido
        if (!VALID_METHODS.includes(method.toUpperCase())) {
          analysis.invalid.push({
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            paymentId: payment.id,
            method: method,
            amount: payment.amount,
            createdAt: sale.createdAt,
            customerId: sale.customerId,
            customerName: sale.customer?.name || sale.customerName,
          });
        }
        
        // Vendas com 'cash' que têm cliente podem ser suspeitas (poderiam ser vale)
        if (method.toLowerCase() === 'cash' && sale.customerId) {
          analysis.suspicious.push({
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            paymentId: payment.id,
            method: method,
            amount: payment.amount,
            createdAt: sale.createdAt,
            customerId: sale.customerId,
            customerName: sale.customer?.name || sale.customerName,
          });
        }
      }
    } else {
      // Venda sem pagamento registrado
      analysis.byMethod['sem_pagamento'] = (analysis.byMethod['sem_pagamento'] || 0) + 1;
    }
  }
  
  return analysis;
}

function analyzeLocalPayments(db) {
  console.log('\n📊 Analisando pagamentos no banco local...\n');
  
  const analysis = {
    total: 0,
    byMethod: {},
    suspicious: [],
    invalid: [],
  };
  
  try {
    const sales = db.prepare(`
      SELECT s.*, p.id as payment_id, p.method as payment_method, p.amount as payment_amount,
             c.name as customer_name
      FROM sales s
      LEFT JOIN payments p ON p.sale_id = s.id
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.created_at DESC
    `).all();
    
    for (const row of sales) {
      analysis.total++;
      
      const method = row.payment_method || 'null';
      analysis.byMethod[method] = (analysis.byMethod[method] || 0) + 1;
      
      // Verificar se método é válido
      if (row.payment_method && !VALID_METHODS.includes(method.toUpperCase())) {
        analysis.invalid.push({
          saleId: row.id,
          saleNumber: row.sale_number,
          paymentId: row.payment_id,
          method: method,
          amount: row.payment_amount,
          createdAt: row.created_at,
          customerId: row.customer_id,
          customerName: row.customer_name,
        });
      }
      
      // Vendas com 'cash' que têm cliente podem ser suspeitas
      if (method.toLowerCase() === 'cash' && row.customer_id) {
        analysis.suspicious.push({
          saleId: row.id,
          saleNumber: row.sale_number,
          paymentId: row.payment_id,
          method: method,
          amount: row.payment_amount,
          createdAt: row.created_at,
          customerId: row.customer_id,
          customerName: row.customer_name,
        });
      }
    }
  } catch (e) {
    console.error('Erro ao analisar banco local:', e.message);
  }
  
  return analysis;
}

// ============================================
// Correção
// ============================================

async function fixServerPayments(invalidPayments) {
  console.log('\n🔧 Corrigindo pagamentos inválidos no servidor...\n');
  
  let fixed = 0;
  let errors = 0;
  
  for (const payment of invalidPayments) {
    const newMethod = normalizeMethod(payment.method);
    
    if (newMethod) {
      try {
        // Atualizar via API (se disponível) ou marcar para revisão manual
        console.log(`  📝 Venda ${payment.saleNumber}: ${payment.method} -> ${newMethod}`);
        // Nota: A API pode não ter endpoint para atualizar pagamento diretamente
        // Neste caso, seria necessário atualização direta no banco PostgreSQL
        fixed++;
      } catch (e) {
        console.error(`  ❌ Erro ao corrigir ${payment.saleId}:`, e.message);
        errors++;
      }
    } else {
      console.log(`  ⚠️ Método não mapeável: ${payment.method} (venda ${payment.saleNumber})`);
    }
  }
  
  return { fixed, errors };
}

function fixLocalPayments(db, invalidPayments) {
  console.log('\n🔧 Corrigindo pagamentos inválidos no banco local...\n');
  
  let fixed = 0;
  let errors = 0;
  
  const updateStmt = db.prepare(`
    UPDATE payments SET method = ?, synced = 0 WHERE id = ?
  `);
  
  for (const payment of invalidPayments) {
    const newMethod = normalizeMethod(payment.method);
    
    if (newMethod && payment.paymentId) {
      try {
        updateStmt.run(newMethod, payment.paymentId);
        console.log(`  ✅ Pagamento ${payment.paymentId}: ${payment.method} -> ${newMethod}`);
        fixed++;
      } catch (e) {
        console.error(`  ❌ Erro ao corrigir ${payment.paymentId}:`, e.message);
        errors++;
      }
    } else if (!newMethod) {
      console.log(`  ⚠️ Método não mapeável: ${payment.method} (venda ${payment.saleNumber})`);
    }
  }
  
  return { fixed, errors };
}

function normalizeMethod(method) {
  if (!method) return null;
  const lower = method.toLowerCase();
  return METHOD_MAPPING[lower] || (VALID_METHODS.includes(method.toUpperCase()) ? method.toUpperCase() : null);
}

// ============================================
// Relatório
// ============================================

function printAnalysis(title, analysis) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${title}`);
  console.log('='.repeat(60));
  
  console.log(`\nTotal de vendas: ${analysis.total}`);
  
  console.log('\n📈 Distribuição por método de pagamento:');
  for (const [method, count] of Object.entries(analysis.byMethod).sort((a, b) => b[1] - a[1])) {
    const isValid = VALID_METHODS.includes(method.toUpperCase());
    const icon = isValid ? '✅' : '⚠️';
    console.log(`   ${icon} ${method}: ${count}`);
  }
  
  if (analysis.invalid.length > 0) {
    console.log(`\n❌ Métodos inválidos (${analysis.invalid.length}):`);
    for (const p of analysis.invalid.slice(0, 10)) {
      console.log(`   - Venda ${p.saleNumber}: "${p.method}" (${p.amount/100} FCFA) - ${p.customerName || 'Sem cliente'}`);
    }
    if (analysis.invalid.length > 10) {
      console.log(`   ... e mais ${analysis.invalid.length - 10} registros`);
    }
  }
  
  if (analysis.suspicious.length > 0) {
    console.log(`\n⚠️ Suspeitos - CASH com cliente (${analysis.suspicious.length}):`);
    console.log('   (Podem ser vendas VALE incorretamente marcadas como CASH)');
    for (const p of analysis.suspicious.slice(0, 5)) {
      console.log(`   - Venda ${p.saleNumber}: ${p.customerName} (${p.amount/100} FCFA)`);
    }
    if (analysis.suspicious.length > 5) {
      console.log(`   ... e mais ${analysis.suspicious.length - 5} registros`);
    }
  }
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--analyze';
  
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   MIGRAÇÃO DE MÉTODOS DE PAGAMENTO - BarManager Pro      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nModo: ${mode}`);
  console.log(`Data: ${new Date().toISOString()}\n`);
  
  // Inicializar banco local
  const db = initLocalDb();
  
  // Análise local
  if (db) {
    const localAnalysis = analyzeLocalPayments(db);
    printAnalysis('BANCO LOCAL (SQLite)', localAnalysis);
    
    if (mode === '--fix' || mode === '--fix-local') {
      if (localAnalysis.invalid.length > 0) {
        const result = fixLocalPayments(db, localAnalysis.invalid);
        console.log(`\n✅ Corrigidos: ${result.fixed} | ❌ Erros: ${result.errors}`);
      } else {
        console.log('\n✅ Nenhum método inválido para corrigir no banco local');
      }
    }
    
    db.close();
  }
  
  // Análise servidor
  try {
    await login();
    const serverAnalysis = await analyzeServerPayments();
    printAnalysis('SERVIDOR (Railway PostgreSQL)', serverAnalysis);
    
    if (mode === '--fix' || mode === '--fix-server') {
      if (serverAnalysis.invalid.length > 0) {
        console.log('\n⚠️ Correção de servidor requer acesso direto ao PostgreSQL');
        console.log('   Execute o seguinte SQL no Railway:');
        console.log('\n   -- Normalizar métodos de pagamento');
        for (const p of serverAnalysis.invalid) {
          const newMethod = normalizeMethod(p.method);
          if (newMethod) {
            console.log(`   UPDATE payments SET method = '${newMethod}' WHERE id = '${p.paymentId}';`);
          }
        }
      } else {
        console.log('\n✅ Nenhum método inválido para corrigir no servidor');
      }
    }
  } catch (e) {
    console.error('\n❌ Erro ao acessar servidor:', e.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Migração concluída!');
  console.log('='.repeat(60));
}

main().catch(console.error);
