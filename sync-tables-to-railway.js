/**
 * Script para sincronizar todas as mesas do Electron Desktop para o Railway
 * Execução: node sync-tables-to-railway.js
 */

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');
const os = require('os');

// Configuração
const RAILWAY_URL = 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'bar-manager-pro', 'barmanager.db');

// Credenciais para autenticação (ajuste conforme necessário)
const AUTH = {
  email: 'admin@barmanager.com',
  password: 'admin123'
};

let token = null;

async function login() {
  try {
    console.log('🔐 Fazendo login no Railway...');
    const response = await axios.post(`${RAILWAY_URL}/auth/login`, AUTH);
    token = response.data.access_token || response.data.token;
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

  // Verificar se o banco existe
  console.log(`📂 Caminho do banco: ${DB_PATH}`);
  
  let db;
  try {
    db = new Database(DB_PATH, { readonly: false });
    console.log('✅ Banco de dados aberto com sucesso!\n');
  } catch (error) {
    console.error('❌ Erro ao abrir banco de dados:', error.message);
    console.log('\n💡 Certifique-se de que o Electron Desktop foi executado pelo menos uma vez.');
    process.exit(1);
  }

  // Buscar todas as mesas
  const allTables = db.prepare('SELECT * FROM tables').all();
  console.log(`📊 Total de mesas no banco local: ${allTables.length}`);

  // Buscar mesas não sincronizadas
  const unsyncedTables = db.prepare('SELECT * FROM tables WHERE synced = 0').all();
  console.log(`⏳ Mesas não sincronizadas: ${unsyncedTables.length}`);

  if (unsyncedTables.length === 0 && allTables.length > 0) {
    console.log('\n✅ Todas as mesas já estão sincronizadas!');
    
    // Perguntar se quer forçar re-sync
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
      
      // Tentar criar mesa no Railway
      const payload = {
        id: table.id,
        branchId: table.branch_id || 'branch-1',
        number: table.number,
        seats: table.seats || 4,
        area: table.area || null,
        isActive: table.is_active === 1
      };

      try {
        // Primeiro, verificar se já existe
        await api.get(`/tables/${table.id}`);
        console.log(`   ℹ️ Mesa ${table.number} já existe no Railway`);
      } catch (getError) {
        if (getError.response?.status === 404) {
          // Mesa não existe, criar
          await api.post('/tables', payload);
          console.log(`   ✅ Mesa ${table.number} criada no Railway`);
        } else {
          throw getError;
        }
      }

      // Marcar como sincronizada no banco local
      db.prepare('UPDATE tables SET synced = 1 WHERE id = ?').run(table.id);
      syncedCount++;

    } catch (error) {
      errorCount++;
      console.error(`   ❌ Erro ao sincronizar Mesa ${table.number}:`, error.response?.data?.message || error.message);
    }
  }

  // Também sincronizar sessões de mesa abertas
  console.log('\n🔄 Verificando sessões de mesa...');
  
  const openSessions = db.prepare(`
    SELECT ts.*, t.number as table_number 
    FROM table_sessions ts
    LEFT JOIN tables t ON ts.table_id = t.id
    WHERE ts.synced = 0 AND ts.status IN ('open', 'awaiting_payment')
  `).all();

  console.log(`📊 Sessões abertas não sincronizadas: ${openSessions.length}`);

  for (const session of openSessions) {
    try {
      console.log(`📤 Sincronizando sessão da Mesa ${session.table_number}...`);
      
      await api.post('/tables/sessions/open', {
        tableId: session.table_id,
        branchId: session.branch_id,
        openedBy: session.opened_by
      });

      db.prepare('UPDATE table_sessions SET synced = 1 WHERE id = ?').run(session.id);
      console.log(`   ✅ Sessão sincronizada`);
    } catch (error) {
      console.error(`   ❌ Erro:`, error.response?.data?.message || error.message);
    }
  }

  // Resumo
  console.log('\n=====================================');
  console.log('📊 RESUMO DA SINCRONIZAÇÃO');
  console.log('=====================================');
  console.log(`✅ Mesas sincronizadas: ${syncedCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`📋 Total de mesas: ${allTables.length}`);

  // Verificar estado final
  const finalUnsynced = db.prepare('SELECT COUNT(*) as count FROM tables WHERE synced = 0').get();
  console.log(`⏳ Mesas pendentes: ${finalUnsynced.count}`);

  db.close();
  console.log('\n✅ Script finalizado!');
}

// Executar
syncTables().catch(console.error);
