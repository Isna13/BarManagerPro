/**
 * 🔍 AUDITORIA FINAL: ELECTRON × RAILWAY × MOBILE
 * Usa caminho correto do AppData
 */

const { execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuração CORRETA
const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const ELECTRON_DB_PATH = path.join(APPDATA, '@barmanager', 'desktop', 'barmanager.db');
const RAILWAY_API = 'https://barmanagerbackend-production.up.railway.app/api/v1';

const c = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m' };
function log(color, symbol, msg) { console.log(`${c[color]}${symbol}${c.reset} ${msg}`); }

function query(sql) {
  try {
    const result = execSync(`sqlite3 -header -separator "|" "${ELECTRON_DB_PATH}" "${sql}"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    return parseOutput(result);
  } catch (e) {
    console.error('SQLite error:', e.message);
    return [];
  }
}

function parseOutput(output) {
  const lines = output.trim().split('\n').filter(l => l);
  if (lines.length < 2) return [];
  const headers = lines[0].split('|').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split('|');
    const row = {};
    headers.forEach((h, i) => row[h] = values[i]?.trim() || null);
    return row;
  });
}

class Auditor {
  constructor() { this.token = null; this.report = { categories: {}, suppliers: {}, products: {}, syncQueue: {} }; }

  async auth() {
    log('cyan', '🔐', 'Autenticando no Railway...');
    try {
      // Buscar credenciais do Electron
      const users = query(`SELECT email, password_hash FROM users WHERE role = 'admin' LIMIT 1`);
      
      const res = await axios.post(`${RAILWAY_API}/auth/login`, {
        email: 'admin@barmanager.com',
        password: 'admin123'
      }, { timeout: 30000 });
      this.token = res.data.access_token;
      log('green', '✅', 'Autenticado!');
    } catch (e) {
      log('yellow', '⚠️', `Auth: ${e.response?.data?.message || e.message}`);
    }
  }

  headers() { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; }

  async auditCategories() {
    log('blue', '\n📁', '=== CATEGORIAS ===');
    
    const el = query(`SELECT id, name, description, branch_id, is_active FROM categories ORDER BY name`);
    log('cyan', '📊', `Electron: ${el.length} categorias`);
    el.forEach(c => log('cyan', '  •', `"${c.name}" (${c.id.substring(0,8)}...)`));
    
    let rw = [];
    try {
      const res = await axios.get(`${RAILWAY_API}/categories`, { headers: this.headers(), timeout: 30000 });
      rw = Array.isArray(res.data) ? res.data : (res.data.items || res.data.data || []);
      log('cyan', '📊', `Railway: ${rw.length} categorias`);
      rw.forEach(c => log('cyan', '  •', `"${c.name}" (${c.id?.substring(0,8)}...)`));
    } catch (e) {
      log('red', '❌', `Railway error: ${e.response?.status} - ${e.response?.data?.message || e.message}`);
      this.report.categories = { electron: el.length, railway: 0, error: e.message };
      return;
    }
    
    // Comparar
    const rwMap = new Map(rw.map(c => [c.id, c]));
    const missing = el.filter(e => !rwMap.has(e.id));
    
    // Duplicatas no Railway por nome
    const byName = {};
    rw.forEach(c => {
      const key = (c.name || '').toLowerCase();
      if (!byName[key]) byName[key] = [];
      byName[key].push(c);
    });
    const duplicates = Object.entries(byName).filter(([_, arr]) => arr.length > 1);
    
    if (missing.length > 0) {
      log('red', '❌', `${missing.length} categorias MISSING no Railway:`);
      missing.forEach(m => log('red', '  •', `"${m.name}" (${m.id})`));
    }
    
    if (duplicates.length > 0) {
      log('red', '🔴', `${duplicates.length} categorias DUPLICADAS no Railway:`);
      duplicates.forEach(([name, arr]) => {
        log('red', '  •', `"${name}" aparece ${arr.length}x: ${arr.map(a => a.id.substring(0,8)).join(', ')}`);
      });
    }
    
    this.report.categories = { electron: el.length, railway: rw.length, missing: missing.length, duplicates: duplicates.length };
  }

  async auditSuppliers() {
    log('blue', '\n🏭', '=== FORNECEDORES ===');
    
    const el = query(`SELECT id, code, name, is_active FROM suppliers ORDER BY name`);
    log('cyan', '📊', `Electron: ${el.length} fornecedores`);
    el.forEach(s => log('cyan', '  •', `"${s.name}" (code: ${s.code})`));
    
    let rw = [];
    try {
      const res = await axios.get(`${RAILWAY_API}/suppliers`, { headers: this.headers(), timeout: 30000 });
      rw = Array.isArray(res.data) ? res.data : (res.data.items || res.data.data || []);
      log('cyan', '📊', `Railway: ${rw.length} fornecedores`);
      rw.forEach(s => log('cyan', '  •', `"${s.name}" (code: ${s.code})`));
    } catch (e) {
      log('red', '❌', `Railway error: ${e.response?.status} - ${e.message}`);
      this.report.suppliers = { electron: el.length, railway: 0, error: e.message };
      return;
    }
    
    const rwMap = new Map(rw.map(s => [s.id, s]));
    const missing = el.filter(e => !rwMap.has(e.id));
    
    if (missing.length > 0) {
      log('red', '❌', `${missing.length} fornecedores MISSING:`);
      missing.forEach(m => log('red', '  •', `"${m.name}" (${m.code})`));
    }
    
    this.report.suppliers = { electron: el.length, railway: rw.length, missing: missing.length };
  }

  async auditProducts() {
    log('blue', '\n📦', '=== PRODUTOS ===');
    
    const el = query(`
      SELECT p.id, p.sku, p.name, p.category_id, p.supplier_id, p.price_unit, p.is_active,
             c.name as cat_name, s.name as sup_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.name
    `);
    log('cyan', '📊', `Electron: ${el.length} produtos`);
    el.forEach(p => log('cyan', '  •', `"${p.name}" (SKU: ${p.sku || 'N/A'}) - Cat: ${p.cat_name || 'N/A'}`));
    
    let rw = [];
    try {
      const res = await axios.get(`${RAILWAY_API}/products?limit=2000`, { headers: this.headers(), timeout: 60000 });
      rw = Array.isArray(res.data) ? res.data : (res.data.items || res.data.data || []);
      log('cyan', '📊', `Railway: ${rw.length} produtos`);
      rw.slice(0, 10).forEach(p => log('cyan', '  •', `"${p.name}" (SKU: ${p.sku || 'N/A'})`));
      if (rw.length > 10) log('cyan', '  ...', `e mais ${rw.length - 10} produtos`);
    } catch (e) {
      log('red', '❌', `Railway error: ${e.response?.status} - ${e.message}`);
      this.report.products = { electron: el.length, railway: 0, error: e.message };
      return;
    }
    
    const rwMap = new Map(rw.map(p => [p.id, p]));
    const missing = el.filter(e => !rwMap.has(e.id));
    
    if (missing.length > 0) {
      log('red', '\n❌', `${missing.length} produtos MISSING no Railway:`);
      missing.forEach(m => {
        log('red', '  •', `"${m.name}" (${m.id})`);
        log('red', '    ', `SKU: ${m.sku} | Cat: ${m.cat_name} | Sup: ${m.sup_name}`);
      });
    } else if (el.length > 0) {
      log('green', '✅', 'Todos os produtos do Electron existem no Railway');
    }
    
    this.report.products = { electron: el.length, railway: rw.length, missing: missing.length };
  }

  auditSyncQueue() {
    log('blue', '\n📋', '=== SYNC QUEUE ===');
    
    const stats = query(`SELECT status, COUNT(*) as cnt FROM sync_queue GROUP BY status ORDER BY status`);
    log('cyan', '📊', 'Status da fila:');
    stats.forEach(s => {
      const color = s.status === 'pending' ? 'yellow' : s.status === 'failed' ? 'red' : 'green';
      log(color, '  •', `${s.status}: ${s.cnt}`);
    });
    
    const failed = query(`
      SELECT entity, operation, entity_id, error_message, retry_count, created_at
      FROM sync_queue 
      WHERE status = 'failed' 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    if (failed.length > 0) {
      log('red', '\n❌', `${failed.length} itens FALHADOS:`);
      failed.forEach(f => {
        log('red', '  •', `${f.entity}/${f.operation} - ID: ${f.entity_id?.substring(0,8) || 'N/A'}`);
        if (f.error_message) log('red', '    ', `Erro: ${f.error_message.substring(0, 100)}`);
        log('red', '    ', `Retries: ${f.retry_count || 0} | Criado: ${f.created_at}`);
      });
    }
    
    const pending = query(`SELECT entity, COUNT(*) as cnt FROM sync_queue WHERE status = 'pending' GROUP BY entity`);
    if (pending.length > 0) {
      log('yellow', '\n⏳', 'Pendentes por entidade:');
      pending.forEach(p => log('yellow', '  •', `${p.entity}: ${p.cnt}`));
    }
    
    this.report.syncQueue = { stats, failed: failed.length };
  }

  printSummary() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║               📊 RESUMO DA AUDITORIA                          ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    
    const r = this.report;
    const cats = r.categories || {};
    const sups = r.suppliers || {};
    const prods = r.products || {};
    
    console.log(`║ CATEGORIAS:  Electron: ${String(cats.electron || 0).padStart(3)} | Railway: ${String(cats.railway || 0).padStart(3)} | Missing: ${String(cats.missing || 0).padStart(2)} | Dup: ${String(cats.duplicates || 0).padStart(2)} ║`);
    console.log(`║ FORNECEDORES: Electron: ${String(sups.electron || 0).padStart(2)} | Railway: ${String(sups.railway || 0).padStart(3)} | Missing: ${String(sups.missing || 0).padStart(2)}           ║`);
    console.log(`║ PRODUTOS:    Electron: ${String(prods.electron || 0).padStart(3)} | Railway: ${String(prods.railway || 0).padStart(3)} | Missing: ${String(prods.missing || 0).padStart(2)}           ║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    
    const hasErrors = (cats.missing > 0) || (sups.missing > 0) || (prods.missing > 0) || 
                      (cats.duplicates > 0) || (r.syncQueue?.failed > 0);
    
    if (hasErrors) {
      console.log('║  🔴 VEREDICTO: PROBLEMAS DE SINCRONIZAÇÃO DETECTADOS          ║');
    } else if ((prods.electron || 0) === 0) {
      console.log('║  ⚠️  VEREDICTO: BANCO ELECTRON VAZIO (sem produtos)            ║');
    } else {
      console.log('║  🟢 VEREDICTO: SINCRONIZAÇÃO OK                                ║');
    }
    
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    
    // Salvar relatório
    const reportPath = path.join(process.cwd(), `sync-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    log('cyan', '\n💾', `Relatório salvo: ${reportPath}`);
  }
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║    🔍 AUDITORIA COMPLETA DE SINCRONIZAÇÃO                     ║');
  console.log('║    Electron (AppData) × Railway × Mobile                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  log('cyan', '📂', `Banco: ${ELECTRON_DB_PATH}`);
  log('cyan', '🌐', `API: ${RAILWAY_API}`);
  
  if (!fs.existsSync(ELECTRON_DB_PATH)) {
    log('red', '❌', 'Banco Electron não encontrado!');
    return;
  }
  
  const auditor = new Auditor();
  await auditor.auth();
  await auditor.auditCategories();
  await auditor.auditSuppliers();
  await auditor.auditProducts();
  auditor.auditSyncQueue();
  auditor.printSummary();
}

main().catch(e => console.error(e));
