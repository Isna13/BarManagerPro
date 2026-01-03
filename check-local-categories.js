/**
 * Script para verificar categorias no banco local SQLite
 */

const path = require('path');
const os = require('os');

// Caminho do banco local
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '@barmanager', 'desktop', 'barmanager.db');

console.log('🔍 Verificando categorias no banco local...\n');
console.log(`📁 Banco: ${dbPath}\n`);

// Usar better-sqlite3 nativo do Electron
const fs = require('fs');

if (!fs.existsSync(dbPath)) {
  console.log('❌ Banco de dados não encontrado!');
  process.exit(1);
}

// Tentar usar sqlite3 CLI
const { execSync } = require('child_process');

try {
  // Verificar se a tabela categories existe
  console.log('1️⃣ Verificando se a tabela categories existe...');
  const tables = execSync(`sqlite3 "${dbPath}" ".tables"`, { encoding: 'utf8' });
  console.log('   Tabelas encontradas:', tables.trim().split(/\s+/).length);
  
  if (tables.includes('categories')) {
    console.log('   ✅ Tabela categories existe!\n');
    
    // Contar categorias
    console.log('2️⃣ Contando categorias...');
    const count = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM categories;"`, { encoding: 'utf8' });
    console.log(`   Total de categorias: ${count.trim()}\n`);
    
    // Listar categorias
    console.log('3️⃣ Listando categorias:');
    const categories = execSync(`sqlite3 "${dbPath}" -header -column "SELECT id, name, synced, is_active FROM categories LIMIT 20;"`, { encoding: 'utf8' });
    console.log(categories || '   (nenhuma categoria encontrada)');
    
    // Verificar fila de sync pendente para categorias
    console.log('\n4️⃣ Verificando fila de sync para categorias...');
    const syncQueue = execSync(`sqlite3 "${dbPath}" -header -column "SELECT id, entity, operation, entity_id, retry_count, status FROM sync_queue WHERE entity = 'category' LIMIT 10;"`, { encoding: 'utf8' });
    console.log(syncQueue || '   (nenhum item na fila de sync para categorias)');
    
  } else {
    console.log('   ❌ Tabela categories NÃO existe!\n');
    console.log('   Tabelas disponíveis:', tables);
  }
  
} catch (error) {
  console.error('❌ Erro ao executar sqlite3:', error.message);
  console.log('\n💡 Alternativa: verificando via spawn...');
  
  const { spawnSync } = require('child_process');
  const result = spawnSync('sqlite3', [dbPath, '.tables'], { encoding: 'utf8' });
  if (result.stdout) {
    console.log('Tabelas:', result.stdout);
  }
  if (result.stderr) {
    console.log('Erro:', result.stderr);
  }
}

console.log('\n✅ Verificação concluída!');
