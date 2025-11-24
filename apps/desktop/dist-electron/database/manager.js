"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DatabaseManager {
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    async initialize() {
        this.db = new better_sqlite3_1.default(this.dbPath, { verbose: console.log });
        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');
        await this.createTables();
        await this.runMigrations();
    }
    async createTables() {
        // Tabelas principais offline-first
        this.db.exec(`
      -- Products (cache local)
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        name_kriol TEXT,
        name_fr TEXT,
        category_id TEXT,
        price_unit INTEGER NOT NULL,
        price_box INTEGER,
        cost_unit INTEGER NOT NULL,
        cost_box INTEGER,
        units_per_box INTEGER DEFAULT 1,
        box_enabled BOOLEAN DEFAULT 0,
        track_inventory BOOLEAN DEFAULT 1,
        low_stock_alert INTEGER DEFAULT 10,
        is_muntu_eligible BOOLEAN DEFAULT 1,
        min_margin_percent REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Inventory (local)
      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        qty_units INTEGER DEFAULT 0,
        batch_number TEXT,
        expiry_date DATETIME,
        location TEXT,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(product_id, branch_id, batch_number)
      );

      -- Sales (offline-first, fila de sincronização)
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        sale_number TEXT UNIQUE NOT NULL,
        branch_id TEXT NOT NULL,
        type TEXT DEFAULT 'counter',
        table_id TEXT,
        customer_id TEXT,
        cashier_id TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        subtotal INTEGER DEFAULT 0,
        tax_total INTEGER DEFAULT 0,
        discount_total INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        muntu_savings INTEGER DEFAULT 0,
        notes TEXT,
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        synced BOOLEAN DEFAULT 0,
        sync_priority INTEGER DEFAULT 5,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sale Items
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        qty_units INTEGER NOT NULL,
        is_muntu BOOLEAN DEFAULT 0,
        unit_price INTEGER NOT NULL,
        unit_cost INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        tax_amount INTEGER DEFAULT 0,
        discount_amount INTEGER DEFAULT 0,
        total INTEGER NOT NULL,
        muntu_savings INTEGER DEFAULT 0,
        production_status TEXT DEFAULT 'pending',
        notes TEXT,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      -- Payments
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        sale_id TEXT,
        debt_id TEXT,
        method TEXT NOT NULL,
        provider TEXT,
        amount INTEGER NOT NULL,
        reference_number TEXT,
        transaction_id TEXT,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      );

      -- Cash Box
      CREATE TABLE IF NOT EXISTS cash_boxes (
        id TEXT PRIMARY KEY,
        box_number TEXT UNIQUE NOT NULL,
        branch_id TEXT NOT NULL,
        opened_by TEXT NOT NULL,
        closed_by TEXT,
        status TEXT DEFAULT 'open',
        opening_cash INTEGER DEFAULT 0,
        total_sales INTEGER DEFAULT 0,
        total_cash INTEGER DEFAULT 0,
        total_card INTEGER DEFAULT 0,
        total_mobile_money INTEGER DEFAULT 0,
        total_debt INTEGER DEFAULT 0,
        closing_cash INTEGER,
        difference INTEGER,
        notes TEXT,
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sync Queue (fila de sincronização)
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
      );

      -- Customers (cache)
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        credit_limit INTEGER DEFAULT 0,
        current_debt INTEGER DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        loyalty_points INTEGER DEFAULT 0,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tables
      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        number TEXT NOT NULL,
        seats INTEGER DEFAULT 4,
        area TEXT,
        qr_code TEXT,
        is_active BOOLEAN DEFAULT 1,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(branch_id, number)
      );

      -- Settings locais
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
      CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, priority, created_at);
      CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_items(product_id);
    `);
    }
    async runMigrations() {
        // Migrations futuras
        const migrations = [];
        migrations.forEach(migration => {
            try {
                migration();
            }
            catch (error) {
                console.error('Migration error:', error);
            }
        });
    }
    // ============================================
    // CRUD Operations
    // ============================================
    createSale(data) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO sales (id, sale_number, branch_id, type, table_id, customer_id, cashier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.saleNumber, data.branchId, data.type || 'counter', data.tableId, data.customerId, data.cashierId);
        // Adicionar à fila de sincronização
        this.addToSyncQueue('create', 'sale', id, data, 1); // Alta prioridade
        return this.getSaleById(id);
    }
    addSaleItem(saleId, itemData) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO sale_items 
      (id, sale_id, product_id, qty_units, is_muntu, unit_price, unit_cost, 
       subtotal, tax_amount, total, muntu_savings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, saleId, itemData.productId, itemData.qtyUnits, itemData.isMuntu ? 1 : 0, itemData.unitPrice, itemData.unitCost, itemData.subtotal, itemData.taxAmount, itemData.total, itemData.muntuSavings);
        // Atualizar totais da venda
        this.updateSaleTotals(saleId);
        // Deduzir estoque localmente
        this.deductInventory(itemData.productId, itemData.branchId, itemData.qtyUnits);
        // Adicionar à fila
        this.addToSyncQueue('create', 'sale_item', id, itemData, 1);
        return { id, ...itemData };
    }
    getSales(filters = {}) {
        let query = 'SELECT * FROM sales WHERE 1=1';
        const params = [];
        if (filters.branchId) {
            query += ' AND branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY created_at DESC LIMIT 100';
        return this.db.prepare(query).all(...params);
    }
    getSaleById(id) {
        const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        if (!sale)
            return null;
        const items = this.db.prepare(`
      SELECT si.*, p.name as product_name 
      FROM sale_items si 
      LEFT JOIN products p ON si.product_id = p.id 
      WHERE si.sale_id = ?
    `).all(id);
        const payments = this.db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(id);
        return { ...sale, items, payments };
    }
    getProducts(filters = {}) {
        let query = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];
        if (filters.categoryId) {
            query += ' AND category_id = ?';
            params.push(filters.categoryId);
        }
        query += ' ORDER BY name';
        return this.db.prepare(query).all(...params);
    }
    searchProducts(query) {
        return this.db.prepare(`
      SELECT * FROM products 
      WHERE is_active = 1 
        AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
      ORDER BY name
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    getInventory(filters = {}) {
        let query = `
      SELECT i.*, p.name, p.sku, p.low_stock_alert
      FROM inventory_items i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.branchId) {
            query += ' AND i.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.lowStock) {
            query += ' AND i.qty_units <= p.low_stock_alert';
        }
        return this.db.prepare(query).all(...params);
    }
    updateInventory(productId, quantity, reason) {
        const stmt = this.db.prepare(`
      UPDATE inventory_items 
      SET qty_units = qty_units + ?, 
          updated_at = CURRENT_TIMESTAMP,
          synced = 0
      WHERE product_id = ?
    `);
        stmt.run(quantity, productId);
        this.addToSyncQueue('update', 'inventory', productId, { quantity, reason }, 2);
    }
    deductInventory(productId, branchId, qtyUnits) {
        this.db.prepare(`
      UPDATE inventory_items 
      SET qty_units = qty_units - ?,
          updated_at = CURRENT_TIMESTAMP,
          synced = 0
      WHERE product_id = ? AND branch_id = ?
    `).run(qtyUnits, productId, branchId);
    }
    updateSaleTotals(saleId) {
        this.db.exec(`
      UPDATE sales 
      SET subtotal = (SELECT SUM(subtotal) FROM sale_items WHERE sale_id = '${saleId}'),
          tax_total = (SELECT SUM(tax_amount) FROM sale_items WHERE sale_id = '${saleId}'),
          total = (SELECT SUM(total) FROM sale_items WHERE sale_id = '${saleId}'),
          muntu_savings = (SELECT SUM(muntu_savings) FROM sale_items WHERE sale_id = '${saleId}'),
          updated_at = CURRENT_TIMESTAMP,
          synced = 0
      WHERE id = '${saleId}'
    `);
    }
    openCashBox(data) {
        const id = this.generateUUID();
        this.db.prepare(`
      INSERT INTO cash_boxes (id, box_number, branch_id, opened_by, opening_cash)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.boxNumber, data.branchId, data.openedBy, data.openingCash || 0);
        this.addToSyncQueue('create', 'cash_box', id, data, 2);
        return { id, ...data };
    }
    closeCashBox(cashBoxId, closingData) {
        this.db.prepare(`
      UPDATE cash_boxes 
      SET status = 'closed',
          closed_at = CURRENT_TIMESTAMP,
          closing_cash = ?,
          difference = ?,
          closed_by = ?,
          notes = ?,
          synced = 0
      WHERE id = ?
    `).run(closingData.closingCash, closingData.difference, closingData.closedBy, closingData.notes, cashBoxId);
        this.addToSyncQueue('update', 'cash_box', cashBoxId, closingData, 1);
    }
    getCurrentCashBox() {
        return this.db.prepare(`
      SELECT * FROM cash_boxes 
      WHERE status = 'open' 
      ORDER BY opened_at DESC 
      LIMIT 1
    `).get();
    }
    // ============================================
    // Sync Queue
    // ============================================
    addToSyncQueue(operation, entity, entityId, data, priority = 5) {
        const id = this.generateUUID();
        this.db.prepare(`
      INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, operation, entity, entityId, JSON.stringify(data), priority);
    }
    getPendingSyncItems() {
        return this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending' 
      ORDER BY priority ASC, created_at ASC
      LIMIT 100
    `).all();
    }
    markSyncItemCompleted(id) {
        this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'completed', processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
    }
    markSyncItemFailed(id, error) {
        this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'failed', retry_count = retry_count + 1, last_error = ? 
      WHERE id = ?
    `).run(error, id);
    }
    // ============================================
    // Reports
    // ============================================
    getSalesReport(startDate, endDate, branchId) {
        let query = `
      SELECT 
        DATE(opened_at) as date,
        COUNT(*) as total_sales,
        SUM(total) as total_amount,
        SUM(muntu_savings) as total_savings
      FROM sales
      WHERE status = 'closed'
        AND opened_at BETWEEN ? AND ?
    `;
        const params = [startDate, endDate];
        if (branchId) {
            query += ' AND branch_id = ?';
            params.push(branchId);
        }
        query += ' GROUP BY DATE(opened_at) ORDER BY date DESC';
        return this.db.prepare(query).all(...params);
    }
    getInventoryReport(branchId) {
        let query = `
      SELECT 
        p.name,
        p.sku,
        i.qty_units,
        p.low_stock_alert,
        CASE 
          WHEN i.qty_units <= p.low_stock_alert THEN 'low'
          ELSE 'ok'
        END as status
      FROM inventory_items i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE 1=1
    `;
        const params = [];
        if (branchId) {
            query += ' AND i.branch_id = ?';
            params.push(branchId);
        }
        return this.db.prepare(query).all(...params);
    }
    // ============================================
    // Backup / Restore
    // ============================================
    createBackup(backupDir) {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const backupFile = path.join(backupDir, `barmanager-backup-${timestamp}.db`);
        this.db.backup(backupFile).then(() => {
            console.log('Backup created:', backupFile);
        });
        return backupFile;
    }
    restoreBackup(backupFile) {
        if (!fs.existsSync(backupFile)) {
            throw new Error('Backup file not found');
        }
        this.db.close();
        fs.copyFileSync(backupFile, this.dbPath);
        this.db = new better_sqlite3_1.default(this.dbPath);
        return { success: true };
    }
    // ============================================
    // Utilities
    // ============================================
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=manager.js.map