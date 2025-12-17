/**
 * Script para sincronizar todas as mesas do Electron Desktop para o Railway
 * Usando sql.js (SQLite em JavaScript puro - sem dependências nativas)
 * Execução: node sync-tables-to-railway-v3.js
 */

const initSqlJs = require('sql.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuração
const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

// Credenciais para autenticação
const AUTH = {
  email: 'isnatchuda1@gmail.com',
  password: 'isna123'
};

let token = null;

async function login() {
  try {
    console.log('🔐 Fazendo login no Railway...');
    const response = await axios.post(`${RAILWAY_URL}/auth/login`, AUTH);
    console.log('📋 Resposta do login:', JSON.stringify(response.data, null, 2));
    token = response.data.access_token || response.data.token || response.data.accessToken;
    console.log('🔑 Token obtido:', token ? `${token.substring(0, 20)}...` : 'NULO');
    console.log('✅ Login realizado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao fazer login:', error.response?.data?.message || error.message);
    return false;
  }
}

function getApiClient() {
  return axios.create({
    baseURL: RAILWAY_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

async function syncTables() {
  console.log('\n📋 SCRIPT DE SINCRONIZAÇÃO DE MESAS');
  console.log('=====================================\n');

  console.log(`📂 Caminho do banco: ${DB_PATH}`);
  
  // Verificar se arquivo existe
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Arquivo de banco de dados não encontrado!');
    console.log('\n💡 Certifique-se de que o Electron Desktop foi executado pelo menos uma vez.');
    process.exit(1);
  }

  // Inicializar sql.js
  const SQL = await initSqlJs();
  
  // Ler o arquivo do banco
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  console.log('✅ Banco de dados aberto com sucesso!\n');

  // Buscar todas as mesas
  const allTablesResult = db.exec('SELECT * FROM tables');
  const allTables = allTablesResult.length > 0 ? resultToObjects(allTablesResult[0]) : [];
  console.log(`📊 Total de mesas no banco local: ${allTables.length}`);

  // Buscar mesas não sincronizadas
  const unsyncedResult = db.exec('SELECT * FROM tables WHERE synced = 0');
  const unsyncedTables = unsyncedResult.length > 0 ? resultToObjects(unsyncedResult[0]) : [];
  console.log(`⏳ Mesas não sincronizadas: ${unsyncedTables.length}`);

  if (unsyncedTables.length === 0 && allTables.length > 0) {
    console.log('\n✅ Todas as mesas já estão sincronizadas!');
    
    console.log('\n📝 Mesas existentes:');
    allTables.forEach((table, i) => {
      console.log(`   ${i + 1}. Mesa ${table.number} - ${table.area || 'Sem área'} (${table.seats} lugares) - synced: ${table.synced}`);
    });
    
    db.close();
    return;
  }

  if (allTables.length === 0) {
    console.log('\n⚠️ Nenhuma mesa encontrada no banco local.');
    console.log('💡 Crie mesas no Electron Desktop primeiro.');
    db.close();
    return;
  }

  // Login no Railway
  const loggedIn = await login();
  if (!loggedIn) {
    db.close();
    process.exit(1);
  }

  const api = getApiClient();
  let syncedCount = 0;
  let errorCount = 0;

  console.log('\n🔄 Iniciando sincronização...\n');

  // Sincronizar cada mesa
  for (const table of unsyncedTables) {
    try {
      console.log(`📤 Sincronizando Mesa ${table.number}...`);
      
      const payload = {
        id: table.id,
        branchId: table.branch_id || 'branch-1',
        number: String(table.number),
        seats: table.seats || 4,
        area: table.area || null,
        isActive: table.is_active === 1
      };

      try {
        await api.get(`/tables/${table.id}`);
        console.log(`   ℹ️ Mesa ${table.number} já existe no Railway`);
      } catch (getError) {
        if (getError.response?.status === 404) {
          await api.post('/tables', payload);
          console.log(`   ✅ Mesa ${table.number} criada no Railway`);
        } else {
          throw getError;
        }
      }

      // Marcar como sincronizada
      db.run('UPDATE tables SET synced = 1 WHERE id = ?', [table.id]);
      syncedCount++;

    } catch (error) {
      errorCount++;
      console.error(`   ❌ Erro ao sincronizar Mesa ${table.number}:`, error.response?.data?.message || error.message);
    }
  }

  // Verificar sessões de mesa
  console.log('\n🔄 Verificando sessões de mesa...');
  
  const sessionsResult = db.exec(`
    SELECT ts.*, t.number as table_number 
    FROM table_sessions ts
    LEFT JOIN tables t ON ts.table_id = t.id
    WHERE ts.synced = 0 AND ts.status IN ('open', 'awaiting_payment')
  `);
  const openSessions = sessionsResult.length > 0 ? resultToObjects(sessionsResult[0]) : [];

  console.log(`📊 Sessões abertas não sincronizadas: ${openSessions.length}`);

  for (const session of openSessions) {
    try {
      console.log(`📤 Sincronizando sessão da Mesa ${session.table_number}...`);
      
      await api.post('/tables/sessions/open', {
        tableId: session.table_id,
        branchId: session.branch_id,
        openedBy: session.opened_by
      });

      db.run('UPDATE table_sessions SET synced = 1 WHERE id = ?', [session.id]);
      console.log(`   ✅ Sessão sincronizada`);
    } catch (error) {
      console.error(`   ❌ Erro:`, error.response?.data?.message || error.message);
    }
  }

  // Salvar alterações no arquivo
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  console.log('\n💾 Alterações salvas no banco de dados local.');

  // Resumo
  console.log('\n=====================================');
  console.log('📊 RESUMO DA SINCRONIZAÇÃO');
  console.log('=====================================');
  console.log(`✅ Mesas sincronizadas: ${syncedCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📋 Total de mesas: ${allTables.length}`);

  const finalResult = db.exec('SELECT COUNT(*) as count FROM tables WHERE synced = 0');
  const finalUnsynced = finalResult.length > 0 ? resultToObjects(finalResult[0])[0].count : 0;
  console.log(`⏳ Mesas pendentes: ${finalUnsynced}`);

  db.close();
  console.log('\n✅ Script finalizado!');
}

// Converter resultado do sql.js para array de objetos
function resultToObjects(result) {
  const columns = result.columns;
  const values = result.values;
  
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

syncTables().catch(console.error);
