/**
 * Script para sincronizar dívidas pendentes do Railway para o Electron
 * Usa sqlite3.exe CLI para evitar problemas de versão do Node
 * Executa: node sync-debts-to-electron.js
 */

const https = require('https');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');

// Configurações
const RAILWAY_HOST = 'barmanagerbackend-production.up.railway.app';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDJiYjhjNi1kZmUyLTQwNTgtYmI5Yi00ZTkwZDEwM2YwNGUiLCJlbWFpbCI6ImlzbmF0Y2h1ZGExQGdtYWlsLmNvbSIsInJvbGUiOiJjYXNoaWVyIiwiYnJhbmNoSWQiOm51bGwsImlhdCI6MTc2NjA5MTU3MywiZXhwIjoxNzY2Njk2MzczfQ.RK_XodIoMd5n2xQDcTIfz-u-bGVMfeyUaw5NSZVgpQo';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

// Função para fazer requisição HTTPS
function fetchFromRailway(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: RAILWAY_HOST,
      path: `/api/v1${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(Array.isArray(json) ? json : (json.data || []));
          } catch (e) {
            reject(new Error(`Erro ao parsear JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Função para escapar valores SQL
function escapeSQL(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 SINCRONIZAÇÃO DE DÍVIDAS: Railway → Electron');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📁 Banco local: ${DB_PATH}`);
  
  // Verificar se o banco existe
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Banco de dados não encontrado: ${DB_PATH}`);
    process.exit(1);
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // FASE 1: Sincronizar CLIENTES primeiro (dependência das dívidas)
    // ══════════════════════════════════════════════════════════════
    console.log('\n📥 FASE 1: Sincronizando clientes...');
    
    const railwayCustomers = await fetchFromRailway('/customers');
    console.log(`   ☁️ Railway: ${railwayCustomers.length} clientes`);

    // Obter IDs de clientes locais
    const localCustomersRaw = execSync(`sqlite3.exe "${DB_PATH}" "SELECT id FROM customers"`, { encoding: 'utf8' });
    const localCustomerIds = new Set(localCustomersRaw.trim().replace(/\r/g, '').split('\n').filter(Boolean));
    console.log(`   💾 Local: ${localCustomerIds.size} clientes`);

    // Gerar arquivo SQL para inserir clientes
    let customerInserts = [];
    let customersToCreate = 0;

    for (const customer of railwayCustomers) {
      if (!localCustomerIds.has(customer.id)) {
        const fullName = customer.name || customer.fullName || 
          (customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` : 'Sem Nome');
        
        // Usar apenas colunas que existem na tabela local:
        // id, code, full_name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points, synced, last_sync, created_at, updated_at
        customerInserts.push(`
          INSERT OR IGNORE INTO customers (
            id, code, full_name, phone, email,
            credit_limit, current_debt, is_blocked, loyalty_points,
            synced, last_sync, created_at, updated_at
          ) VALUES (
            ${escapeSQL(customer.id)},
            ${escapeSQL(customer.code)},
            ${escapeSQL(fullName)},
            ${escapeSQL(customer.phone)},
            ${escapeSQL(customer.email)},
            ${customer.creditLimit || customer.credit_limit || 0},
            ${customer.currentDebt || customer.current_debt || 0},
            ${customer.isBlocked || customer.is_blocked ? 1 : 0},
            ${customer.loyaltyPoints || customer.loyalty_points || 0},
            1,
            datetime('now'),
            ${escapeSQL(customer.createdAt || customer.created_at || new Date().toISOString())},
            ${escapeSQL(customer.updatedAt || customer.updated_at || new Date().toISOString())}
          );
        `);
        customersToCreate++;
        console.log(`   ➕ Cliente a criar: ${fullName} (${customer.code || customer.id.slice(0,8)})`);
      }
    }

    if (customerInserts.length > 0) {
      // Salvar SQL em arquivo temporário e executar
      const sqlFile = path.join(os.tmpdir(), 'sync_customers.sql');
      fs.writeFileSync(sqlFile, customerInserts.join('\n'), 'utf8');
      
      try {
        execSync(`sqlite3.exe "${DB_PATH}" ".read '${sqlFile.replace(/\\/g, '/')}'"`);
        console.log(`   ✅ ${customersToCreate} clientes criados`);
      } catch (e) {
        console.error(`   ❌ Erro ao inserir clientes: ${e.message}`);
      }
      
      fs.unlinkSync(sqlFile);
    } else {
      console.log(`   ✅ Todos os clientes já existem localmente`);
    }

    // ══════════════════════════════════════════════════════════════
    // FASE 2: Sincronizar DÍVIDAS
    // ══════════════════════════════════════════════════════════════
    console.log('\n📥 FASE 2: Sincronizando dívidas...');
    
    const railwayDebts = await fetchFromRailway('/debts');
    console.log(`   ☁️ Railway: ${railwayDebts.length} dívidas total`);
    
    const pendingDebts = railwayDebts.filter(d => d.status === 'pending' || d.status === 'partial');
    console.log(`   ☁️ Railway: ${pendingDebts.length} dívidas pendentes/parciais`);

    // Obter IDs de dívidas locais
    const localDebtsRaw = execSync(`sqlite3.exe "${DB_PATH}" "SELECT id FROM debts"`, { encoding: 'utf8' });
    const localDebtIds = new Set(localDebtsRaw.trim().replace(/\r/g, '').split('\n').filter(Boolean));
    console.log(`   💾 Local: ${localDebtIds.size} dívidas`);

    // Atualizar lista de clientes locais após inserções
    const updatedCustomersRaw = execSync(`sqlite3.exe "${DB_PATH}" "SELECT id FROM customers"`, { encoding: 'utf8' });
    const updatedCustomerIds = new Set(updatedCustomersRaw.trim().replace(/\r/g, '').split('\n').filter(Boolean));

    // Gerar SQL para inserir/atualizar dívidas
    let debtInserts = [];
    let debtUpdates = [];
    let debtsCreated = 0;
    let debtsUpdated = 0;
    let debtsSkipped = 0;

    for (const debt of railwayDebts) {
      const customerId = debt.customerId || debt.customer_id;
      
      // Verificar se cliente existe
      if (!updatedCustomerIds.has(customerId)) {
        console.warn(`   ⚠️ Dívida ${debt.id.slice(0,8)} pulada: cliente ${customerId?.slice(0,8)} não existe`);
        debtsSkipped++;
        continue;
      }

      const debtData = {
        id: debt.id,
        debt_number: debt.debtNumber || debt.debt_number || `DEBT-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
        customer_id: customerId,
        sale_id: debt.saleId || debt.sale_id || null,
        branch_id: debt.branchId || debt.branch_id || 'main-branch',
        original_amount: debt.originalAmount || debt.original_amount || 0,
        paid_amount: debt.paidAmount || debt.paid_amount || 0,
        balance: debt.balance || 0,
        status: debt.status || 'pending',
        notes: debt.notes || null,
        due_date: debt.dueDate || debt.due_date || null,
        created_by: debt.createdBy || debt.created_by || null,
        created_at: debt.createdAt || debt.created_at || new Date().toISOString(),
        updated_at: debt.updatedAt || debt.updated_at || new Date().toISOString()
      };

      if (!localDebtIds.has(debt.id)) {
        debtInserts.push(`
          INSERT INTO debts (
            id, debt_number, customer_id, sale_id, branch_id,
            original_amount, paid_amount, balance, status, notes,
            due_date, created_by, synced, created_at, updated_at
          ) VALUES (
            ${escapeSQL(debtData.id)},
            ${escapeSQL(debtData.debt_number)},
            ${escapeSQL(debtData.customer_id)},
            ${escapeSQL(debtData.sale_id)},
            ${escapeSQL(debtData.branch_id)},
            ${debtData.original_amount},
            ${debtData.paid_amount},
            ${debtData.balance},
            ${escapeSQL(debtData.status)},
            ${escapeSQL(debtData.notes)},
            ${escapeSQL(debtData.due_date)},
            ${escapeSQL(debtData.created_by)},
            1,
            ${escapeSQL(debtData.created_at)},
            ${escapeSQL(debtData.updated_at)}
          );
        `);
        debtsCreated++;
        
        // Log para dívidas pendentes
        if (debt.status === 'pending' || debt.status === 'partial') {
          const customer = railwayCustomers.find(c => c.id === customerId);
          const customerName = customer?.name || customer?.fullName || 'Desconhecido';
          console.log(`   ➕ Dívida a criar: ${customerName} - ${(debtData.balance / 100).toLocaleString()} FCFA (${debt.status})`);
        }
      } else {
        // Atualizar dívida existente
        debtUpdates.push(`
          UPDATE debts SET
            original_amount = ${debtData.original_amount},
            balance = ${debtData.balance},
            status = ${escapeSQL(debtData.status)},
            notes = ${escapeSQL(debtData.notes)},
            due_date = ${escapeSQL(debtData.due_date)},
            synced = 1,
            updated_at = ${escapeSQL(debtData.updated_at)}
          WHERE id = ${escapeSQL(debtData.id)};
        `);
        debtsUpdated++;
      }
    }

    // Executar inserções e atualizações
    if (debtInserts.length > 0 || debtUpdates.length > 0) {
      const sqlFile = path.join(os.tmpdir(), 'sync_debts.sql');
      fs.writeFileSync(sqlFile, [...debtInserts, ...debtUpdates].join('\n'), 'utf8');
      
      try {
        execSync(`sqlite3.exe "${DB_PATH}" ".read '${sqlFile.replace(/\\/g, '/')}'"`);
        console.log(`\n   ✅ ${debtsCreated} dívidas criadas`);
        console.log(`   📝 ${debtsUpdated} dívidas atualizadas`);
      } catch (e) {
        console.error(`   ❌ Erro ao inserir/atualizar dívidas: ${e.message}`);
      }
      
      fs.unlinkSync(sqlFile);
    } else {
      console.log(`\n   ✅ Todas as dívidas já estão sincronizadas`);
    }
    
    console.log(`   ⚠️ ${debtsSkipped} dívidas puladas (sem cliente)`);

    // ══════════════════════════════════════════════════════════════
    // FASE 3: Verificação final
    // ══════════════════════════════════════════════════════════════
    console.log('\n📊 FASE 3: Verificação final...');
    
    const finalStatsRaw = execSync(`sqlite3.exe -header -column "${DB_PATH}" "SELECT status, COUNT(*) as count, SUM(balance)/100 as total_fcfa FROM debts GROUP BY status"`, { encoding: 'utf8' });
    console.log('\n   📈 Resumo das dívidas no Electron:');
    console.log(finalStatsRaw.split('\n').map(l => '      ' + l).join('\n'));

    const pendingLocalRaw = execSync(`sqlite3.exe "${DB_PATH}" "SELECT c.full_name, d.balance, d.status FROM debts d JOIN customers c ON d.customer_id = c.id WHERE d.status IN ('pending', 'partial') ORDER BY d.created_at DESC LIMIT 15"`, { encoding: 'utf8' });
    
    if (pendingLocalRaw.trim()) {
      const pendingLines = pendingLocalRaw.trim().split('\n');
      console.log(`\n   🔴 ${pendingLines.length} dívidas pendentes/parciais (primeiras 15):`);
      for (const line of pendingLines) {
        const [name, balance, status] = line.split('|');
        console.log(`      - ${name}: ${(parseInt(balance) / 100).toLocaleString()} FCFA (${status})`);
      }
    }

    // Contagem final
    const totalPendingRaw = execSync(`sqlite3.exe "${DB_PATH}" "SELECT COUNT(*) FROM debts WHERE status IN ('pending', 'partial')"`, { encoding: 'utf8' });
    const totalPending = parseInt(totalPendingRaw.trim());

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log(`📊 Total de dívidas pendentes no Electron: ${totalPending}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n💡 Reinicie o Electron para ver as dívidas na aba Dívidas.\n');

  } catch (error) {
    console.error('\n❌ Erro durante sincronização:', error.message);
    if (error.message.includes('sqlite3.exe')) {
      console.log('\n💡 Certifique-se que sqlite3.exe está no PATH do sistema.');
      console.log('   Download: https://www.sqlite.org/download.html');
    }
    process.exit(1);
  }
}

main().catch(console.error);
