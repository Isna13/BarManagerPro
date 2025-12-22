/**
 * Script de Sincronização de Usuários Antigos
 * 
 * Este script identifica usuários locais que não estão sincronizados
 * com o servidor Railway e tenta sincronizá-los.
 * 
 * IMPORTANTE: Para usuários antigos sem senha armazenada, será necessário
 * definir uma nova senha ou vincular manualmente pelo Railway.
 * 
 * Uso: node sync-users.js [--dry-run] [--reset-password DEFAULT_PASSWORD]
 */

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');

// Configurações
const API_URL = process.env.API_URL || 'https://barmanagerbackend-production.up.railway.app/api/v1';
const DB_PATH = path.join(os.homedir(), 'BarManagerPro', 'barmanager.db');

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET_PASSWORD_INDEX = args.indexOf('--reset-password');
const DEFAULT_PASSWORD = RESET_PASSWORD_INDEX !== -1 ? args[RESET_PASSWORD_INDEX + 1] : null;

console.log('═══════════════════════════════════════════════════════════════');
console.log('           SCRIPT DE SINCRONIZAÇÃO DE USUÁRIOS');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`📁 Banco de dados: ${DB_PATH}`);
console.log(`🌐 API URL: ${API_URL}`);
console.log(`🔄 Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'PRODUÇÃO'}`);
if (DEFAULT_PASSWORD) {
  console.log(`🔑 Senha padrão: ${DEFAULT_PASSWORD.substring(0, 3)}...`);
}
console.log('═══════════════════════════════════════════════════════════════\n');

// Abrir banco de dados
let db;
try {
  db = new Database(DB_PATH, { readonly: DRY_RUN });
  console.log('✅ Banco de dados aberto com sucesso\n');
} catch (error) {
  console.error('❌ Erro ao abrir banco de dados:', error.message);
  console.log('\n💡 Certifique-se de que o app Electron foi executado pelo menos uma vez.');
  process.exit(1);
}

// Função para fazer requisições à API
async function apiRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status 
    };
  }
}

// Função para fazer login e obter token
async function getAuthToken() {
  // Tentar login com admin padrão
  const loginAttempts = [
    { email: 'admin@barmanager.com', password: 'Admin@123' },
    { email: 'admin@admin.com', password: 'Admin@123' },
  ];
  
  for (const attempt of loginAttempts) {
    const result = await apiRequest('post', '/auth/login', attempt);
    if (result.success && result.data.access_token) {
      console.log(`✅ Autenticado como: ${attempt.email}`);
      return result.data.access_token;
    }
  }
  
  console.warn('⚠️ Não foi possível autenticar com credenciais padrão');
  console.log('   Continuando sem autenticação (algumas operações podem falhar)\n');
  return null;
}

// Função para verificar se usuário existe no Railway
async function checkUserExistsOnServer(email, token) {
  const result = await apiRequest('get', `/users?email=${encodeURIComponent(email)}`, null, token);
  
  if (result.success && Array.isArray(result.data)) {
    const user = result.data.find(u => u.email === email);
    return user ? { exists: true, serverId: user.id } : { exists: false };
  }
  
  // Se a API retorna 404 ou erro, tentar buscar todos e filtrar
  const allUsersResult = await apiRequest('get', '/users', null, token);
  if (allUsersResult.success && Array.isArray(allUsersResult.data)) {
    const user = allUsersResult.data.find(u => u.email === email);
    return user ? { exists: true, serverId: user.id } : { exists: false };
  }
  
  return { exists: false, error: result.error };
}

// Função principal de sincronização
async function syncUsers() {
  const token = await getAuthToken();
  
  // Obter todos os usuários locais
  const users = db.prepare(`
    SELECT * FROM users 
    ORDER BY created_at ASC
  `).all();
  
  console.log(`📊 Total de usuários locais: ${users.length}\n`);
  
  // Estatísticas
  const stats = {
    total: users.length,
    alreadySynced: 0,
    syncedNow: 0,
    linked: 0,
    errors: 0,
    needsPassword: 0
  };
  
  // Processar cada usuário
  for (const user of users) {
    console.log(`\n─────────────────────────────────────────────`);
    console.log(`👤 Processando: ${user.full_name || user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID Local: ${user.id}`);
    console.log(`   Sync Status: ${user.sync_status || (user.synced ? 'SYNCED' : 'PENDING')}`);
    
    // Verificar se já está sincronizado
    if (user.synced === 1 && user.sync_status === 'SYNCED' && user.server_id) {
      console.log(`   ✅ Já sincronizado (Server ID: ${user.server_id})`);
      stats.alreadySynced++;
      continue;
    }
    
    // Verificar se usuário existe no servidor
    const serverCheck = await checkUserExistsOnServer(user.email, token);
    
    if (serverCheck.exists) {
      console.log(`   🔗 Usuário já existe no servidor (ID: ${serverCheck.serverId})`);
      
      if (!DRY_RUN) {
        // Vincular usuário local ao servidor
        db.prepare(`
          UPDATE users 
          SET synced = 1, 
              sync_status = 'SYNCED', 
              server_id = ?,
              last_sync = datetime('now'),
              sync_error = NULL
          WHERE id = ?
        `).run(serverCheck.serverId, user.id);
        console.log(`   ✅ Vinculado ao servidor`);
      } else {
        console.log(`   [DRY RUN] Seria vinculado ao servidor`);
      }
      stats.linked++;
      continue;
    }
    
    // Usuário não existe no servidor - precisamos criar
    console.log(`   📤 Usuário não existe no servidor - tentando criar...`);
    
    // Verificar se temos senha
    if (!DEFAULT_PASSWORD) {
      console.log(`   ⚠️ Sem senha disponível para criar usuário`);
      console.log(`      Use --reset-password SENHA para definir uma senha padrão`);
      
      if (!DRY_RUN) {
        db.prepare(`
          UPDATE users 
          SET sync_status = 'ERROR', 
              last_sync_attempt = datetime('now'),
              sync_error = 'Senha não disponível para sincronização'
          WHERE id = ?
        `).run(user.id);
      }
      stats.needsPassword++;
      continue;
    }
    
    // Preparar dados para criação
    const createData = {
      id: user.id, // Manter o mesmo ID
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      password: DEFAULT_PASSWORD,
      role: user.role || 'cashier',
      branchId: user.branch_id,
      phone: user.phone,
      allowedTabs: user.allowed_tabs ? JSON.parse(user.allowed_tabs) : null,
      isActive: user.is_active === 1
    };
    
    if (DRY_RUN) {
      console.log(`   [DRY RUN] Seria criado no servidor com dados:`, JSON.stringify(createData, null, 2));
      stats.syncedNow++;
      continue;
    }
    
    // Criar usuário no servidor
    const createResult = await apiRequest('post', '/users', createData, token);
    
    if (createResult.success) {
      console.log(`   ✅ Usuário criado no servidor!`);
      
      // Atualizar local
      const serverId = createResult.data.id || user.id;
      db.prepare(`
        UPDATE users 
        SET synced = 1, 
            sync_status = 'SYNCED', 
            server_id = ?,
            last_sync = datetime('now'),
            sync_error = NULL
        WHERE id = ?
      `).run(serverId, user.id);
      
      // Atualizar senha local com hash da senha padrão
      const newHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      db.prepare(`
        UPDATE users SET password_hash = ? WHERE id = ?
      `).run(newHash, user.id);
      
      stats.syncedNow++;
    } else if (createResult.status === 409) {
      // Conflito - usuário já existe (possivelmente por username)
      console.log(`   ⚠️ Conflito: ${createResult.error}`);
      
      // Tentar vincular mesmo assim
      const recheck = await checkUserExistsOnServer(user.email, token);
      if (recheck.exists) {
        db.prepare(`
          UPDATE users 
          SET synced = 1, 
              sync_status = 'SYNCED', 
              server_id = ?,
              last_sync = datetime('now'),
              sync_error = NULL
          WHERE id = ?
        `).run(recheck.serverId, user.id);
        console.log(`   ✅ Vinculado ao usuário existente`);
        stats.linked++;
      } else {
        db.prepare(`
          UPDATE users 
          SET sync_status = 'ERROR', 
              last_sync_attempt = datetime('now'),
              sync_error = ?
          WHERE id = ?
        `).run(createResult.error, user.id);
        stats.errors++;
      }
    } else {
      console.log(`   ❌ Erro: ${createResult.error}`);
      
      db.prepare(`
        UPDATE users 
        SET sync_status = 'ERROR', 
            last_sync_attempt = datetime('now'),
            sync_error = ?
        WHERE id = ?
      `).run(createResult.error, user.id);
      stats.errors++;
    }
  }
  
  // Relatório final
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Total de usuários: ${stats.total}`);
  console.log(`✅ Já sincronizados: ${stats.alreadySynced}`);
  console.log(`🔗 Vinculados agora: ${stats.linked}`);
  console.log(`📤 Criados agora: ${stats.syncedNow}`);
  console.log(`⚠️ Precisam de senha: ${stats.needsPassword}`);
  console.log(`❌ Erros: ${stats.errors}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (stats.needsPassword > 0) {
    console.log('\n💡 DICA: Para sincronizar usuários sem senha, execute:');
    console.log(`   node sync-users.js --reset-password SUA_SENHA_PADRAO\n`);
  }
  
  if (DRY_RUN) {
    console.log('\n🔄 Executado em modo DRY RUN - nenhuma alteração foi feita');
    console.log('   Para aplicar as alterações, execute sem --dry-run\n');
  }
}

// Executar
syncUsers()
  .then(() => {
    db.close();
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erro fatal:', error);
    db.close();
    process.exit(1);
  });
