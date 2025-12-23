/**
 * 🔍 AUDITORIA COMPLETA DE SINCRONIZAÇÃO
 * Compara dados reais: Electron SQLite × Railway PostgreSQL
 * 
 * Foco: Categories, Suppliers, Products
 */

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Configuração
const ELECTRON_DB_PATH = path.join(__dirname, 'apps/desktop/barmanager.db');
const RAILWAY_API = process.env.RAILWAY_API_URL || 'https://barmanagerpro-production.up.railway.app';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${colors[color]}${symbol}${colors.reset} ${message}`);
}

class SyncAuditor {
  constructor() {
    this.electronDb = null;
    this.token = null;
    this.report = {
      timestamp: new Date().toISOString(),
      categories: { electron: [], railway: [], missing: [], duplicates: [], mismatches: [] },
      suppliers: { electron: [], railway: [], missing: [], duplicates: [], mismatches: [] },
      products: { electron: [], railway: [], missing: [], duplicates: [], mismatches: [] },
      syncQueue: { pending: [], failed: [], completed: [] },
      errors: [],
      summary: {}
    };
  }

  async init() {
    log('cyan', '🔧', 'Inicializando auditoria...');
    
    // Conectar ao Electron SQLite
    if (!fs.existsSync(ELECTRON_DB_PATH)) {
      throw new Error(`Banco Electron não encontrado: ${ELECTRON_DB_PATH}`);
    }
    this.electronDb = new Database(ELECTRON_DB_PATH, { readonly: true });
    log('green', '✅', `Conectado ao Electron SQLite: ${ELECTRON_DB_PATH}`);
    
    // Autenticar no Railway
    await this.authenticateRailway();
  }

  async authenticateRailway() {
    log('cyan', '🔐', 'Autenticando no Railway...');
    
    // Tentar pegar credenciais do banco local
    try {
      const settings = this.electronDb.prepare(`
        SELECT value FROM settings WHERE key = 'last_user_email'
      `).get();
      
      // Usar credenciais padrão para auditoria
      const response = await axios.post(`${RAILWAY_API}/auth/login`, {
        email: 'admin@barmanager.com',
        password: 'admin123'
      }, { timeout: 30000 });
      
      this.token = response.data.access_token;
      log('green', '✅', 'Autenticado no Railway');
    } catch (error) {
      log('yellow', '⚠️', `Erro de autenticação: ${error.message}`);
      log('cyan', '📡', 'Tentando endpoints públicos...');
    }
  }

  getAuthHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // ==================== CATEGORIAS ====================
  async auditCategories() {
    log('blue', '\n📁', '=== AUDITORIA DE CATEGORIAS ===');
    
    // 1. Buscar do Electron
    const electronCategories = this.electronDb.prepare(`
      SELECT id, name, description, branch_id as branchId, is_active as isActive,
             created_at as createdAt, updated_at as updatedAt
      FROM categories
      ORDER BY name
    `).all();
    
    this.report.categories.electron = electronCategories;
    log('cyan', '📊', `Electron: ${electronCategories.length} categorias`);
    
    // 2. Buscar do Railway
    let railwayCategories = [];
    try {
      const response = await axios.get(`${RAILWAY_API}/categories`, {
        headers: this.getAuthHeaders(),
        timeout: 30000
      });
      railwayCategories = Array.isArray(response.data) ? response.data : (response.data.items || []);
      this.report.categories.railway = railwayCategories;
      log('cyan', '📊', `Railway: ${railwayCategories.length} categorias`);
    } catch (error) {
      log('red', '❌', `Erro ao buscar categorias do Railway: ${error.message}`);
      this.report.errors.push({ entity: 'categories', error: error.message });
      return;
    }
    
    // 3. Comparar
    const railwayMap = new Map(railwayCategories.map(c => [c.id, c]));
    const railwayByName = new Map();
    
    // Detectar duplicatas por nome no Railway
    for (const cat of railwayCategories) {
      const key = `${cat.name?.toLowerCase()}_${cat.branchId || 'null'}`;
      if (railwayByName.has(key)) {
        this.report.categories.duplicates.push({
          name: cat.name,
          branchId: cat.branchId,
          ids: [railwayByName.get(key).id, cat.id]
        });
      } else {
        railwayByName.set(key, cat);
      }
    }
    
    // Verificar cada categoria do Electron
    for (const elCat of electronCategories) {
      const rwCat = railwayMap.get(elCat.id);
      
      if (!rwCat) {
        this.report.categories.missing.push({
          ...elCat,
          reason: 'Não existe no Railway'
        });
        log('red', '❌', `MISSING: "${elCat.name}" (${elCat.id}) - não existe no Railway`);
      } else {
        // Comparar campos
        const mismatches = [];
        if (elCat.name !== rwCat.name) mismatches.push({ field: 'name', electron: elCat.name, railway: rwCat.name });
        if (elCat.branchId !== rwCat.branchId) mismatches.push({ field: 'branchId', electron: elCat.branchId, railway: rwCat.branchId });
        
        if (mismatches.length > 0) {
          this.report.categories.mismatches.push({ id: elCat.id, name: elCat.name, mismatches });
          log('yellow', '⚠️', `MISMATCH: "${elCat.name}" - campos diferentes: ${mismatches.map(m => m.field).join(', ')}`);
        } else {
          log('green', '✅', `OK: "${elCat.name}"`);
        }
      }
    }
    
    // Categorias no Railway que não existem no Electron
    const electronIds = new Set(electronCategories.map(c => c.id));
    for (const rwCat of railwayCategories) {
      if (!electronIds.has(rwCat.id)) {
        log('yellow', '⚠️', `EXTRA no Railway: "${rwCat.name}" (${rwCat.id}) - não existe no Electron`);
      }
    }
    
    if (this.report.categories.duplicates.length > 0) {
      log('red', '🔴', `DUPLICATAS DETECTADAS: ${this.report.categories.duplicates.length}`);
      for (const dup of this.report.categories.duplicates) {
        log('red', '  ❌', `"${dup.name}" tem ${dup.ids.length} registros com mesmo nome`);
      }
    }
  }

  // ==================== SUPPLIERS ====================
  async auditSuppliers() {
    log('blue', '\n🏭', '=== AUDITORIA DE FORNECEDORES ===');
    
    // 1. Buscar do Electron
    const electronSuppliers = this.electronDb.prepare(`
      SELECT id, code, name, contact_name as contactName, phone, email,
             is_active as isActive, created_at as createdAt
      FROM suppliers
      ORDER BY name
    `).all();
    
    this.report.suppliers.electron = electronSuppliers;
    log('cyan', '📊', `Electron: ${electronSuppliers.length} fornecedores`);
    
    // 2. Buscar do Railway
    let railwaySuppliers = [];
    try {
      const response = await axios.get(`${RAILWAY_API}/suppliers`, {
        headers: this.getAuthHeaders(),
        timeout: 30000
      });
      railwaySuppliers = Array.isArray(response.data) ? response.data : (response.data.items || []);
      this.report.suppliers.railway = railwaySuppliers;
      log('cyan', '📊', `Railway: ${railwaySuppliers.length} fornecedores`);
    } catch (error) {
      log('red', '❌', `Erro ao buscar fornecedores do Railway: ${error.message}`);
      this.report.errors.push({ entity: 'suppliers', error: error.message });
      return;
    }
    
    // 3. Detectar duplicatas por código no Railway
    const railwayByCode = new Map();
    for (const sup of railwaySuppliers) {
      if (sup.code) {
        if (railwayByCode.has(sup.code)) {
          this.report.suppliers.duplicates.push({
            code: sup.code,
            ids: [railwayByCode.get(sup.code).id, sup.id],
            names: [railwayByCode.get(sup.code).name, sup.name]
          });
        } else {
          railwayByCode.set(sup.code, sup);
        }
      }
    }
    
    // 4. Comparar
    const railwayMap = new Map(railwaySuppliers.map(s => [s.id, s]));
    
    for (const elSup of electronSuppliers) {
      const rwSup = railwayMap.get(elSup.id);
      
      if (!rwSup) {
        this.report.suppliers.missing.push({
          ...elSup,
          reason: 'Não existe no Railway'
        });
        log('red', '❌', `MISSING: "${elSup.name}" (code: ${elSup.code}) - não existe no Railway`);
      } else {
        const mismatches = [];
        if (elSup.name !== rwSup.name) mismatches.push({ field: 'name', electron: elSup.name, railway: rwSup.name });
        if (elSup.code !== rwSup.code) mismatches.push({ field: 'code', electron: elSup.code, railway: rwSup.code });
        
        if (mismatches.length > 0) {
          this.report.suppliers.mismatches.push({ id: elSup.id, name: elSup.name, mismatches });
          log('yellow', '⚠️', `MISMATCH: "${elSup.name}" - campos diferentes`);
        } else {
          log('green', '✅', `OK: "${elSup.name}"`);
        }
      }
    }
    
    if (this.report.suppliers.duplicates.length > 0) {
      log('red', '🔴', `DUPLICATAS DE CÓDIGO DETECTADAS: ${this.report.suppliers.duplicates.length}`);
    }
  }

  // ==================== PRODUTOS ====================
  async auditProducts() {
    log('blue', '\n📦', '=== AUDITORIA DE PRODUTOS ===');
    
    // 1. Buscar do Electron
    const electronProducts = this.electronDb.prepare(`
      SELECT p.id, p.sku, p.name, p.category_id as categoryId, p.supplier_id as supplierId,
             p.price_unit as priceUnit, p.price_box as priceBox, p.units_per_box as unitsPerBox,
             p.is_active as isActive, p.branch_id as branchId,
             c.name as categoryName, s.name as supplierName
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.name
    `).all();
    
    this.report.products.electron = electronProducts;
    log('cyan', '📊', `Electron: ${electronProducts.length} produtos`);
    
    // 2. Buscar do Railway
    let railwayProducts = [];
    try {
      const response = await axios.get(`${RAILWAY_API}/products?limit=1000`, {
        headers: this.getAuthHeaders(),
        timeout: 30000
      });
      railwayProducts = Array.isArray(response.data) ? response.data : (response.data.items || []);
      this.report.products.railway = railwayProducts;
      log('cyan', '📊', `Railway: ${railwayProducts.length} produtos`);
    } catch (error) {
      log('red', '❌', `Erro ao buscar produtos do Railway: ${error.message}`);
      this.report.errors.push({ entity: 'products', error: error.message });
      return;
    }
    
    // 3. Comparar
    const railwayMap = new Map(railwayProducts.map(p => [p.id, p]));
    const railwayBySku = new Map();
    
    // Detectar duplicatas por SKU
    for (const prod of railwayProducts) {
      if (prod.sku) {
        if (railwayBySku.has(prod.sku)) {
          this.report.products.duplicates.push({
            sku: prod.sku,
            ids: [railwayBySku.get(prod.sku).id, prod.id],
            names: [railwayBySku.get(prod.sku).name, prod.name]
          });
        } else {
          railwayBySku.set(prod.sku, prod);
        }
      }
    }
    
    let okCount = 0, missingCount = 0, mismatchCount = 0;
    
    for (const elProd of electronProducts) {
      const rwProd = railwayMap.get(elProd.id);
      
      if (!rwProd) {
        missingCount++;
        this.report.products.missing.push({
          id: elProd.id,
          sku: elProd.sku,
          name: elProd.name,
          categoryId: elProd.categoryId,
          categoryName: elProd.categoryName,
          supplierId: elProd.supplierId,
          supplierName: elProd.supplierName,
          reason: 'Não existe no Railway'
        });
        log('red', '❌', `MISSING: "${elProd.name}" (SKU: ${elProd.sku}) - NÃO EXISTE NO RAILWAY`);
        log('red', '   ', `  Category: ${elProd.categoryName || 'N/A'} | Supplier: ${elProd.supplierName || 'N/A'}`);
      } else {
        const mismatches = [];
        if (elProd.name !== rwProd.name) mismatches.push({ field: 'name', electron: elProd.name, railway: rwProd.name });
        if (elProd.sku !== rwProd.sku) mismatches.push({ field: 'sku', electron: elProd.sku, railway: rwProd.sku });
        if (elProd.categoryId !== rwProd.categoryId) mismatches.push({ field: 'categoryId', electron: elProd.categoryId, railway: rwProd.categoryId });
        if (Math.abs((elProd.priceUnit || 0) - (rwProd.priceUnit || 0)) > 0.01) {
          mismatches.push({ field: 'priceUnit', electron: elProd.priceUnit, railway: rwProd.priceUnit });
        }
        
        if (mismatches.length > 0) {
          mismatchCount++;
          this.report.products.mismatches.push({ id: elProd.id, name: elProd.name, sku: elProd.sku, mismatches });
          log('yellow', '⚠️', `MISMATCH: "${elProd.name}" - ${mismatches.map(m => m.field).join(', ')}`);
        } else {
          okCount++;
        }
      }
    }
    
    log('cyan', '\n📊', `RESUMO PRODUTOS:`);
    log('green', '  ✅', `OK: ${okCount}`);
    log('red', '  ❌', `Missing: ${missingCount}`);
    log('yellow', '  ⚠️', `Mismatch: ${mismatchCount}`);
    
    if (this.report.products.duplicates.length > 0) {
      log('red', '🔴', `DUPLICATAS DE SKU: ${this.report.products.duplicates.length}`);
    }
  }

  // ==================== SYNC QUEUE ====================
  async auditSyncQueue() {
    log('blue', '\n📋', '=== AUDITORIA DA FILA DE SYNC ===');
    
    // Verificar fila de sync do Electron
    try {
      const pending = this.electronDb.prepare(`
        SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at
      `).all();
      
      const failed = this.electronDb.prepare(`
        SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 50
      `).all();
      
      const stats = this.electronDb.prepare(`
        SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status
      `).all();
      
      this.report.syncQueue.pending = pending;
      this.report.syncQueue.failed = failed;
      
      log('cyan', '📊', 'Status da fila de sync:');
      for (const stat of stats) {
        const color = stat.status === 'pending' ? 'yellow' : stat.status === 'failed' ? 'red' : 'green';
        log(color, '  •', `${stat.status}: ${stat.count}`);
      }
      
      if (failed.length > 0) {
        log('red', '\n❌', 'ITENS FALHADOS RECENTES:');
        for (const item of failed.slice(0, 10)) {
          log('red', '  •', `${item.entity}/${item.operation} - ${item.entity_id}`);
          log('red', '   ', `  Erro: ${item.error_message || 'N/A'}`);
        }
      }
      
      // Agrupar pendentes por entidade
      const pendingByEntity = {};
      for (const item of pending) {
        pendingByEntity[item.entity] = (pendingByEntity[item.entity] || 0) + 1;
      }
      
      if (Object.keys(pendingByEntity).length > 0) {
        log('yellow', '\n⏳', 'PENDENTES POR ENTIDADE:');
        for (const [entity, count] of Object.entries(pendingByEntity)) {
          log('yellow', '  •', `${entity}: ${count}`);
        }
      }
      
    } catch (error) {
      log('red', '❌', `Erro ao auditar sync_queue: ${error.message}`);
    }
  }

  // ==================== ANÁLISE DE DEPENDÊNCIAS ====================
  async analyzeFailedDependencies() {
    log('blue', '\n🔗', '=== ANÁLISE DE DEPENDÊNCIAS QUEBRADAS ===');
    
    // Verificar produtos com categoryId ou supplierId inválidos
    const productsWithInvalidCategory = this.electronDb.prepare(`
      SELECT p.id, p.name, p.category_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id IS NOT NULL AND c.id IS NULL
    `).all();
    
    const productsWithInvalidSupplier = this.electronDb.prepare(`
      SELECT p.id, p.name, p.supplier_id
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.supplier_id IS NOT NULL AND s.id IS NULL
    `).all();
    
    if (productsWithInvalidCategory.length > 0) {
      log('red', '❌', `Produtos com categoryId inválido: ${productsWithInvalidCategory.length}`);
      for (const p of productsWithInvalidCategory.slice(0, 5)) {
        log('red', '  •', `"${p.name}" - categoryId: ${p.category_id}`);
      }
    }
    
    if (productsWithInvalidSupplier.length > 0) {
      log('red', '❌', `Produtos com supplierId inválido: ${productsWithInvalidSupplier.length}`);
      for (const p of productsWithInvalidSupplier.slice(0, 5)) {
        log('red', '  •', `"${p.name}" - supplierId: ${p.supplier_id}`);
      }
    }
    
    if (productsWithInvalidCategory.length === 0 && productsWithInvalidSupplier.length === 0) {
      log('green', '✅', 'Nenhuma dependência quebrada encontrada');
    }
  }

  // ==================== GERAR RELATÓRIO ====================
  generateSummary() {
    this.report.summary = {
      categories: {
        electron: this.report.categories.electron.length,
        railway: this.report.categories.railway.length,
        missing: this.report.categories.missing.length,
        duplicates: this.report.categories.duplicates.length,
        mismatches: this.report.categories.mismatches.length,
      },
      suppliers: {
        electron: this.report.suppliers.electron.length,
        railway: this.report.suppliers.railway.length,
        missing: this.report.suppliers.missing.length,
        duplicates: this.report.suppliers.duplicates.length,
        mismatches: this.report.suppliers.mismatches.length,
      },
      products: {
        electron: this.report.products.electron.length,
        railway: this.report.products.railway.length,
        missing: this.report.products.missing.length,
        duplicates: this.report.products.duplicates.length,
        mismatches: this.report.products.mismatches.length,
      },
      syncQueue: {
        pending: this.report.syncQueue.pending.length,
        failed: this.report.syncQueue.failed.length,
      },
      errors: this.report.errors.length,
    };
    
    log('magenta', '\n📊', '=== RESUMO FINAL ===');
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    AUDITORIA DE SYNC                        │');
    console.log('├─────────────┬──────────┬─────────┬─────────┬────────┬───────┤');
    console.log('│ Entidade    │ Electron │ Railway │ Missing │ Duplic │ Diff  │');
    console.log('├─────────────┼──────────┼─────────┼─────────┼────────┼───────┤');
    
    const s = this.report.summary;
    console.log(`│ Categories  │ ${String(s.categories.electron).padStart(8)} │ ${String(s.categories.railway).padStart(7)} │ ${String(s.categories.missing).padStart(7)} │ ${String(s.categories.duplicates).padStart(6)} │ ${String(s.categories.mismatches).padStart(5)} │`);
    console.log(`│ Suppliers   │ ${String(s.suppliers.electron).padStart(8)} │ ${String(s.suppliers.railway).padStart(7)} │ ${String(s.suppliers.missing).padStart(7)} │ ${String(s.suppliers.duplicates).padStart(6)} │ ${String(s.suppliers.mismatches).padStart(5)} │`);
    console.log(`│ Products    │ ${String(s.products.electron).padStart(8)} │ ${String(s.products.railway).padStart(7)} │ ${String(s.products.missing).padStart(7)} │ ${String(s.products.duplicates).padStart(6)} │ ${String(s.products.mismatches).padStart(5)} │`);
    
    console.log('├─────────────┴──────────┴─────────┴─────────┴────────┴───────┤');
    console.log(`│ Sync Queue: ${s.syncQueue.pending} pendentes, ${s.syncQueue.failed} falhados                       │`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    // Veredicto
    const hasProblems = s.categories.missing > 0 || s.suppliers.missing > 0 || s.products.missing > 0 ||
                        s.categories.duplicates > 0 || s.suppliers.duplicates > 0 || s.products.duplicates > 0 ||
                        s.syncQueue.failed > 0;
    
    console.log('');
    if (hasProblems) {
      log('red', '🔴', 'VEREDICTO: PROBLEMAS DE SINCRONIZAÇÃO DETECTADOS');
      
      if (s.products.missing > 0) {
        log('red', '  ❌', `${s.products.missing} produtos do Electron NÃO EXISTEM no Railway`);
      }
      if (s.categories.duplicates > 0) {
        log('red', '  ❌', `${s.categories.duplicates} categorias DUPLICADAS no Railway`);
      }
      if (s.syncQueue.failed > 0) {
        log('red', '  ❌', `${s.syncQueue.failed} itens FALHARAM na sincronização`);
      }
    } else {
      log('green', '🟢', 'VEREDICTO: SINCRONIZAÇÃO OK - Todos os dados coincidem');
    }
    
    return this.report;
  }

  async saveReport() {
    const reportPath = path.join(__dirname, `sync-audit-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    log('cyan', '💾', `Relatório salvo em: ${reportPath}`);
  }

  close() {
    if (this.electronDb) {
      this.electronDb.close();
    }
  }
}

// Executar
async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     🔍 AUDITORIA COMPLETA DE SINCRONIZAÇÃO                    ║');
  console.log('║     Electron × Railway × Mobile                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const auditor = new SyncAuditor();
  
  try {
    await auditor.init();
    await auditor.auditCategories();
    await auditor.auditSuppliers();
    await auditor.auditProducts();
    await auditor.auditSyncQueue();
    await auditor.analyzeFailedDependencies();
    auditor.generateSummary();
    await auditor.saveReport();
  } catch (error) {
    log('red', '❌', `Erro fatal: ${error.message}`);
    console.error(error);
  } finally {
    auditor.close();
  }
}

main();
