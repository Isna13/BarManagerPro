/**
 * Monitor Railway Backend Status
 * 
 * Este script monitora o status do backend Railway e verifica:
 * 1. Conectividade do banco de dados
 * 2. Status da API
 * 3. Quantidade de dados sincronizados
 */

const https = require('https');

const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const CHECK_INTERVAL = 10000; // 10 segundos
const MAX_CHECKS = 60; // 10 minutos no máximo

let checkCount = 0;
let wasOffline = false;

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${RAILWAY_API}${path}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function checkHealth() {
  try {
    const response = await makeRequest('/health/ping');
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function checkData() {
  try {
    const [products, debts, purchases] = await Promise.all([
      makeRequest('/products?branchId=78af65ac-1a46-43a4-aaab-04aa85bbdac6'),
      makeRequest('/debts?branchId=78af65ac-1a46-43a4-aaab-04aa85bbdac6'),
      makeRequest('/purchases?branchId=78af65ac-1a46-43a4-aaab-04aa85bbdac6'),
    ]);

    return {
      products: products.data?.length || 0,
      debts: debts.data?.length || 0,
      purchases: purchases.data?.length || 0,
    };
  } catch (error) {
    return null;
  }
}

async function monitor() {
  checkCount++;
  
  log(`Checagem #${checkCount}/${MAX_CHECKS}`, 'cyan');
  
  // Verifica saúde do backend
  const isOnline = await checkHealth();
  
  if (!isOnline) {
    wasOffline = true;
    log('❌ Railway OFFLINE - Backend não está respondendo', 'red');
    
    if (checkCount < MAX_CHECKS) {
      setTimeout(monitor, CHECK_INTERVAL);
    } else {
      log('⏱️ Tempo limite atingido. Execute novamente para continuar monitorando.', 'yellow');
    }
    return;
  }
  
  // Backend online!
  if (wasOffline) {
    log('🎉 Railway VOLTOU ONLINE!', 'green');
    wasOffline = false;
  } else {
    log('✅ Railway está ONLINE', 'green');
  }
  
  // Verifica dados sincronizados
  log('📊 Verificando dados sincronizados...', 'blue');
  const data = await checkData();
  
  if (data) {
    log(`   📦 Produtos: ${data.products}`, 'magenta');
    log(`   💰 Dívidas: ${data.debts}`, 'magenta');
    log(`   🛒 Compras: ${data.purchases}`, 'magenta');
    
    // Verifica se os dados esperados estão presentes
    const expectedProducts = 7; // Incluindo "Pé Tinto"
    const expectedDebts = 6;    // Todas as dívidas com pagamentos
    
    if (data.products >= expectedProducts && data.debts >= expectedDebts) {
      log('', 'reset');
      log('✨ SINCRONIZAÇÃO COMPLETA DETECTADA! ✨', 'green');
      log('', 'reset');
      log('📋 Resumo:', 'cyan');
      log(`   ✅ ${data.products} produtos sincronizados (esperado: ${expectedProducts}+)`, 'green');
      log(`   ✅ ${data.debts} dívidas sincronizadas (esperado: ${expectedDebts}+)`, 'green');
      log(`   ✅ ${data.purchases} compras sincronizadas`, 'green');
      log('', 'reset');
      log('🎯 Próximo passo: Teste o app mobile!', 'yellow');
      log('   1. Abra o app Flutter no celular', 'yellow');
      log('   2. Puxe para atualizar (pull to refresh)', 'yellow');
      log('   3. Verifique se todos os dados aparecem corretamente', 'yellow');
      
      // Finaliza o monitoramento
      return;
    } else {
      log('', 'reset');
      log('⏳ Sincronização ainda em progresso...', 'yellow');
      log(`   Produtos: ${data.products}/${expectedProducts} (faltam ${expectedProducts - data.products})`, 'yellow');
      log(`   Dívidas: ${data.debts}/${expectedDebts} (faltam ${expectedDebts - data.debts})`, 'yellow');
    }
  } else {
    log('⚠️ Não foi possível verificar os dados', 'yellow');
  }
  
  // Continua monitorando
  if (checkCount < MAX_CHECKS) {
    log('', 'reset');
    log(`⏰ Próxima checagem em ${CHECK_INTERVAL / 1000} segundos...`, 'blue');
    setTimeout(monitor, CHECK_INTERVAL);
  } else {
    log('⏱️ Tempo limite atingido. Execute novamente para continuar monitorando.', 'yellow');
  }
}

// Início do script
console.clear();
log('', 'reset');
log('═══════════════════════════════════════════════════════════', 'cyan');
log('    🔍 MONITOR DE STATUS DO RAILWAY BACKEND', 'cyan');
log('═══════════════════════════════════════════════════════════', 'cyan');
log('', 'reset');
log(`API Base: ${RAILWAY_API}`, 'blue');
log(`Intervalo: ${CHECK_INTERVAL / 1000}s`, 'blue');
log(`Máximo de checagens: ${MAX_CHECKS} (${(MAX_CHECKS * CHECK_INTERVAL) / 60000} minutos)`, 'blue');
log('', 'reset');
log('Pressione Ctrl+C para parar o monitoramento', 'yellow');
log('', 'reset');

// Inicia o monitoramento
monitor();

// Handler para Ctrl+C
process.on('SIGINT', () => {
  log('', 'reset');
  log('⛔ Monitoramento interrompido pelo usuário', 'yellow');
  log(`📊 Total de checagens realizadas: ${checkCount}`, 'cyan');
  process.exit(0);
});
