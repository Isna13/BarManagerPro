/**
 * Script de Sincronização de Usuários Antigos (Versão Portável)
 * 
 * Este script identifica usuários locais que não estão sincronizados
 * com o servidor Railway e tenta sincronizá-los.
 * 
 * Usa sql.js para compatibilidade com qualquer versão do Node.js.
 * 
 * Uso: 
 *   node sync-users-portable.js [opções]
 * 
 * Opções:
 *   --dry-run                   Simula a sincronização sem fazer alterações
 *   --reset-password SENHA      Define a senha padrão para novos usuários
 *   --admin-email EMAIL         Email do admin para autenticação
 *   --admin-password SENHA      Senha do admin para autenticação
 *   --verbose, -v               Mostra detalhes das requisições API
 * 
 * Exemplos:
 *   node sync-users-portable.js --dry-run
 *   node sync-users-portable.js --reset-password "Senha@123" --admin-email admin@email.com --admin-password senha123
 */

const axios = require('axios');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Configurações
const API_URL = process.env.API_URL || 'https://barmanagerbackend-production.up.railway.app/api/v1';

// Tentar múltiplos caminhos para o banco de dados
const DB_PATHS = [
  path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db'), // Windows Electron
  path.join(os.homedir(), 'BarManagerPro', 'barmanager.db'), // Alternativo
  path.join(os.homedir(), '.config', '@barmanager', 'desktop', 'barmanager.db'), // Linux
  path.join(os.homedir(), 'Library', 'Application Support', '@barmanager', 'desktop', 'barmanager.db'), // macOS
];

// Encontrar o primeiro caminho válido
let DB_PATH = DB_PATHS.find(p => fs.existsSync(p));
if (!DB_PATH && process.env.DB_PATH) {
  DB_PATH = process.env.DB_PATH;
}

// Parse args
const args = process.argv.slice(2);

// Helper para parse de argumentos
function getArgValue(argName) {
  const index = args.indexOf(argName);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

// Configurações a partir dos argumentos
const DRY_RUN = args.includes('--dry-run');
const DEFAULT_PASSWORD = getArgValue('--reset-password');
const ADMIN_EMAIL = getArgValue('--admin-email');
const ADMIN_PASSWORD = getArgValue('--admin-password');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const HELP = args.includes('--help') || args.includes('-h');
const CREATE_FIRST_ADMIN = args.includes('--create-first-admin');

if (HELP) {
  console.log(`
Uso: node sync-users-portable.js [opções]

Opções:
  --dry-run                   Simula a sincronização sem fazer alterações
  --reset-password SENHA      Define a senha padrão para novos usuários
  --admin-email EMAIL         Email do admin para autenticação na API
  --admin-password SENHA      Senha do admin para autenticação na API
  --create-first-admin        Cria o primeiro admin sem autenticação (use apenas uma vez)
  --verbose, -v               Mostra detalhes das requisições API
  --help, -h                  Mostra esta ajuda

Exemplos:
  # Primeira execução - criar admin inicial sem autenticação:
  node sync-users-portable.js --reset-password "Senha@123" --create-first-admin

  # Execuções seguintes - usar admin existente:
  node sync-users-portable.js --reset-password "Senha@123" --admin-email admin@email.com --admin-password senha

  # Apenas simular:
  node sync-users-portable.js --dry-run
  `);
  process.exit(0);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('           SCRIPT DE SINCRONIZAÇÃO DE USUÁRIOS');
console.log('           (Versão Portável com sql.js)');
console.log('═══════════════════════════════════════════════════════════════');

if (!DB_PATH) {
  console.error('❌ Banco de dados não encontrado em nenhum dos caminhos conhecidos:');
  DB_PATHS.forEach(p => console.log(`   - ${p}`));
  console.log('\n💡 Defina a variável DB_PATH ou certifique-se de que o app foi executado.');
  process.exit(1);
}

console.log(`📁 Banco de dados: ${DB_PATH}`);
console.log(`🌐 API URL: ${API_URL}`);
console.log(`🔄 Modo: ${DRY_RUN ? 'DRY RUN (simulação)' : 'PRODUÇÃO'}`);
if (DEFAULT_PASSWORD) {
  console.log(`🔑 Senha padrão: ${DEFAULT_PASSWORD.substring(0, 3)}***`);
}
if (ADMIN_EMAIL) {
  console.log(`👤 Admin: ${ADMIN_EMAIL}`);
}
if (CREATE_FIRST_ADMIN) {
  console.log(`🚀 Modo: Criar primeiro admin sem autenticação`);
}
console.log('═══════════════════════════════════════════════════════════════\n');

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
    
    if (VERBOSE) {
      console.log(`   [API] ${method.toUpperCase()} ${endpoint}`);
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    if (VERBOSE) {
      console.log(`   [API ERROR] ${error.response?.status}: ${error.response?.data?.message || error.message}`);
    }
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      status: error.response?.status 
    };
  }
}

// Função para fazer login e obter token
async function getAuthToken() {
  // Se estamos no modo create-first-admin, pular autenticação
  if (CREATE_FIRST_ADMIN) {
    console.log('🚀 Modo create-first-admin: pulando autenticação\n');
    return null;
  }
  
  console.log('🔐 Tentando autenticação...');
  
  // Lista de tentativas de login
  const loginAttempts = [];
  
  // Se credenciais foram fornecidas via CLI, usar primeiro
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    loginAttempts.push({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  }
  
  // Adicionar credenciais padrão como fallback
  loginAttempts.push(
    { email: 'admin@barmanager.com', password: 'Admin@123' },
    { email: 'admin@admin.com', password: 'Admin@123' },
    { email: 'admin@barmanager.com', password: 'admin123' },
  );
  
  for (const attempt of loginAttempts) {
    const result = await apiRequest('post', '/auth/login', attempt);
    if (result.success && result.data.access_token) {
      console.log(`✅ Autenticado como: ${attempt.email}\n`);
      return result.data.access_token;
    }
  }
  
  console.warn('⚠️ Não foi possível autenticar');
  console.log('   Use --admin-email e --admin-password para fornecer credenciais');
  console.log('   Continuando sem autenticação (algumas operações podem falhar)\n');
  return null;
}

// Função para buscar usuários do servidor
async function getServerUsers(token) {
  const result = await apiRequest('get', '/users', null, token);
  if (result.success && Array.isArray(result.data)) {
    return result.data;
  }
  return [];
}

// Função para verificar se usuário existe no Railway
function findServerUser(serverUsers, email, username) {
  // Primeiro por email (mais confiável)
  let user = serverUsers.find(u => u.email?.toLowerCase() === email?.toLowerCase());
  if (user) return { exists: true, serverId: user.id, matchedBy: 'email' };
  
  // Depois por username
  user = serverUsers.find(u => u.username?.toLowerCase() === username?.toLowerCase());
  if (user) return { exists: true, serverId: user.id, matchedBy: 'username' };
  
  return { exists: false };
}

// Função principal de sincronização
async function syncUsers() {
  // Carregar sql.js dinamicamente
  let initSqlJs;
  try {
    initSqlJs = require('sql.js');
  } catch (e) {
    console.log('📦 Instalando sql.js...');
    const { execSync } = require('child_process');
    execSync('npm install sql.js --no-save', { stdio: 'inherit' });
    initSqlJs = require('sql.js');
  }
  
  // Abrir banco de dados com sql.js
  console.log('📂 Abrindo banco de dados...');
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);
  
  console.log('✅ Banco de dados aberto com sucesso\n');
  
  // Obter token de autenticação
  const token = await getAuthToken();
  
  // Buscar todos os usuários do servidor primeiro
  console.log('🌐 Buscando usuários do servidor...');
  const serverUsers = await getServerUsers(token);
  console.log(`   Encontrados ${serverUsers.length} usuários no servidor\n`);
  
  // Obter todos os usuários locais
  const usersResult = db.exec(`
    SELECT id, username, email, full_name, role, branch_id, phone, 
           is_active, synced, sync_status, server_id, allowed_tabs,
           created_at, updated_at
    FROM users 
    ORDER BY created_at ASC
  `);
  
  // Converter resultado para array de objetos
  const users = [];
  if (usersResult.length > 0) {
    const columns = usersResult[0].columns;
    for (const row of usersResult[0].values) {
      const user = {};
      columns.forEach((col, idx) => {
        user[col] = row[idx];
      });
      users.push(user);
    }
  }
  
  console.log(`📊 Total de usuários locais: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('ℹ️ Nenhum usuário encontrado no banco local.');
    return;
  }
  
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
    console.log(`─────────────────────────────────────────────`);
    console.log(`👤 ${user.full_name || user.username}`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   🆔 ID Local: ${user.id}`);
    console.log(`   🔄 Status: ${user.sync_status || (user.synced ? 'SYNCED' : 'PENDING')}`);
    console.log(`   👔 Role: ${user.role || 'N/A'}`);
    
    // Verificar se já está sincronizado
    if (user.synced === 1 && user.sync_status === 'SYNCED' && user.server_id) {
      console.log(`   ✅ Já sincronizado (Server ID: ${user.server_id})`);
      stats.alreadySynced++;
      continue;
    }
    
    // Verificar se usuário existe no servidor
    const serverCheck = findServerUser(serverUsers, user.email, user.username);
    
    if (serverCheck.exists) {
      console.log(`   🔗 Encontrado no servidor (${serverCheck.matchedBy}): ${serverCheck.serverId}`);
      
      if (!DRY_RUN) {
        // Vincular usuário local ao servidor
        db.run(`
          UPDATE users 
          SET synced = 1, 
              sync_status = 'SYNCED', 
              server_id = ?,
              sync_error = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `, [serverCheck.serverId, user.id]);
        console.log(`   ✅ Vinculado localmente!`);
      } else {
        console.log(`   [DRY RUN] Seria vinculado ao servidor`);
      }
      stats.linked++;
      continue;
    }
    
    // Usuário não existe no servidor - precisamos criar
    console.log(`   📤 Não existe no servidor - tentando criar...`);
    
    // Verificar se temos senha
    if (!DEFAULT_PASSWORD) {
      console.log(`   ⚠️ Sem senha disponível para criar usuário`);
      
      if (!DRY_RUN) {
        db.run(`
          UPDATE users 
          SET sync_status = 'ERROR', 
              sync_error = 'Senha não disponível para sincronização',
              updated_at = datetime('now')
          WHERE id = ?
        `, [user.id]);
      }
      stats.needsPassword++;
      continue;
    }
    
    // Preparar dados para criação
    const createData = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      password: DEFAULT_PASSWORD,
      role: user.role || 'cashier',
      branchId: user.branch_id || undefined,
      phone: user.phone || undefined,
      isActive: user.is_active === 1
    };
    
    // Adicionar allowedTabs se existir
    if (user.allowed_tabs) {
      try {
        createData.allowedTabs = JSON.parse(user.allowed_tabs);
      } catch (e) {}
    }
    
    if (DRY_RUN) {
      console.log(`   [DRY RUN] Seria criado com:`, JSON.stringify({
        ...createData,
        password: '***'
      }, null, 2).split('\n').map(l => '      ' + l).join('\n'));
      stats.syncedNow++;
      continue;
    }
    
    // Tentar criar usuário - primeiro via /users (requer auth), depois via /auth/register (público)
    let createResult;
    
    if (token) {
      // Se temos token, usar endpoint protegido
      createResult = await apiRequest('post', '/users', createData, token);
    }
    
    // Se não tem token ou falhou com 401/403, tentar endpoint público de registro
    if (!token || (createResult && (createResult.status === 401 || createResult.status === 403))) {
      console.log(`   🔓 Usando endpoint público /auth/register...`);
      createResult = await apiRequest('post', '/auth/register', createData);
    }
    
    if (createResult.success) {
      console.log(`   ✅ Criado no servidor!`);
      
      // Atualizar local
      const serverId = createResult.data.id || createResult.data.user?.id || user.id;
      db.run(`
        UPDATE users 
        SET synced = 1, 
            sync_status = 'SYNCED', 
            server_id = ?,
            sync_error = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `, [serverId, user.id]);
      
      stats.syncedNow++;
    } else if (createResult.status === 409) {
      // Conflito - usuário já existe
      console.log(`   ⚠️ Conflito (409): ${createResult.error}`);
      
      // Re-buscar usuários do servidor e tentar vincular
      const updatedServerUsers = await getServerUsers(token);
      const recheck = findServerUser(updatedServerUsers, user.email, user.username);
      
      if (recheck.exists) {
        db.run(`
          UPDATE users 
          SET synced = 1, 
              sync_status = 'SYNCED', 
              server_id = ?,
              sync_error = NULL,
              updated_at = datetime('now')
          WHERE id = ?
        `, [recheck.serverId, user.id]);
        console.log(`   ✅ Vinculado ao usuário existente: ${recheck.serverId}`);
        stats.linked++;
      } else {
        db.run(`
          UPDATE users 
          SET sync_status = 'ERROR', 
              sync_error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [createResult.error, user.id]);
        stats.errors++;
      }
    } else {
      console.log(`   ❌ Erro: ${createResult.error}`);
      
      db.run(`
        UPDATE users 
        SET sync_status = 'ERROR', 
            sync_error = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [createResult.error, user.id]);
      stats.errors++;
    }
  }
  
  // Salvar alterações no banco
  if (!DRY_RUN) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('\n💾 Alterações salvas no banco de dados');
  }
  
  db.close();
  
  // Relatório final
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Total de usuários locais:    ${stats.total}`);
  console.log(`✅ Já sincronizados:            ${stats.alreadySynced}`);
  console.log(`🔗 Vinculados agora:            ${stats.linked}`);
  console.log(`📤 Criados no servidor:         ${stats.syncedNow}`);
  console.log(`⚠️  Precisam de senha:           ${stats.needsPassword}`);
  console.log(`❌ Erros:                       ${stats.errors}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  const pendingTotal = stats.needsPassword + stats.errors;
  if (pendingTotal > 0) {
    console.log(`\n📋 Resumo: ${stats.alreadySynced + stats.linked + stats.syncedNow}/${stats.total} usuários sincronizados`);
  } else {
    console.log(`\n🎉 Todos os usuários estão sincronizados!`);
  }
  
  if (stats.needsPassword > 0) {
    console.log('\n💡 DICA: Para sincronizar usuários sem senha, execute:');
    console.log(`   node sync-users-portable.js --reset-password SUA_SENHA_PADRAO`);
  }
  
  if (DRY_RUN) {
    console.log('\n🔄 Executado em modo DRY RUN - nenhuma alteração foi feita');
    console.log('   Para aplicar as alterações, execute sem --dry-run');
  }
  
  console.log('');
}

// Executar
syncUsers()
  .then(() => {
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
