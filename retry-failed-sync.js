// Script para reprocessar itens de sync falhos
const https = require('https');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

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
        'Content-Length': Buffer.byteLength(data)
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
          reject(new Error(`Login failed: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function apiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + endpoint);
    const bodyData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    };

    if (bodyData) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('REPROCESSAR ITENS DE SYNC FALHOS');
  console.log('='.repeat(60));
  console.log();

  // Login
  console.log('🔐 Fazendo login...');
  await login();
  console.log('✅ Login OK\n');

  // Ler banco local
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.APPDATA, '@barmanager', 'desktop', 'barmanager.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Buscar itens falhos
  const failed = db.exec("SELECT id, entity, operation, entity_id, data FROM sync_queue WHERE status = 'failed' ORDER BY created_at ASC");
  
  if (failed.length === 0) {
    console.log('✅ Nenhum item falho encontrado!');
    db.close();
    return;
  }

  console.log(`🔴 ${failed[0].values.length} itens falhos encontrados\n`);

  for (const [queueId, entity, operation, entityId, dataStr] of failed[0].values) {
    console.log(`\n--- Processando: ${entity} ${operation} ---`);
    const data = JSON.parse(dataStr);
    
    try {
      switch (entity) {
        case 'sale':
          // Verificar se venda já existe
          try {
            const existing = await apiRequest('GET', `/sales/${entityId}`);
            console.log('  ⚠️ Venda já existe:', existing.saleNumber);
          } catch (e) {
            // Não existe, criar
            console.log('  📝 Criando venda...');
            const saleData = {
              id: entityId,
              branchId: data.branchId || 'main-branch',
              type: data.type || 'counter',
              customerId: data.customerId,
              tableId: data.tableId
            };
            const result = await apiRequest('POST', '/sales', saleData);
            console.log('  ✅ Venda criada:', result.saleNumber || result.id);
          }
          break;

        case 'sale_item':
          // Adicionar item à venda
          console.log('  📝 Adicionando item à venda', data.saleId);
          const itemData = {
            productId: data.productId,
            qtyUnits: data.qtyUnits || data.qty_units || 1,
            isMuntu: data.isMuntu || false,
            notes: data.notes
          };
          const itemResult = await apiRequest('POST', `/sales/${data.saleId}/items`, itemData);
          console.log('  ✅ Item adicionado');
          break;

        case 'payment':
          // Adicionar pagamento à venda
          console.log('  📝 Adicionando pagamento à venda', data.saleId);
          const paymentData = {
            method: data.method || 'cash',
            amount: data.amount,
            provider: data.provider,
            referenceNumber: data.referenceNumber || data.reference_number,
            transactionId: data.transactionId || data.transaction_id
          };
          await apiRequest('POST', `/sales/${data.saleId}/payments`, paymentData);
          console.log('  ✅ Pagamento registrado');
          break;

        case 'debt':
          // Pagar dívida (update vira pagamento)
          console.log('  📝 Processando pagamento de dívida', data.debtId || entityId);
          const debtPayment = {
            amount: data.amount,
            method: data.method || 'cash',
            reference: data.reference,
            notes: data.notes
          };
          await apiRequest('POST', `/debts/${data.debtId || entityId}/pay`, debtPayment);
          console.log('  ✅ Dívida paga');
          break;

        case 'debt_payment':
          // Pagamento de dívida
          console.log('  📝 Registrando pagamento de dívida', data.debtId);
          await apiRequest('POST', `/debts/${data.debtId}/pay`, {
            amount: data.amount,
            method: data.method || 'cash',
            reference: data.reference,
            notes: data.notes
          });
          console.log('  ✅ Pagamento de dívida registrado');
          break;

        default:
          console.log(`  ⏭️ Entidade ${entity} ignorada (não suportada por este script)`);
      }
    } catch (error) {
      console.error(`  ❌ Erro:`, error.message);
    }
  }

  db.close();
  console.log('\n✅ Processamento concluído!');
}

main().catch(console.error);
