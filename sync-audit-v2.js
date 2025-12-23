/**
 * 🔍 AUDITORIA COMPLETA DE SINCRONIZAÇÃO (via SQL dump)
 * Compara dados reais: Electron SQLite × Railway PostgreSQL
 */

const { execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Configuração
const ELECTRON_DB_PATH = path.join(__dirname, 'apps/desktop/barmanager.db');
const RAILWAY_API = process.env.RAILWAY_API_URL || 'https://barmanagerpro-production.up.railway.app';

// Cores para output
const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${c[color]}${symbol}${c.reset} ${message}`);
}

// Função para executar query SQLite via linha de comando
function querySqlite(query) {
  try {
    const result = execSync(`sqlite3 -json "${ELECTRON_DB_PATH}" "${query}"`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    return result.trim() ? JSON.parse(result) : [];
  } catch (error) {
    // Tentar sem -json para versões antigas
    try {
      const result = execSync(`sqlite3 -header -separator "|" "${ELECTRON_DB_PATH}" "${query}"`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024
      });
      return parseCliOutput(result);
    } catch (e) {
      console.error('Erro SQLite:', e.message);
      return [];
    }
  }
}

function parseCliOutput(output) {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split('|');
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('|');
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() || null;
    });
    rows.push(row);
  }
  return rows;
}

class SyncAuditor {
  constructor() {
    this.token = null;
    this.report = {
      timestamp: new Date().toISOString(),
      categories: { electron: [], railway: [], missing: [], duplicates: [], mismatches: [] },
      suppliers: { electron: [], railway: [], missing: [], duplicates: [], mismatches: [] },
      products: { electron: [], railway: [], missing: [], duplicates: [], mismatches: [] },
      syncQueue: { pending: [], failed: [], stats: {} },
      errors: [],
      summary: {}
    };
  }

  async init() {
    log('cyan', '🔧', 'Inicializando auditoria...');
    
    // Verificar banco
    if (!fs.existsSync(ELECTRON_DB_PATH)) {
      throw new Error(`Banco Electron não encontrado: ${ELECTRON_DB_PATH}`);
    }
    log('green', '✅', `Banco Electron: ${ELECTRON_DB_PATH}`);
    
    // Autenticar
    await this.authenticate();
  }

  async authenticate() {
    log('cyan', '🔐', 'Autenticando no Railway...');
    try {
      const response = await axios.post(`${RAILWAY_API}/auth/login`, {
        email: 'admin@barmanager.com',
        password: 'admin123'
      }, { timeout: 30000 });
      
      this.token = response.data.access_token;
      log('green', '✅', 'Autenticado no Railway');
    } catch (error) {
      log('yellow', '⚠️', `Auth falhou: ${error.message} - tentando sem auth`);
    }
  }

  headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // ==================== CATEGORIAS ====================
  async auditCategories() {
    log('blue', '\n📁', '=== AUDITORIA DE CATEGORIAS ===');
    
    // Electron
    const electronCats = querySqlite(`
      SELECT id, name, description, branch_id as branchId, is_active as isActive FROM categories ORDER BY name
    `);
    this.report.categories.electron = electronCats;
    log('cyan', '📊', `Electron: ${electronCats.length} categorias`);
    
    // Railway
    let railwayCats = [];
    try {
      const res = await axios.get(`${RAILWAY_API}/categories`, { headers: this.headers(), timeout: 30000 });
      railwayCats = Array.isArray(res.data) ? res.data : (res.data.items || []);
      this.report.categories.railway = railwayCats;
      log('cyan', '📊', `Railway: ${railwayCats.length} categorias`);
    } catch (error) {
      log('red', '❌', `Erro Railway: ${error.message}`);
      this.report.errors.push({ entity: 'categories', error: error.message });
      return;
    }
    
    // Comparar
    const rwMap = new Map(railwayCats.map(c => [c.id, c]));
    const rwByName = new Map();
    
    // Detectar duplicatas por nome
    for (const cat of railwayCats) {
      const key = (cat.name || '').toLowerCase();
      if (rwByName.has(key)) {
        this.report.categories.duplicates.push({
          name: cat.name,
          ids: [rwByName.get(key).id, cat.id]
        });
      } else {
        rwByName.set(key, cat);
      }
    }
    
    for (const el of electronCats) {
      const rw = rwMap.get(el.id);
      if (!rw) {
        this.report.categories.missing.push({ ...el, reason: 'Não existe no Railway' });
        log('red', '❌', `MISSING: "${el.name}" (${el.id})`);
      } else {
        const diff = [];
        if (el.name !== rw.name) diff.push(`name: ${el.name} → ${rw.name}`);
        if (diff.length > 0) {
          this.report.categories.mismatches.push({ id: el.id, name: el.name, diff });
          log('yellow', '⚠️', `DIFF: "${el.name}" - ${diff.join(', ')}`);
        } else {
          log('green', '✅', `OK: "${el.name}"`);
        }
      }
    }
    
    if (this.report.categories.duplicates.length > 0) {
      log('red', '🔴', `${this.report.categories.duplicates.length} DUPLICATAS:`);
      for (const d of this.report.categories.duplicates) {
        log('red', '  ❌', `"${d.name}" → IDs: ${d.ids.join(', ')}`);
      }
    }
  }

  // ==================== SUPPLIERS ====================
  async auditSuppliers() {
    log('blue', '\n🏭', '=== AUDITORIA DE FORNECEDORES ===');
    
    const electronSups = querySqlite(`
      SELECT id, code, name, contact_name, phone, email, is_active FROM suppliers ORDER BY name
    `);
    this.report.suppliers.electron = electronSups;
    log('cyan', '📊', `Electron: ${electronSups.length} fornecedores`);
    
    let railwaySups = [];
    try {
      const res = await axios.get(`${RAILWAY_API}/suppliers`, { headers: this.headers(), timeout: 30000 });
      railwaySups = Array.isArray(res.data) ? res.data : (res.data.items || []);
      this.report.suppliers.railway = railwaySups;
      log('cyan', '📊', `Railway: ${railwaySups.length} fornecedores`);
    } catch (error) {
      log('red', '❌', `Erro Railway: ${error.message}`);
      this.report.errors.push({ entity: 'suppliers', error: error.message });
      return;
    }
    
    const rwMap = new Map(railwaySups.map(s => [s.id, s]));
    const rwByCode = new Map();
    
    // Duplicatas por código
    for (const sup of railwaySups) {
      if (sup.code && rwByCode.has(sup.code)) {
        this.report.suppliers.duplicates.push({
          code: sup.code,
          ids: [rwByCode.get(sup.code).id, sup.id],
          names: [rwByCode.get(sup.code).name, sup.name]
        });
      } else if (sup.code) {
        rwByCode.set(sup.code, sup);
      }
    }
    
    for (const el of electronSups) {
      const rw = rwMap.get(el.id);
      if (!rw) {
        this.report.suppliers.missing.push({ ...el, reason: 'Não existe no Railway' });
        log('red', '❌', `MISSING: "${el.name}" (code: ${el.code})`);
      } else {
        log('green', '✅', `OK: "${el.name}"`);
      }
    }
    
    if (this.report.suppliers.duplicates.length > 0) {
      log('red', '🔴', `${this.report.suppliers.duplicates.length} DUPLICATAS por código`);
    }
  }

  // ==================== PRODUTOS ====================
  async auditProducts() {
    log('blue', '\n📦', '=== AUDITORIA DE PRODUTOS ===');
    
    const electronProds = querySqlite(`
      SELECT p.id, p.sku, p.name, p.category_id, p.supplier_id, p.price_unit, p.is_active,
             c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.name
    `);
    this.report.products.electron = electronProds;
    log('cyan', '📊', `Electron: ${electronProds.length} produtos`);
    
    let railwayProds = [];
    try {
      const res = await axios.get(`${RAILWAY_API}/products?limit=2000`, { headers: this.headers(), timeout: 60000 });
      railwayProds = Array.isArray(res.data) ? res.data : (res.data.items || []);
      this.report.products.railway = railwayProds;
      log('cyan', '📊', `Railway: ${railwayProds.length} produtos`);
    } catch (error) {
      log('red', '❌', `Erro Railway: ${error.message}`);
      this.report.errors.push({ entity: 'products', error: error.message });
      return;
    }
    
    const rwMap = new Map(railwayProds.map(p => [p.id, p]));
    const rwBySku = new Map();
    
    // Duplicatas por SKU
    for (const prod of railwayProds) {
      if (prod.sku && rwBySku.has(prod.sku)) {
        this.report.products.duplicates.push({
          sku: prod.sku,
          ids: [rwBySku.get(prod.sku).id, prod.id],
          names: [rwBySku.get(prod.sku).name, prod.name]
        });
      } else if (prod.sku) {
        rwBySku.set(prod.sku, prod);
      }
    }
    
    let ok = 0, missing = 0, diff = 0;
    
    for (const el of electronProds) {
      const rw = rwMap.get(el.id);
      if (!rw) {
        missing++;
        this.report.products.missing.push({
          id: el.id,
          sku: el.sku,
          name: el.name,
          category: el.category_name,
          supplier: el.supplier_name,
          reason: 'Não existe no Railway'
        });
        log('red', '❌', `MISSING: "${el.name}" (SKU: ${el.sku})`);
        log('red', '   ', `  Cat: ${el.category_name || 'N/A'} | Sup: ${el.supplier_name || 'N/A'}`);
      } else {
        const diffs = [];
        if (el.name !== rw.name) diffs.push('name');
        if (el.sku !== rw.sku) diffs.push('sku');
        if (el.category_id !== rw.categoryId) diffs.push('categoryId');
        
        if (diffs.length > 0) {
          diff++;
          this.report.products.mismatches.push({ id: el.id, name: el.name, fields: diffs });
          log('yellow', '⚠️', `DIFF: "${el.name}" - ${diffs.join(', ')}`);
        } else {
          ok++;
        }
      }
    }
    
    log('cyan', '\n📊', 'RESUMO PRODUTOS:');
    log('green', '  ✅', `OK: ${ok}`);
    log('red', '  ❌', `Missing: ${missing}`);
    log('yellow', '  ⚠️', `Diferentes: ${diff}`);
  }

  // ==================== SYNC QUEUE ====================
  auditSyncQueue() {
    log('blue', '\n📋', '=== FILA DE SINCRONIZAÇÃO ===');
    
    const stats = querySqlite(`SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`);
    this.report.syncQueue.stats = stats;
    
    log('cyan', '📊', 'Status da fila:');
    for (const s of stats) {
      const color = s.status === 'pending' ? 'yellow' : s.status === 'failed' ? 'red' : 'green';
      log(color, '  •', `${s.status}: ${s.count}`);
    }
    
    const failed = querySqlite(`
      SELECT entity, operation, entity_id, error_message, created_at 
      FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20
    `);
    this.report.syncQueue.failed = failed;
    
    if (failed.length > 0) {
      log('red', '\n❌', 'FALHAS RECENTES:');
      for (const f of failed.slice(0, 10)) {
        log('red', '  •', `${f.entity}/${f.operation} - ${f.entity_id}`);
        if (f.error_message) log('red', '   ', `  Erro: ${f.error_message.substring(0, 80)}`);
      }
    }
    
    const pending = querySqlite(`
      SELECT entity, COUNT(*) as count FROM sync_queue WHERE status = 'pending' GROUP BY entity
    `);
    this.report.syncQueue.pending = pending;
    
    if (pending.length > 0) {
      log('yellow', '\n⏳', 'PENDENTES:');
      for (const p of pending) {
        log('yellow', '  •', `${p.entity}: ${p.count}`);
      }
    }
  }

  // ==================== RELATÓRIO ====================
  generateSummary() {
    const s = {
      categories: {
        electron: this.report.categories.electron.length,
        railway: this.report.categories.railway.length,
        missing: this.report.categories.missing.length,
        duplicates: this.report.categories.duplicates.length,
      },
      suppliers: {
        electron: this.report.suppliers.electron.length,
        railway: this.report.suppliers.railway.length,
        missing: this.report.suppliers.missing.length,
        duplicates: this.report.suppliers.duplicates.length,
      },
      products: {
        electron: this.report.products.electron.length,
        railway: this.report.products.railway.length,
        missing: this.report.products.missing.length,
        duplicates: this.report.products.duplicates.length,
      },
    };
    this.report.summary = s;
    
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│              📊 RESULTADO DA AUDITORIA                  │');
    console.log('├─────────────┬──────────┬─────────┬─────────┬────────────┤');
    console.log('│ Entidade    │ Electron │ Railway │ Missing │ Duplicatas │');
    console.log('├─────────────┼──────────┼─────────┼─────────┼────────────┤');
    console.log(`│ Categories  │ ${String(s.categories.electron).padStart(8)} │ ${String(s.categories.railway).padStart(7)} │ ${String(s.categories.missing).padStart(7)} │ ${String(s.categories.duplicates).padStart(10)} │`);
    console.log(`│ Suppliers   │ ${String(s.suppliers.electron).padStart(8)} │ ${String(s.suppliers.railway).padStart(7)} │ ${String(s.suppliers.missing).padStart(7)} │ ${String(s.suppliers.duplicates).padStart(10)} │`);
    console.log(`│ Products    │ ${String(s.products.electron).padStart(8)} │ ${String(s.products.railway).padStart(7)} │ ${String(s.products.missing).padStart(7)} │ ${String(s.products.duplicates).padStart(10)} │`);
    console.log('└─────────────┴──────────┴─────────┴─────────┴────────────┘');
    
    const hasProblems = s.categories.missing > 0 || s.suppliers.missing > 0 || s.products.missing > 0 ||
                        s.categories.duplicates > 0 || s.suppliers.duplicates > 0 || s.products.duplicates > 0;
    
    console.log('');
    if (hasProblems) {
      log('red', '🔴', 'VEREDICTO: PROBLEMAS DETECTADOS');
      if (s.products.missing > 0) log('red', '  ❌', `${s.products.missing} produtos NÃO SINCRONIZADOS`);
      if (s.categories.duplicates > 0) log('red', '  ❌', `${s.categories.duplicates} categorias DUPLICADAS`);
      if (s.suppliers.duplicates > 0) log('red', '  ❌', `${s.suppliers.duplicates} fornecedores DUPLICADOS`);
    } else {
      log('green', '🟢', 'VEREDICTO: SINCRONIZAÇÃO OK');
    }
    
    // Salvar
    const reportPath = path.join(__dirname, `sync-audit-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    log('cyan', '💾', `Relatório: ${reportPath}`);
  }
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     🔍 AUDITORIA COMPLETA: ELECTRON × RAILWAY                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  const auditor = new SyncAuditor();
  
  try {
    await auditor.init();
    await auditor.auditCategories();
    await auditor.auditSuppliers();
    await auditor.auditProducts();
    auditor.auditSyncQueue();
    auditor.generateSummary();
  } catch (error) {
    log('red', '❌', `Erro: ${error.message}`);
    console.error(error);
  }
}

main();
