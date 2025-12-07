// Script para ler banco SQLite usando o Electron do desktop
const { spawn } = require('child_process');
const path = require('path');

// Executar sqlite3 diretamente se disponível
const sqlite3Path = 'sqlite3';
const dbPath = 'C:/Users/HP/AppData/Roaming/@barmanager/desktop/barmanager.db';

const queries = [
  "SELECT '=== DÍVIDAS LOCAIS ===' as info;",
  "SELECT id, customer_id, sale_id, total_amount, paid_amount, balance, status, synced, created_at FROM debts ORDER BY created_at DESC;",
  "SELECT '=== SYNC QUEUE (debt) ===' as info;",
  "SELECT * FROM sync_queue WHERE entity_type LIKE '%debt%' ORDER BY created_at DESC LIMIT 10;",
  "SELECT '=== VENDAS COM DÍVIDA ===' as info;",
  "SELECT id, customer_id, total, payment_method, synced, created_at FROM sales WHERE payment_method = 'debt' ORDER BY created_at DESC LIMIT 10;"
];

const proc = spawn('sqlite3', [dbPath, '-header', '-column', queries.join('')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

proc.stdout.on('data', (data) => console.log(data.toString()));
proc.stderr.on('data', (data) => console.error(data.toString()));
proc.on('close', (code) => {
  if (code !== 0) {
    console.log('\nSQLite3 não disponível. Tentando método alternativo...');
    // Alternativa: mostrar o arquivo de sync queue se existir
  }
});
