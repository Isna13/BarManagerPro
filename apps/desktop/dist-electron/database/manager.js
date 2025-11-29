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
        await this.seedInitialData();
    }
    async createTables() {
        // Tabelas principais offline-first
        this.db.exec(`
      -- Categories (cache local)
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Branches (filiais)
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        address TEXT,
        phone TEXT,
        is_main BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Users (usuários do sistema)
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier',
        branch_id TEXT,
        phone TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_login DATETIME,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      -- Inventory (estoque local)
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        quantity_units INTEGER DEFAULT 0,
        quantity_boxes INTEGER DEFAULT 0,
        min_stock_units INTEGER DEFAULT 0,
        last_count_date DATETIME,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id),
        UNIQUE(product_id, branch_id)
      );

      -- Suppliers (fornecedores)
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        tax_id TEXT,
        payment_terms TEXT,
        notes TEXT,
        is_active BOOLEAN DEFAULT 1,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Products (cache local)
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        barcode TEXT UNIQUE,
        name TEXT NOT NULL,
        name_kriol TEXT,
        name_fr TEXT,
        category_id TEXT,
        supplier_id TEXT,
        price_unit INTEGER NOT NULL,
        price_box INTEGER,
        cost_unit INTEGER NOT NULL,
        cost_box INTEGER,
        units_per_box INTEGER DEFAULT 1,
        box_enabled BOOLEAN DEFAULT 0,
        track_inventory BOOLEAN DEFAULT 1,
        low_stock_alert INTEGER DEFAULT 10,
        is_muntu_eligible BOOLEAN DEFAULT 1,
        muntu_quantity INTEGER DEFAULT NULL,
        muntu_price INTEGER DEFAULT NULL,
        min_margin_percent REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        dose_enabled BOOLEAN DEFAULT 0,
        doses_per_bottle INTEGER DEFAULT 0,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );

      -- Inventory (local)
      CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        qty_units INTEGER DEFAULT 0,
        closed_boxes INTEGER DEFAULT 0,
        open_box_units INTEGER DEFAULT 0,
        batch_number TEXT,
        expiry_date DATETIME,
        location TEXT,
        consumption_avg_7d REAL DEFAULT 0,
        consumption_avg_15d REAL DEFAULT 0,
        consumption_avg_30d REAL DEFAULT 0,
        days_until_stockout INTEGER DEFAULT NULL,
        suggested_reorder INTEGER DEFAULT 0,
        synced BOOLEAN DEFAULT 0,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(product_id, branch_id, batch_number)
      );

      -- Stock Movements (auditoria de movimentações de estoque)
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        closed_boxes_before INTEGER DEFAULT 0,
        closed_boxes_after INTEGER DEFAULT 0,
        open_box_before INTEGER DEFAULT 0,
        open_box_after INTEGER DEFAULT 0,
        box_opened_automatically BOOLEAN DEFAULT 0,
        reason TEXT NOT NULL,
        responsible TEXT,
        terminal TEXT,
        sale_id TEXT,
        purchase_id TEXT,
        notes TEXT,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      -- Purchases (compras de fornecedores)
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        purchase_number TEXT UNIQUE NOT NULL,
        branch_id TEXT NOT NULL,
        supplier_id TEXT,
        status TEXT DEFAULT 'pending',
        subtotal INTEGER DEFAULT 0,
        tax_total INTEGER DEFAULT 0,
        discount_total INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        notes TEXT,
        received_by TEXT,
        received_at DATETIME,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      -- Purchase Items
      CREATE TABLE IF NOT EXISTS purchase_items (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        qty_units INTEGER NOT NULL,
        unit_cost INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        tax_amount INTEGER DEFAULT 0,
        discount_amount INTEGER DEFAULT 0,
        total INTEGER NOT NULL,
        batch_number TEXT,
        expiry_date DATETIME,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
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

      -- Debts (Dívidas/Vales)
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        debt_number TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        sale_id TEXT,
        branch_id TEXT NOT NULL,
        original_amount INTEGER NOT NULL,
        paid_amount INTEGER DEFAULT 0,
        balance INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        due_date DATE,
        notes TEXT,
        created_by TEXT,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (branch_id) REFERENCES branches(id)
      );

      -- Debt Payments (Pagamentos de Dívidas)
      CREATE TABLE IF NOT EXISTS debt_payments (
        id TEXT PRIMARY KEY,
        debt_id TEXT NOT NULL,
        payment_id TEXT,
        amount INTEGER NOT NULL,
        method TEXT NOT NULL,
        reference TEXT,
        notes TEXT,
        received_by TEXT,
        synced BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id)
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
      CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
      CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, priority, created_at);    
      CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_debts_customer ON debts(customer_id);
      CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
      CREATE INDEX IF NOT EXISTS idx_debts_branch ON debts(branch_id);
      CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
    `);
    }
    async runMigrations() {
        // Migration 1: Adicionar campo supplier_id à tabela products
        try {
            const tableInfo = this.db.pragma('table_info(products)');
            const hasSupplierColumn = tableInfo.some((col) => col.name === 'supplier_id');
            if (!hasSupplierColumn) {
                console.log('Executando migration: adicionando coluna supplier_id em products...');
                this.db.exec('ALTER TABLE products ADD COLUMN supplier_id TEXT');
                this.db.exec('CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id)');
                console.log('✅ Migration supplier_id concluída!');
            }
        }
        catch (error) {
            console.error('Erro na migration supplier_id:', error);
        }
        // Migration 2: Adicionar colunas dose_enabled e doses_per_bottle
        try {
            const tableInfo = this.db.pragma('table_info(products)');
            const hasDoseEnabled = tableInfo.some((col) => col.name === 'dose_enabled');
            if (!hasDoseEnabled) {
                console.log('Executando migration: adicionando colunas de dose em products...');
                this.db.exec('ALTER TABLE products ADD COLUMN dose_enabled BOOLEAN DEFAULT 0');
                this.db.exec('ALTER TABLE products ADD COLUMN doses_per_bottle INTEGER DEFAULT 0');
                console.log('✅ Migration dose columns concluída!');
            }
        }
        catch (error) {
            console.error('Erro na migration dose columns:', error);
        }
        // Migration 3: Adicionar colunas avançadas de inventário
        try {
            const invTableInfo = this.db.pragma('table_info(inventory_items)');
            const hasClosedBoxes = invTableInfo.some((col) => col.name === 'closed_boxes');
            if (!hasClosedBoxes) {
                console.log('Executando migration: adicionando colunas avançadas em inventory_items...');
                this.db.exec(`
          ALTER TABLE inventory_items ADD COLUMN closed_boxes INTEGER DEFAULT 0;
          ALTER TABLE inventory_items ADD COLUMN open_box_units INTEGER DEFAULT 0;
          ALTER TABLE inventory_items ADD COLUMN consumption_avg_7d REAL DEFAULT 0;
          ALTER TABLE inventory_items ADD COLUMN consumption_avg_15d REAL DEFAULT 0;
          ALTER TABLE inventory_items ADD COLUMN consumption_avg_30d REAL DEFAULT 0;
          ALTER TABLE inventory_items ADD COLUMN days_until_stockout INTEGER DEFAULT NULL;
          ALTER TABLE inventory_items ADD COLUMN suggested_reorder INTEGER DEFAULT 0;
        `);
                console.log('✅ Migration inventory advanced columns concluída!');
            }
        }
        catch (error) {
            console.error('Erro na migration inventory advanced:', error);
        }
        // Migration 4: Criar tabela stock_movements se não existir
        try {
            const tables = this.db.pragma('table_list');
            const hasStockMovements = tables.some((t) => t.name === 'stock_movements');
            if (!hasStockMovements) {
                console.log('Executando migration: criando tabela stock_movements...');
                this.db.exec(`
          CREATE TABLE IF NOT EXISTS stock_movements (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            branch_id TEXT NOT NULL,
            type TEXT NOT NULL,
            qty_before INTEGER NOT NULL,
            qty_after INTEGER NOT NULL,
            qty_changed INTEGER NOT NULL,
            closed_boxes_before INTEGER DEFAULT 0,
            closed_boxes_after INTEGER DEFAULT 0,
            open_box_units_before INTEGER DEFAULT 0,
            open_box_units_after INTEGER DEFAULT 0,
            reason TEXT NOT NULL,
            reference_type TEXT,
            reference_id TEXT,
            responsible TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
          );
          CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
          CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
          CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
        `);
                console.log('✅ Migration stock_movements table concluída!');
            }
        }
        catch (error) {
            console.error('Erro na migration stock_movements:', error);
        }
        // Migration 5: Migrar dados de inventory para inventory_items
        try {
            // Verificar se existem dados na tabela antiga
            const oldInventoryCount = this.db.prepare('SELECT COUNT(*) as count FROM inventory').get();
            const newInventoryCount = this.db.prepare('SELECT COUNT(*) as count FROM inventory_items').get();
            if (oldInventoryCount.count > 0 && newInventoryCount.count === 0) {
                console.log('Executando migration: migrando dados de inventory para inventory_items...');
                // Buscar todos os registros da tabela antiga com informações do produto
                const oldInventory = this.db.prepare(`
          SELECT 
            i.id,
            i.product_id,
            i.branch_id,
            i.quantity_units,
            i.quantity_boxes,
            i.min_stock_units,
            i.created_at,
            i.updated_at,
            p.units_per_box
          FROM inventory i
          LEFT JOIN products p ON i.product_id = p.id
        `).all();
                console.log(`Migrando ${oldInventory.length} registros de estoque...`);
                const insertStmt = this.db.prepare(`
          INSERT INTO inventory_items (
            id, product_id, branch_id, qty_units, 
            closed_boxes, open_box_units,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
                for (const item of oldInventory) {
                    const unitsPerBox = item.units_per_box || 1;
                    const totalUnits = (item.quantity_boxes * unitsPerBox) + item.quantity_units;
                    // Calcular caixas fechadas e unidades avulsas
                    const closedBoxes = item.quantity_boxes || 0;
                    const openBoxUnits = item.quantity_units || 0;
                    insertStmt.run(item.id, item.product_id, item.branch_id, totalUnits, closedBoxes, openBoxUnits, item.created_at, item.updated_at);
                }
                console.log(`✅ Migration de ${oldInventory.length} registros concluída!`);
            }
            else if (newInventoryCount.count > 0) {
                console.log('Dados já existem em inventory_items, pulando migração de dados.');
            }
        }
        catch (error) {
            console.error('Erro na migration de dados de inventory:', error);
        }
        // Migration 8: Corrigir valores de closed_boxes e open_box_units no estoque
        try {
            console.log('\nVerificando necessidade de correção de estoque (caixas/unidades)...');
            const inventoryItems = this.db.prepare(`
        SELECT i.id, i.product_id, i.qty_units, i.closed_boxes, i.open_box_units, p.units_per_box
        FROM inventory_items i
        INNER JOIN products p ON i.product_id = p.id
        WHERE i.qty_units > 0
      `).all();
            let corrected = 0;
            for (const item of inventoryItems) {
                const unitsPerBox = item.units_per_box || 1;
                const correctClosedBoxes = Math.floor(item.qty_units / unitsPerBox);
                const correctOpenBoxUnits = item.qty_units % unitsPerBox;
                // Só corrigir se os valores estiverem incorretos
                if (item.closed_boxes !== correctClosedBoxes || item.open_box_units !== correctOpenBoxUnits) {
                    this.db.prepare(`
            UPDATE inventory_items
            SET closed_boxes = ?,
                open_box_units = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(correctClosedBoxes, correctOpenBoxUnits, item.id);
                    corrected++;
                    console.log(`   ✅ Corrigido: ${item.qty_units} unidades → ${correctClosedBoxes} caixas + ${correctOpenBoxUnits} avulsas`);
                }
            }
            if (corrected > 0) {
                console.log(`✅ Correção de estoque concluída: ${corrected} registros atualizados!`);
            }
            else {
                console.log('✅ Estoque já está correto, nenhuma correção necessária.');
            }
        }
        catch (error) {
            console.error('Erro na correção de estoque:', error);
        }
        // Migration 9: Garantir que todos os clientes tenham loyalty_points = 0
        try {
            console.log('\nVerificando pontos de fidelidade dos clientes...');
            const result = this.db.prepare(`
        UPDATE customers 
        SET loyalty_points = 0 
        WHERE loyalty_points IS NULL
      `).run();
            if (result.changes > 0) {
                console.log(`✅ ${result.changes} cliente(s) atualizados com loyalty_points = 0`);
            }
            else {
                console.log('✅ Todos os clientes já possuem loyalty_points definido.');
            }
        }
        catch (error) {
            console.error('Erro na migration de loyalty_points:', error);
        }
        // Migration 10: Criar tabelas para sistema de gestão de mesas
        try {
            console.log('\nCriando tabelas para sistema de gestão de mesas...');
            this.db.exec(`
        -- Table Sessions (Sessões de Mesa)
        CREATE TABLE IF NOT EXISTS table_sessions (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          session_number TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'open', -- open, awaiting_payment, closed
          opened_by TEXT NOT NULL,
          closed_by TEXT,
          opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          closed_at DATETIME,
          total_amount INTEGER DEFAULT 0,
          paid_amount INTEGER DEFAULT 0,
          notes TEXT,
          synced BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (table_id) REFERENCES tables(id),
          FOREIGN KEY (branch_id) REFERENCES branches(id)
        );

        -- Table Customers (Clientes dentro de uma sessão de mesa)
        CREATE TABLE IF NOT EXISTS table_customers (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          customer_name TEXT NOT NULL, -- Nome do cliente (pode ser "Cliente 01", "João", etc)
          customer_id TEXT, -- Referência ao cliente cadastrado (opcional)
          order_sequence INTEGER DEFAULT 1, -- Ordem de chegada
          subtotal INTEGER DEFAULT 0,
          discount INTEGER DEFAULT 0,
          total INTEGER DEFAULT 0,
          paid_amount INTEGER DEFAULT 0,
          payment_status TEXT DEFAULT 'pending', -- pending, partial, paid
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES table_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        -- Table Orders (Pedidos individuais por cliente)
        CREATE TABLE IF NOT EXISTS table_orders (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          table_customer_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          qty_units INTEGER NOT NULL,
          is_muntu BOOLEAN DEFAULT 0,
          unit_price INTEGER NOT NULL,
          unit_cost INTEGER NOT NULL,
          subtotal INTEGER NOT NULL,
          discount INTEGER DEFAULT 0,
          total INTEGER NOT NULL,
          status TEXT DEFAULT 'pending', -- pending, preparing, served, cancelled
          notes TEXT,
          ordered_by TEXT NOT NULL, -- Usuário que fez o pedido
          ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          cancelled_at DATETIME,
          cancelled_by TEXT,
          synced BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES table_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (table_customer_id) REFERENCES table_customers(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );

        -- Table Payments (Pagamentos por cliente na mesa)
        CREATE TABLE IF NOT EXISTS table_payments (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          table_customer_id TEXT,
          payment_id TEXT, -- Referência ao pagamento global
          method TEXT NOT NULL,
          amount INTEGER NOT NULL,
          reference_number TEXT,
          status TEXT DEFAULT 'completed',
          processed_by TEXT NOT NULL,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          synced BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES table_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (table_customer_id) REFERENCES table_customers(id),
          FOREIGN KEY (payment_id) REFERENCES payments(id)
        );

        -- Table Actions (Auditoria de ações nas mesas)
        CREATE TABLE IF NOT EXISTS table_actions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          action_type TEXT NOT NULL, -- open_table, add_customer, add_order, cancel_order, transfer_item, split_item, transfer_table, payment, close_table
          performed_by TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata TEXT, -- JSON com detalhes da ação
          performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES table_sessions(id) ON DELETE CASCADE
        );

        -- Índices para performance
        CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id);
        CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_table_customers_session ON table_customers(session_id);
        CREATE INDEX IF NOT EXISTS idx_table_orders_session ON table_orders(session_id);
        CREATE INDEX IF NOT EXISTS idx_table_orders_customer ON table_orders(table_customer_id);
        CREATE INDEX IF NOT EXISTS idx_table_payments_session ON table_payments(session_id);
        CREATE INDEX IF NOT EXISTS idx_table_actions_session ON table_actions(session_id);
      `);
            console.log('✅ Tabelas de gestão de mesas criadas com sucesso!');
        }
        catch (error) {
            console.error('Erro ao criar tabelas de gestão de mesas:', error);
        }
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
        // Validar dados obrigatórios
        if (!itemData || !itemData.productId) {
            throw new Error('Dados do item inválidos: productId é obrigatório');
        }
        if (!itemData.branchId) {
            throw new Error('Dados do item inválidos: branchId é obrigatório');
        }
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
        // Deduzir estoque usando o sistema avançado com abertura automática de caixas
        // Se falhar, a exceção será propagada e a venda será cancelada
        this.deductInventoryAdvanced(itemData.productId, itemData.branchId, itemData.qtyUnits, itemData.isMuntu || false, saleId, itemData.cashierId || 'system');
        // Adicionar à fila
        this.addToSyncQueue('create', 'sale_item', id, itemData, 1);
        return { id, ...itemData };
    }
    addSalePayment(saleId, paymentData) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO payments 
      (id, sale_id, method, provider, amount, reference_number, transaction_id, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, saleId, paymentData.method || 'cash', paymentData.provider || null, paymentData.amount, paymentData.referenceNumber || null, paymentData.transactionId || null, paymentData.status || 'completed', paymentData.notes || null);
        // Atualizar status da venda para 'paid'
        this.db.prepare(`
      UPDATE sales 
      SET status = 'paid', 
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(saleId);
        // Adicionar à fila
        this.addToSyncQueue('create', 'payment', id, paymentData, 1);
        return { id, ...paymentData };
    }
    getSales(filters = {}) {
        let query = `
      SELECT 
        s.*,
        p.method as payment_method
      FROM sales s
      LEFT JOIN payments p ON s.id = p.sale_id
      WHERE 1=1
    `;
        const params = [];
        if (filters.branchId) {
            query += ' AND s.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.status) {
            query += ' AND s.status = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY s.created_at DESC LIMIT 100';
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
    createProduct(productData) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO products (
        id, sku, barcode, name, category_id, supplier_id, price_unit, price_box, cost_unit, 
        cost_box, units_per_box, box_enabled, is_muntu_eligible, muntu_quantity, 
        muntu_price, low_stock_alert, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
        stmt.run(id, productData.sku, productData.barcode || null, productData.name, productData.categoryId || null, productData.supplierId || null, productData.priceUnit, productData.priceBox || null, productData.costUnit, productData.costBox || null, productData.unitsPerBox || null, productData.priceBox ? 1 : 0, productData.isMuntuEligible ? 1 : 0, productData.muntuQuantity || null, productData.muntuPrice || null, productData.lowStockAlert || 10);
        this.addToSyncQueue('create', 'product', id, productData);
        // Criar registro inicial de inventário
        const branchId = 'main-branch'; // Filial padrão
        this.db.prepare(`
      INSERT INTO inventory (
        id, product_id, branch_id, quantity_units, quantity_boxes, 
        min_stock_units, created_at, updated_at
      )
      VALUES (?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))
    `).run(this.generateUUID(), id, branchId, productData.lowStockAlert || 10);
        return { id, ...productData };
    }
    updateProduct(id, productData) {
        const fields = [];
        const values = [];
        if (productData.sku !== undefined) {
            fields.push('sku = ?');
            values.push(productData.sku);
        }
        if (productData.barcode !== undefined) {
            fields.push('barcode = ?');
            values.push(productData.barcode);
        }
        if (productData.name !== undefined) {
            fields.push('name = ?');
            values.push(productData.name);
        }
        if (productData.categoryId !== undefined) {
            fields.push('category_id = ?');
            values.push(productData.categoryId);
        }
        if (productData.supplierId !== undefined) {
            fields.push('supplier_id = ?');
            values.push(productData.supplierId);
        }
        if (productData.priceUnit !== undefined) {
            fields.push('price_unit = ?');
            values.push(productData.priceUnit);
        }
        if (productData.priceBox !== undefined) {
            fields.push('price_box = ?');
            values.push(productData.priceBox);
        }
        if (productData.costUnit !== undefined) {
            fields.push('cost_unit = ?');
            values.push(productData.costUnit);
        }
        if (productData.costBox !== undefined) {
            fields.push('cost_box = ?');
            values.push(productData.costBox);
        }
        if (productData.unitsPerBox !== undefined) {
            fields.push('units_per_box = ?');
            values.push(productData.unitsPerBox);
            fields.push('box_enabled = ?');
            values.push(productData.unitsPerBox ? 1 : 0);
        }
        if (productData.isMuntuEligible !== undefined) {
            fields.push('is_muntu_eligible = ?');
            values.push(productData.isMuntuEligible ? 1 : 0);
        }
        if (productData.muntuQuantity !== undefined) {
            fields.push('muntu_quantity = ?');
            values.push(productData.muntuQuantity);
        }
        if (productData.muntuPrice !== undefined) {
            fields.push('muntu_price = ?');
            values.push(productData.muntuPrice);
        }
        if (productData.lowStockAlert !== undefined) {
            fields.push('low_stock_alert = ?');
            values.push(productData.lowStockAlert);
        }
        if (productData.isActive !== undefined) {
            fields.push('is_active = ?');
            values.push(productData.isActive ? 1 : 0);
        }
        fields.push('updated_at = datetime(\'now\')');
        fields.push('synced = 0');
        values.push(id);
        const stmt = this.db.prepare(`
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        this.addToSyncQueue('update', 'product', id, productData);
        return { id, ...productData };
    }
    getProductById(id) {
        return this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    }
    // ============================================
    // Categories
    // ============================================
    getCategories(filters = {}) {
        let query = 'SELECT * FROM categories WHERE is_active = 1';
        const params = [];
        if (filters.parentId !== undefined) {
            if (filters.parentId === null) {
                query += ' AND parent_id IS NULL';
            }
            else {
                query += ' AND parent_id = ?';
                params.push(filters.parentId);
            }
        }
        query += ' ORDER BY sort_order, name';
        return this.db.prepare(query).all(...params);
    }
    createCategory(categoryData) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO categories (id, name, description, parent_id, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
        stmt.run(id, categoryData.name, categoryData.description || null, categoryData.parentId || null, categoryData.sortOrder || 0);
        this.addToSyncQueue('create', 'category', id, categoryData);
        return { id, ...categoryData };
    }
    updateCategory(id, categoryData) {
        const fields = [];
        const values = [];
        if (categoryData.name !== undefined) {
            fields.push('name = ?');
            values.push(categoryData.name);
        }
        if (categoryData.description !== undefined) {
            fields.push('description = ?');
            values.push(categoryData.description);
        }
        if (categoryData.parentId !== undefined) {
            fields.push('parent_id = ?');
            values.push(categoryData.parentId);
        }
        if (categoryData.sortOrder !== undefined) {
            fields.push('sort_order = ?');
            values.push(categoryData.sortOrder);
        }
        fields.push('updated_at = datetime(\'now\')');
        fields.push('synced = 0');
        values.push(id);
        const stmt = this.db.prepare(`
      UPDATE categories 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        this.addToSyncQueue('update', 'category', id, categoryData);
        return { id, ...categoryData };
    }
    deleteCategory(id) {
        // Verificar se há produtos usando esta categoria
        const productsCount = this.db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id);
        if (productsCount.count > 0) {
            throw new Error('Não é possível deletar categoria com produtos associados');
        }
        this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
        this.addToSyncQueue('delete', 'category', id, {});
        return { success: true };
    }
    // ============================================
    // Suppliers (Fornecedores)
    // ============================================
    getSuppliers() {
        return this.db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name').all();
    }
    createSupplier(supplierData) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO suppliers (
        id, code, name, contact_person, phone, email, address, 
        tax_id, payment_terms, notes, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
        stmt.run(id, supplierData.code, supplierData.name, supplierData.contactPerson || null, supplierData.phone || null, supplierData.email || null, supplierData.address || null, supplierData.taxId || null, supplierData.paymentTerms || null, supplierData.notes || null);
        this.addToSyncQueue('create', 'supplier', id, supplierData);
        return { id, ...supplierData };
    }
    updateSupplier(id, supplierData) {
        const fields = [];
        const values = [];
        if (supplierData.code !== undefined) {
            fields.push('code = ?');
            values.push(supplierData.code);
        }
        if (supplierData.name !== undefined) {
            fields.push('name = ?');
            values.push(supplierData.name);
        }
        if (supplierData.contactPerson !== undefined) {
            fields.push('contact_person = ?');
            values.push(supplierData.contactPerson);
        }
        if (supplierData.phone !== undefined) {
            fields.push('phone = ?');
            values.push(supplierData.phone);
        }
        if (supplierData.email !== undefined) {
            fields.push('email = ?');
            values.push(supplierData.email);
        }
        if (supplierData.address !== undefined) {
            fields.push('address = ?');
            values.push(supplierData.address);
        }
        if (supplierData.taxId !== undefined) {
            fields.push('tax_id = ?');
            values.push(supplierData.taxId);
        }
        if (supplierData.paymentTerms !== undefined) {
            fields.push('payment_terms = ?');
            values.push(supplierData.paymentTerms);
        }
        if (supplierData.notes !== undefined) {
            fields.push('notes = ?');
            values.push(supplierData.notes);
        }
        if (supplierData.isActive !== undefined) {
            fields.push('is_active = ?');
            values.push(supplierData.isActive ? 1 : 0);
        }
        fields.push('updated_at = datetime(\'now\')');
        fields.push('synced = 0');
        values.push(id);
        const stmt = this.db.prepare(`
      UPDATE suppliers 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        this.addToSyncQueue('update', 'supplier', id, supplierData);
        return this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    }
    deleteSupplier(id) {
        // Soft delete
        this.db.prepare('UPDATE suppliers SET is_active = 0, synced = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
        this.addToSyncQueue('delete', 'supplier', id, {});
        return { success: true };
    }
    // ============================================
    // Purchases (Compras)
    // ============================================
    getPurchases(filters = {}) {
        let query = `
      SELECT p.*, s.name as supplier_name 
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.branchId) {
            query += ' AND p.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.supplierId) {
            query += ' AND p.supplier_id = ?';
            params.push(filters.supplierId);
        }
        if (filters.status) {
            query += ' AND p.status = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY p.created_at DESC LIMIT 100';
        return this.db.prepare(query).all(...params);
    }
    getPurchaseById(id) {
        const purchase = this.db.prepare(`
      SELECT p.*
      FROM purchases p
      WHERE p.id = ?
    `).get(id);
        if (!purchase)
            return null;
        // Buscar informações do fornecedor
        const supplier = this.db.prepare(`
      SELECT id, name, code, phone, email
      FROM suppliers
      WHERE id = ?
    `).get(purchase.supplier_id);
        // Buscar itens da compra
        const items = this.db.prepare(`
      SELECT pi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `).all(id);
        return {
            ...purchase,
            supplier: supplier || { name: 'N/A', code: 'N/A' },
            items
        };
    }
    createPurchase(purchaseData) {
        const id = this.generateUUID();
        const purchaseNumber = this.generatePurchaseNumber();
        const stmt = this.db.prepare(`
      INSERT INTO purchases (
        id, purchase_number, branch_id, supplier_id, status, 
        payment_method, payment_status, notes, received_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
        stmt.run(id, purchaseNumber, purchaseData.branchId, purchaseData.supplierId || null, purchaseData.status || 'pending', purchaseData.paymentMethod || null, purchaseData.paymentStatus || 'pending', purchaseData.notes || null, purchaseData.receivedBy || null);
        this.addToSyncQueue('create', 'purchase', id, purchaseData);
        return { id, purchaseNumber };
    }
    addPurchaseItem(purchaseId, itemData) {
        const id = this.generateUUID();
        const stmt = this.db.prepare(`
      INSERT INTO purchase_items (
        id, purchase_id, product_id, qty_units, unit_cost, 
        subtotal, tax_amount, total, batch_number, expiry_date, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
        stmt.run(id, purchaseId, itemData.productId, itemData.qtyUnits, itemData.unitCost, itemData.subtotal, itemData.taxAmount || 0, itemData.total, itemData.batchNumber || null, itemData.expiryDate || null);
        // Atualizar totais da compra
        this.updatePurchaseTotals(purchaseId);
        // Adicionar à fila de sincronização
        this.addToSyncQueue('create', 'purchase_item', id, itemData, 1);
        return { id, ...itemData };
    }
    completePurchase(purchaseId, receivedBy) {
        // Atualizar status da compra
        this.db.prepare(`
      UPDATE purchases 
      SET status = 'completed', 
          received_by = ?,
          received_at = datetime('now'),
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(receivedBy, purchaseId);
        // Obter itens da compra
        const items = this.db.prepare(`
      SELECT product_id, qty_units, batch_number, expiry_date
      FROM purchase_items
      WHERE purchase_id = ?
    `).all(purchaseId);
        // Obter branch_id da compra
        const purchase = this.db.prepare('SELECT branch_id FROM purchases WHERE id = ?').get(purchaseId);
        // Atualizar estoque para cada item
        items.forEach((item) => {
            this.addInventory(item.product_id, purchase.branch_id, item.qty_units, item.batch_number, item.expiry_date);
        });
        this.addToSyncQueue('update', 'purchase', purchaseId, { status: 'completed', receivedBy });
        return { success: true };
    }
    updatePurchaseTotals(purchaseId) {
        const totals = this.db.prepare(`
      SELECT 
        SUM(subtotal) as subtotal,
        SUM(tax_amount) as tax_total,
        SUM(total) as total
      FROM purchase_items
      WHERE purchase_id = ?
    `).get(purchaseId);
        this.db.prepare(`
      UPDATE purchases
      SET subtotal = ?,
          tax_total = ?,
          total = ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(totals.subtotal || 0, totals.tax_total || 0, totals.total || 0, purchaseId);
    }
    generatePurchaseNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const count = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE DATE(created_at) = DATE('now')
    `).get();
        const sequence = (count.count + 1).toString().padStart(4, '0');
        return `CP${year}${month}${day}-${sequence}`;
    }
    getInventory(filters = {}) {
        let query = `
      SELECT 
        i.*,
        p.name as product_name,
        p.sku as product_sku,
        p.low_stock_alert,
        p.units_per_box,
        p.dose_enabled,
        p.doses_per_bottle,
        p.cost_unit as cost_price,
        p.price_unit as sale_price,
        ((i.closed_boxes * p.units_per_box) + i.open_box_units) as total_bottles
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
        if (filters.outOfStock) {
            query += ' AND i.qty_units = 0';
        }
        query += ' ORDER BY p.name ASC';
        return this.db.prepare(query).all(...params);
    }
    updateInventory(productId, branchId, quantity, reason) {
        // Buscar produto para pegar units_per_box
        const product = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
        const unitsPerBox = product?.units_per_box || 1;
        // Verificar se já existe registro de estoque
        const existing = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (existing) {
            // Calcular novo total de unidades
            const newQtyUnits = existing.qty_units + quantity;
            const newClosedBoxes = Math.floor(newQtyUnits / unitsPerBox);
            const newOpenBoxUnits = newQtyUnits % unitsPerBox;
            // Atualizar existente
            this.db.prepare(`
        UPDATE inventory_items 
        SET qty_units = ?, 
            closed_boxes = ?,
            open_box_units = ?,
            updated_at = datetime('now'),
            synced = 0
        WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
      `).run(newQtyUnits, newClosedBoxes, newOpenBoxUnits, productId, branchId);
        }
        else {
            // Calcular caixas e unidades para novo registro
            const closedBoxes = Math.floor(quantity / unitsPerBox);
            const openBoxUnits = quantity % unitsPerBox;
            // Criar novo registro
            const id = this.generateUUID();
            this.db.prepare(`
        INSERT INTO inventory_items (
          id, product_id, branch_id, qty_units, closed_boxes, open_box_units,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, productId, branchId, quantity, closedBoxes, openBoxUnits);
        }
        this.addToSyncQueue('update', 'inventory', productId, { quantity, reason, branchId }, 2);
    }
    addInventory(productId, branchId, qtyUnits, batchNumber, expiryDate) {
        // Buscar produto para pegar units_per_box
        const product = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
        const unitsPerBox = product?.units_per_box || 1;
        if (batchNumber) {
            // Adicionar com lote específico
            const existing = this.db.prepare(`
        SELECT id, qty_units, closed_boxes, open_box_units 
        FROM inventory_items 
        WHERE product_id = ? AND branch_id = ? AND batch_number = ?
      `).get(productId, branchId, batchNumber);
            if (existing) {
                const closedBoxes = Math.floor(qtyUnits / unitsPerBox);
                const openBoxUnits = qtyUnits % unitsPerBox;
                this.db.prepare(`
          UPDATE inventory_items 
          SET qty_units = qty_units + ?,
              closed_boxes = closed_boxes + ?,
              open_box_units = open_box_units + ?,
              expiry_date = COALESCE(?, expiry_date),
              updated_at = datetime('now'),
              synced = 0
          WHERE id = ?
        `).run(qtyUnits, closedBoxes, openBoxUnits, expiryDate, existing.id);
            }
            else {
                const id = this.generateUUID();
                const closedBoxes = Math.floor(qtyUnits / unitsPerBox);
                const openBoxUnits = qtyUnits % unitsPerBox;
                this.db.prepare(`
          INSERT INTO inventory_items (
            id, product_id, branch_id, qty_units, closed_boxes, open_box_units,
            batch_number, expiry_date, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(id, productId, branchId, qtyUnits, closedBoxes, openBoxUnits, batchNumber, expiryDate);
            }
        }
        else {
            // Adicionar ao estoque geral (sem lote) usando sistema de caixas
            const existing = this.db.prepare(`
        SELECT id, qty_units, closed_boxes, open_box_units 
        FROM inventory_items 
        WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
      `).get(productId, branchId);
            const closedBoxes = Math.floor(qtyUnits / unitsPerBox);
            const openBoxUnits = qtyUnits % unitsPerBox;
            if (existing) {
                const qtyBefore = existing.qty_units;
                const closedBoxesBefore = existing.closed_boxes;
                const openBoxBefore = existing.open_box_units;
                this.db.prepare(`
          UPDATE inventory_items 
          SET qty_units = qty_units + ?,
              closed_boxes = closed_boxes + ?,
              open_box_units = open_box_units + ?,
              updated_at = datetime('now'),
              synced = 0
          WHERE id = ?
        `).run(qtyUnits, closedBoxes, openBoxUnits, existing.id);
                // Registrar movimento
                this.registerStockMovement({
                    productId,
                    branchId,
                    movementType: 'purchase',
                    quantity: qtyUnits,
                    quantityBefore: qtyBefore,
                    quantityAfter: qtyBefore + qtyUnits,
                    closedBoxesBefore,
                    closedBoxesAfter: closedBoxesBefore + closedBoxes,
                    openBoxBefore,
                    openBoxAfter: openBoxBefore + openBoxUnits,
                    boxOpenedAutomatically: false,
                    reason: 'Compra recebida',
                    responsible: 'system',
                });
            }
            else {
                const id = this.generateUUID();
                this.db.prepare(`
          INSERT INTO inventory_items (
            id, product_id, branch_id, qty_units, closed_boxes, open_box_units,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(id, productId, branchId, qtyUnits, closedBoxes, openBoxUnits);
                // Registrar movimento
                this.registerStockMovement({
                    productId,
                    branchId,
                    movementType: 'purchase',
                    quantity: qtyUnits,
                    quantityBefore: 0,
                    quantityAfter: qtyUnits,
                    closedBoxesBefore: 0,
                    closedBoxesAfter: closedBoxes,
                    openBoxBefore: 0,
                    openBoxAfter: openBoxUnits,
                    boxOpenedAutomatically: false,
                    reason: 'Compra inicial',
                    responsible: 'system',
                });
            }
        }
    }
    // ============================================
    // SISTEMA AVANÇADO DE ESTOQUE
    // ============================================
    /**
     * Abre uma caixa automaticamente quando necessário
     * Reduz closed_boxes em 1 e adiciona units_per_box em open_box_units
     */
    openBoxAutomatically(productId, branchId, reason, responsible, saleId) {
        // Buscar produto e estoque
        const product = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
        const inventory = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (!inventory || inventory.closed_boxes <= 0) {
            throw new Error('Não há caixas fechadas disponíveis para abrir');
        }
        const unitsPerBox = product.units_per_box || 1;
        const qtyBefore = inventory.qty_units;
        const closedBoxesBefore = inventory.closed_boxes;
        const openBoxBefore = inventory.open_box_units;
        // Atualizar estoque
        this.db.prepare(`
      UPDATE inventory_items 
      SET closed_boxes = closed_boxes - 1,
          open_box_units = open_box_units + ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(unitsPerBox, inventory.id);
        // Registrar movimento
        this.registerStockMovement({
            productId,
            branchId,
            movementType: 'box_opening',
            quantity: 0, // Não altera qty_units total
            quantityBefore: qtyBefore,
            quantityAfter: qtyBefore,
            closedBoxesBefore,
            closedBoxesAfter: closedBoxesBefore - 1,
            openBoxBefore,
            openBoxAfter: openBoxBefore + unitsPerBox,
            boxOpenedAutomatically: true,
            reason,
            responsible,
            saleId,
        });
        return {
            success: true,
            unitsAdded: unitsPerBox,
            closedBoxesRemaining: closedBoxesBefore - 1,
            openBoxUnits: openBoxBefore + unitsPerBox,
        };
    }
    /**
     * Dedução inteligente de estoque com abertura automática de caixas
     * Prioridade: open_box_units → abre caixa automaticamente → closed_boxes
     */
    deductInventoryAdvanced(productId, branchId, qtyUnits, isMuntu = false, saleId, responsible) {
        const product = this.db.prepare('SELECT units_per_box, dose_enabled, doses_per_bottle FROM products WHERE id = ?').get(productId);
        const inventory = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (!inventory) {
            throw new Error('Produto não encontrado no estoque');
        }
        // Converter doses para garrafas se necessário
        let unitsToDeduct = qtyUnits;
        if (product.dose_enabled && product.doses_per_bottle > 0) {
            unitsToDeduct = Math.ceil(qtyUnits / product.doses_per_bottle);
        }
        const totalAvailable = (inventory.closed_boxes * product.units_per_box) + inventory.open_box_units;
        if (totalAvailable < unitsToDeduct) {
            throw new Error(`Estoque insuficiente. Disponível: ${totalAvailable}, Necessário: ${unitsToDeduct}`);
        }
        let remaining = unitsToDeduct;
        let boxesOpened = 0;
        const qtyBefore = inventory.qty_units;
        const closedBoxesBefore = inventory.closed_boxes;
        const openBoxBefore = inventory.open_box_units;
        // Passo 1: Deduzir da caixa aberta primeiro
        if (inventory.open_box_units > 0) {
            const fromOpen = Math.min(inventory.open_box_units, remaining);
            this.db.prepare(`
        UPDATE inventory_items 
        SET open_box_units = open_box_units - ?,
            qty_units = qty_units - ?,
            updated_at = datetime('now'),
            synced = 0
        WHERE id = ?
      `).run(fromOpen, fromOpen, inventory.id);
            remaining -= fromOpen;
        }
        // Passo 2: Abrir caixas automaticamente se necessário
        while (remaining > 0 && inventory.closed_boxes > boxesOpened) {
            const openResult = this.openBoxAutomatically(productId, branchId, isMuntu ? 'Venda Muntu' : 'Venda unitária', responsible, saleId);
            boxesOpened++;
            // Deduzir da caixa recém aberta
            const fromNewOpen = Math.min(openResult.unitsAdded, remaining);
            this.db.prepare(`
        UPDATE inventory_items 
        SET open_box_units = open_box_units - ?,
            qty_units = qty_units - ?,
            updated_at = datetime('now'),
            synced = 0
        WHERE id = ?
      `).run(fromNewOpen, fromNewOpen, inventory.id);
            remaining -= fromNewOpen;
        }
        // Registrar movimento final de venda
        const inventoryAfter = this.db.prepare(`
      SELECT qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE id = ?
    `).get(inventory.id);
        this.registerStockMovement({
            productId,
            branchId,
            movementType: isMuntu ? 'sale_muntu' : 'sale',
            quantity: -unitsToDeduct,
            quantityBefore: qtyBefore,
            quantityAfter: inventoryAfter.qty_units,
            closedBoxesBefore,
            closedBoxesAfter: inventoryAfter.closed_boxes,
            openBoxBefore,
            openBoxAfter: inventoryAfter.open_box_units,
            boxOpenedAutomatically: boxesOpened > 0,
            reason: isMuntu ? 'Venda Muntu' : 'Venda',
            responsible,
            saleId,
            notes: boxesOpened > 0 ? `${boxesOpened} caixa(s) aberta(s) automaticamente` : undefined,
        });
        return {
            success: true,
            deducted: unitsToDeduct,
            boxesOpened,
            remainingStock: inventoryAfter.qty_units,
        };
    }
    /**
     * Registrar movimento de estoque (auditoria)
     */
    registerStockMovement(data) {
        const id = this.generateUUID();
        this.db.prepare(`
      INSERT INTO stock_movements (
        id, product_id, branch_id, movement_type, quantity,
        quantity_before, quantity_after, closed_boxes_before, closed_boxes_after,
        open_box_before, open_box_after, box_opened_automatically,
        reason, responsible, terminal, sale_id, purchase_id, notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, data.productId, data.branchId, data.movementType, data.quantity, data.quantityBefore, data.quantityAfter, data.closedBoxesBefore, data.closedBoxesAfter, data.openBoxBefore, data.openBoxAfter, data.boxOpenedAutomatically ? 1 : 0, data.reason, data.responsible || 'system', data.terminal || 'desktop', data.saleId || null, data.purchaseId || null, data.notes || null);
    }
    /**
     * Registrar perda de produto
     */
    registerLoss(productId, branchId, quantity, reason, responsible, notes) {
        const inventory = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (!inventory) {
            throw new Error('Produto não encontrado no estoque');
        }
        if (inventory.qty_units < quantity) {
            throw new Error('Quantidade de perda maior que estoque disponível');
        }
        const qtyBefore = inventory.qty_units;
        const closedBoxesBefore = inventory.closed_boxes;
        const openBoxBefore = inventory.open_box_units;
        // Deduzir da caixa aberta primeiro
        const fromOpen = Math.min(openBoxBefore, quantity);
        const fromClosed = quantity - fromOpen;
        this.db.prepare(`
      UPDATE inventory_items 
      SET open_box_units = open_box_units - ?,
          qty_units = qty_units - ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(fromOpen, quantity, inventory.id);
        this.registerStockMovement({
            productId,
            branchId,
            movementType: 'loss',
            quantity: -quantity,
            quantityBefore: qtyBefore,
            quantityAfter: qtyBefore - quantity,
            closedBoxesBefore,
            closedBoxesAfter: closedBoxesBefore,
            openBoxBefore,
            openBoxAfter: openBoxBefore - fromOpen,
            boxOpenedAutomatically: false,
            reason,
            responsible,
            notes: notes || undefined,
        });
        return { success: true, quantityLost: quantity };
    }
    /**
     * Registrar quebra de produto
     */
    registerBreakage(productId, branchId, quantity, reason, responsible, notes) {
        const inventory = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (!inventory) {
            throw new Error('Produto não encontrado no estoque');
        }
        if (inventory.qty_units < quantity) {
            throw new Error('Quantidade de quebra maior que estoque disponível');
        }
        const qtyBefore = inventory.qty_units;
        const closedBoxesBefore = inventory.closed_boxes;
        const openBoxBefore = inventory.open_box_units;
        // Deduzir da caixa aberta primeiro
        const fromOpen = Math.min(openBoxBefore, quantity);
        this.db.prepare(`
      UPDATE inventory_items 
      SET open_box_units = open_box_units - ?,
          qty_units = qty_units - ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(fromOpen, quantity, inventory.id);
        this.registerStockMovement({
            productId,
            branchId,
            movementType: 'breakage',
            quantity: -quantity,
            quantityBefore: qtyBefore,
            quantityAfter: qtyBefore - quantity,
            closedBoxesBefore,
            closedBoxesAfter: closedBoxesBefore,
            openBoxBefore,
            openBoxAfter: openBoxBefore - fromOpen,
            boxOpenedAutomatically: false,
            reason,
            responsible,
            notes: notes || undefined,
        });
        return { success: true, quantityBroken: quantity };
    }
    /**
     * Ajuste manual de estoque com log obrigatório
     */
    manualAdjustment(productId, branchId, quantity, reason, responsible, notes) {
        const inventory = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (!inventory) {
            throw new Error('Produto não encontrado no estoque');
        }
        const qtyBefore = inventory.qty_units;
        const closedBoxesBefore = inventory.closed_boxes;
        const openBoxBefore = inventory.open_box_units;
        // Ajustar na caixa aberta se quantidade positiva, ou deduzir se negativa
        this.db.prepare(`
      UPDATE inventory_items 
      SET open_box_units = open_box_units + ?,
          qty_units = qty_units + ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(quantity, quantity, inventory.id);
        this.registerStockMovement({
            productId,
            branchId,
            movementType: 'adjustment',
            quantity,
            quantityBefore: qtyBefore,
            quantityAfter: qtyBefore + quantity,
            closedBoxesBefore,
            closedBoxesAfter: closedBoxesBefore,
            openBoxBefore,
            openBoxAfter: openBoxBefore + quantity,
            boxOpenedAutomatically: false,
            reason,
            responsible,
            notes: notes || undefined,
        });
        return { success: true, adjusted: quantity };
    }
    /**
     * Calcular consumo médio e previsões
     */
    calculateConsumptionAndForecast(productId, branchId) {
        const now = new Date();
        const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const date15d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        // Calcular consumo por período
        const consumption7d = this.db.prepare(`
      SELECT SUM(ABS(quantity)) as total 
      FROM stock_movements 
      WHERE product_id = ? AND branch_id = ? 
        AND movement_type IN ('sale', 'sale_muntu')
        AND created_at >= ?
    `).get(productId, branchId, date7d.toISOString());
        const consumption15d = this.db.prepare(`
      SELECT SUM(ABS(quantity)) as total 
      FROM stock_movements 
      WHERE product_id = ? AND branch_id = ? 
        AND movement_type IN ('sale', 'sale_muntu')
        AND created_at >= ?
    `).get(productId, branchId, date15d.toISOString());
        const consumption30d = this.db.prepare(`
      SELECT SUM(ABS(quantity)) as total 
      FROM stock_movements 
      WHERE product_id = ? AND branch_id = ? 
        AND movement_type IN ('sale', 'sale_muntu')
        AND created_at >= ?
    `).get(productId, branchId, date30d.toISOString());
        const avg7d = (consumption7d.total || 0) / 7;
        const avg15d = (consumption15d.total || 0) / 15;
        const avg30d = (consumption30d.total || 0) / 30;
        // Buscar estoque atual
        const inventory = this.db.prepare(`
      SELECT qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        if (!inventory) {
            return { avg7d: 0, avg15d: 0, avg30d: 0, daysUntilStockout: null, suggestedReorder: 0 };
        }
        // Calcular dias até esgotamento (usar média de 15 dias)
        const daysUntilStockout = avg15d > 0 ? Math.floor(inventory.qty_units / avg15d) : null;
        // Sugestão de reposição (manter 15 dias de estoque)
        const targetDays = 15;
        const suggestedReorder = Math.max(0, Math.ceil((targetDays * avg15d) - inventory.qty_units));
        // Atualizar inventory_items
        this.db.prepare(`
      UPDATE inventory_items 
      SET consumption_avg_7d = ?,
          consumption_avg_15d = ?,
          consumption_avg_30d = ?,
          days_until_stockout = ?,
          suggested_reorder = ?,
          updated_at = datetime('now')
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).run(avg7d, avg15d, avg30d, daysUntilStockout, suggestedReorder, productId, branchId);
        return {
            avg7d,
            avg15d,
            avg30d,
            daysUntilStockout,
            suggestedReorder,
            currentStock: inventory.qty_units,
        };
    }
    /**
     * Buscar movimentações de estoque com filtros
     */
    getStockMovements(filters = {}) {
        let query = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku as product_sku
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.productId) {
            query += ' AND sm.product_id = ?';
            params.push(filters.productId);
        }
        if (filters.branchId) {
            query += ' AND sm.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.movementType) {
            query += ' AND sm.movement_type = ?';
            params.push(filters.movementType);
        }
        if (filters.startDate) {
            query += ' AND sm.created_at >= ?';
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ' AND sm.created_at <= ?';
            params.push(filters.endDate);
        }
        if (filters.boxOpenedOnly) {
            query += ' AND sm.box_opened_automatically = 1';
        }
        query += ' ORDER BY sm.created_at DESC LIMIT 200';
        return this.db.prepare(query).all(...params);
    }
    /**
     * Validador de consistência de estoque
     */
    validateInventoryConsistency(productId, branchId) {
        const inventory = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);
        const product = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
        if (!inventory || !product) {
            return { valid: false, errors: ['Produto ou estoque não encontrado'] };
        }
        const errors = [];
        let autoFixed = false;
        // Validação 1: Total em garrafas não pode ser negativo
        if (inventory.qty_units < 0) {
            errors.push('ERRO CRÍTICO: Total em garrafas negativo');
        }
        // Validação 2: Caixas fechadas não pode ser negativo
        if (inventory.closed_boxes < 0) {
            errors.push('ERRO CRÍTICO: Caixas fechadas negativas');
        }
        // Validação 3: Caixa aberta não pode exceder unidades por caixa
        if (inventory.open_box_units > product.units_per_box) {
            errors.push(`Caixa aberta com mais unidades que o permitido (${inventory.open_box_units} > ${product.units_per_box})`);
            // Auto-correção: converter unidades excedentes em caixas fechadas
            const extraBoxes = Math.floor(inventory.open_box_units / product.units_per_box);
            const remainingOpen = inventory.open_box_units % product.units_per_box;
            this.db.prepare(`
        UPDATE inventory_items 
        SET closed_boxes = closed_boxes + ?,
            open_box_units = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(extraBoxes, remainingOpen, inventory.id);
            autoFixed = true;
            errors.push(`Auto-corrigido: ${extraBoxes} caixa(s) fechada(s), ${remainingOpen} unidades avulsas`);
        }
        // Validação 4: Total calculado deve bater
        const calculatedTotal = (inventory.closed_boxes * product.units_per_box) + inventory.open_box_units;
        if (calculatedTotal !== inventory.qty_units) {
            errors.push(`Inconsistência no total: calculado=${calculatedTotal}, registrado=${inventory.qty_units}`);
        }
        return {
            valid: errors.length === 0,
            errors,
            autoFixed,
            inventory: {
                qty_units: inventory.qty_units,
                closed_boxes: inventory.closed_boxes,
                open_box_units: inventory.open_box_units,
                calculated_total: calculatedTotal,
            },
        };
    }
    deductInventory(productId, branchId, qtyUnits) {
        // MÉTODO LEGADO - Usar deductInventoryAdvanced() para nova lógica
        // Mantido para compatibilidade com código antigo
        console.log(`[deductInventory] Deduzindo ${qtyUnits} unidades do produto ${productId} na filial ${branchId}`);
        // Deduzir primeiro dos lotes mais antigos (FIFO)
        const batches = this.db.prepare(`
      SELECT id, qty_units, batch_number
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND qty_units > 0
      ORDER BY CASE WHEN batch_number IS NULL THEN 1 ELSE 0 END, expiry_date ASC, created_at ASC
    `).all(productId, branchId);
        console.log(`[deductInventory] Lotes encontrados:`, batches.length, batches.map(b => ({ id: b.id, qty: b.qty_units })));
        if (batches.length === 0) {
            console.warn(`[deductInventory] NENHUM LOTE ENCONTRADO! Verifique se o branch_id '${branchId}' existe no inventário.`);
            // Verificar todos os registros do produto
            const allItems = this.db.prepare(`SELECT * FROM inventory_items WHERE product_id = ?`).all(productId);
            console.log(`[deductInventory] Todos os registros de inventário para este produto:`, allItems);
            return;
        }
        let remaining = qtyUnits;
        for (const batch of batches) {
            if (remaining <= 0)
                break;
            const toDeduct = Math.min(batch.qty_units, remaining);
            const result = this.db.prepare(`
        UPDATE inventory_items 
        SET qty_units = qty_units - ?,
            updated_at = datetime('now'),
            synced = 0
        WHERE id = ?
      `).run(toDeduct, batch.id);
            console.log(`[deductInventory] UPDATE result:`, result.changes, 'linhas afetadas');
            console.log(`[deductInventory] Deduzido ${toDeduct} do lote ${batch.id}. Novo estoque: ${batch.qty_units - toDeduct}`);
            remaining -= toDeduct;
        }
        // Verificar estoque após dedução
        const afterDeduct = this.db.prepare(`SELECT qty_units FROM inventory_items WHERE product_id = ? AND branch_id = ?`).get(productId, branchId);
        console.log(`[deductInventory] Estoque APÓS dedução:`, afterDeduct?.qty_units);
        if (remaining > 0) {
            console.warn(`Estoque insuficiente para produto ${productId}. Faltam ${remaining} unidades.`);
        }
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
    // ============================================
    // Customers
    // ============================================
    getCustomers(filters = {}) {
        let query = 'SELECT id, code, full_name as name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points FROM customers';
        const params = [];
        if (filters.search) {
            query += ' WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR code LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }
        query += ' ORDER BY full_name';
        return this.db.prepare(query).all(...params);
    }
    getCustomerById(id) {
        return this.db.prepare(`
      SELECT id, code, full_name as name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points 
      FROM customers WHERE id = ?
    `).get(id);
    }
    createCustomer(data) {
        const id = this.generateUUID();
        // Gerar código único se não fornecido
        const code = data.code || `CUST-${Date.now().toString().slice(-6)}`;
        const stmt = this.db.prepare(`
      INSERT INTO customers (id, code, full_name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)
    `);
        stmt.run(id, code, data.name, data.phone, data.email, data.creditLimit || 0);
        this.addToSyncQueue('create', 'customer', id, data, 2);
        return this.getCustomerById(id);
    }
    updateCustomer(id, data) {
        const stmt = this.db.prepare(`
      UPDATE customers 
      SET full_name = ?, phone = ?, email = ?, credit_limit = ?, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `);
        stmt.run(data.name, data.phone, data.email, data.creditLimit || 0, id);
        this.addToSyncQueue('update', 'customer', id, data, 2);
        return this.getCustomerById(id);
    }
    deleteCustomer(id) {
        // Soft delete - apenas marca como inativo
        const stmt = this.db.prepare(`
      UPDATE customers 
      SET is_blocked = 1, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `);
        stmt.run(id);
        this.addToSyncQueue('delete', 'customer', id, {}, 2);
        return { success: true };
    }
    getCustomerPurchaseHistory(customerId, filters = {}) {
        let query = `
      SELECT 
        s.id,
        s.sale_number,
        s.created_at,
        s.total,
        s.status,
        p.method as payment_method,
        COUNT(DISTINCT si.id) as items_count
      FROM sales s
      LEFT JOIN payments p ON s.id = p.sale_id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.customer_id = ?
    `;
        const params = [customerId];
        if (filters.startDate) {
            query += ' AND s.created_at >= ?';
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ' AND s.created_at <= ?';
            params.push(filters.endDate);
        }
        query += ' GROUP BY s.id ORDER BY s.created_at DESC';
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        return this.db.prepare(query).all(...params);
    }
    getCustomerStats(customerId) {
        // Total de compras
        const totalPurchases = this.db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_spent,
        COALESCE(AVG(total), 0) as avg_order_value
      FROM sales
      WHERE customer_id = ?
    `).get(customerId);
        // Última compra
        const lastPurchase = this.db.prepare(`
      SELECT created_at as last_purchase_date
      FROM sales
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(customerId);
        // Top produtos comprados
        const topProducts = this.db.prepare(`
      SELECT 
        p.name as product_name,
        SUM(si.qty_units) as total_quantity,
        SUM(si.total) as total_spent
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      INNER JOIN products p ON si.product_id = p.id
      WHERE s.customer_id = ?
      GROUP BY si.product_id
      ORDER BY total_quantity DESC
      LIMIT 5
    `).all(customerId);
        return {
            ...totalPurchases,
            lastPurchaseDate: lastPurchase?.last_purchase_date || null,
            topProducts
        };
    }
    // ============================================
    // Loyalty Points (Sistema de Fidelidade)
    // ============================================
    /**
     * Adiciona pontos de fidelidade a um cliente após uma compra
     * Regra: 1 ponto para cada 1.000 FCFA gastos (valores em centavos)
     */
    addLoyaltyPoints(customerId, saleAmount, saleId) {
        // Calcular pontos: 1 ponto para cada 1.000 FCFA (100000 centavos)
        const pointsToAdd = Math.floor(saleAmount / 100000);
        if (pointsToAdd <= 0) {
            return { pointsAdded: 0, totalPoints: 0 };
        }
        // Buscar cliente atual
        const customer = this.db.prepare(`
      SELECT id, full_name, loyalty_points FROM customers WHERE id = ?
    `).get(customerId);
        if (!customer) {
            throw new Error('Cliente não encontrado');
        }
        const previousPoints = customer.loyalty_points || 0;
        const newPoints = previousPoints + pointsToAdd;
        // Atualizar pontos do cliente
        this.db.prepare(`
      UPDATE customers 
      SET loyalty_points = ?, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `).run(newPoints, customerId);
        // Adicionar à fila de sincronização
        this.addToSyncQueue('update', 'customer_loyalty', customerId, {
            pointsAdded: pointsToAdd,
            totalPoints: newPoints,
            saleId,
            reason: `Compra no valor de ${(saleAmount / 100).toFixed(2)} FCFA (1 ponto = 1.000 FCFA)`
        }, 2);
        return {
            pointsAdded: pointsToAdd,
            previousPoints,
            totalPoints: newPoints,
            customerName: customer.full_name
        };
    }
    /**
     * Obtém informações de pontos de fidelidade de um cliente
     */
    getCustomerLoyalty(customerId) {
        const customer = this.db.prepare(`
      SELECT id, code, full_name, loyalty_points FROM customers WHERE id = ?
    `).get(customerId);
        if (!customer) {
            throw new Error('Cliente não encontrado');
        }
        // Calcular tier baseado nos pontos
        let tier = 'Bronze';
        let tierColor = '#cd7f32';
        if (customer.loyalty_points >= 1000) {
            tier = 'Gold';
            tierColor = '#ffd700';
        }
        else if (customer.loyalty_points >= 500) {
            tier = 'Silver';
            tierColor = '#c0c0c0';
        }
        return {
            customerId: customer.id,
            customerCode: customer.code,
            customerName: customer.full_name,
            points: customer.loyalty_points || 0,
            tier,
            tierColor,
            pointsToNextTier: tier === 'Bronze' ? (500 - customer.loyalty_points) :
                tier === 'Silver' ? (1000 - customer.loyalty_points) : 0
        };
    }
    // ============================================
    // Users (Usuários do Sistema)
    // ============================================
    /**
     * Cria um novo usuário
     */
    createUser(data) {
        const id = this.generateUUID();
        this.db.prepare(`
      INSERT INTO users (
        id, username, email, full_name, password_hash, role, branch_id, phone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.username, data.email, data.fullName, data.passwordHash, data.role, data.branchId || null, data.phone || null);
        this.addToSyncQueue('create', 'user', id, data, 2);
        return { id, ...data };
    }
    /**
     * Lista todos os usuários
     */
    getUsers(filters = {}) {
        let query = `
      SELECT 
        u.*,
        b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.branchId) {
            query += ' AND u.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.role) {
            query += ' AND u.role = ?';
            params.push(filters.role);
        }
        if (filters.search) {
            query += ' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }
        if (filters.isActive !== undefined) {
            query += ' AND u.is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }
        query += ' ORDER BY u.full_name ASC';
        return this.db.prepare(query).all(...params);
    }
    /**
     * Busca um usuário por ID
     */
    getUserById(id) {
        return this.db.prepare(`
      SELECT 
        u.*,
        b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.id = ?
    `).get(id);
    }
    /**
     * Busca um usuário por username
     */
    getUserByUsername(username) {
        return this.db.prepare(`
      SELECT * FROM users WHERE username = ?
    `).get(username);
    }
    /**
     * Busca um usuário por email
     */
    getUserByEmail(email) {
        return this.db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email);
    }
    /**
     * Atualiza um usuário
     */
    updateUser(id, data) {
        const updates = [];
        const params = [];
        if (data.fullName !== undefined) {
            updates.push('full_name = ?');
            params.push(data.fullName);
        }
        if (data.email !== undefined) {
            updates.push('email = ?');
            params.push(data.email);
        }
        if (data.role !== undefined) {
            updates.push('role = ?');
            params.push(data.role);
        }
        if (data.branchId !== undefined) {
            updates.push('branch_id = ?');
            params.push(data.branchId);
        }
        if (data.phone !== undefined) {
            updates.push('phone = ?');
            params.push(data.phone);
        }
        if (data.isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(data.isActive ? 1 : 0);
        }
        if (updates.length === 0) {
            return this.getUserById(id);
        }
        updates.push('updated_at = datetime(\'now\')');
        updates.push('synced = 0');
        params.push(id);
        this.db.prepare(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params);
        this.addToSyncQueue('update', 'user', id, data, 2);
        return this.getUserById(id);
    }
    /**
     * Reseta a senha de um usuário
     */
    resetUserPassword(id, newPasswordHash) {
        this.db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `).run(newPasswordHash, id);
        this.addToSyncQueue('update', 'user_password', id, { passwordReset: true }, 2);
        return { success: true };
    }
    /**
     * Atualiza o último login do usuário
     */
    updateUserLastLogin(id) {
        this.db.prepare(`
      UPDATE users 
      SET last_login = datetime('now')
      WHERE id = ?
    `).run(id);
    }
    /**
     * Deleta (desativa) um usuário
     */
    deleteUser(id) {
        this.db.prepare(`
      UPDATE users 
      SET is_active = 0, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `).run(id);
        this.addToSyncQueue('delete', 'user', id, {}, 2);
        return { success: true };
    }
    // ============================================
    // Debts (Dívidas/Vales)
    // ============================================
    /**
     * Cria uma nova dívida para um cliente
     */
    createDebt(data) {
        const id = this.generateUUID();
        const debtNumber = `DEBT-${Date.now().toString().slice(-8)}`;
        // Verificar limite de crédito do cliente
        const customer = this.db.prepare(`
      SELECT credit_limit, current_debt FROM customers WHERE id = ?
    `).get(data.customerId);
        if (!customer) {
            throw new Error('Cliente não encontrado');
        }
        const availableCredit = customer.credit_limit - customer.current_debt;
        if (data.amount > availableCredit) {
            throw new Error(`Crédito insuficiente. Disponível: ${availableCredit / 100} FCFA`);
        }
        // Criar dívida
        this.db.prepare(`
      INSERT INTO debts (
        id, debt_number, customer_id, sale_id, branch_id,
        original_amount, balance, status, due_date, notes, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, debtNumber, data.customerId, data.saleId || null, data.branchId, data.amount, data.amount, data.dueDate || null, data.notes || null, data.createdBy);
        // Atualizar dívida atual do cliente
        this.db.prepare(`
      UPDATE customers 
      SET current_debt = current_debt + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(data.amount, data.customerId);
        this.addToSyncQueue('create', 'debt', id, data, 2);
        return { id, debtNumber, ...data };
    }
    /**
     * Lista dívidas com filtros
     */
    getDebts(filters = {}) {
        let query = `
      SELECT 
        d.*,
        c.full_name as customer_name,
        c.code as customer_code,
        c.phone as customer_phone,
        s.sale_number
      FROM debts d
      INNER JOIN customers c ON d.customer_id = c.id
      LEFT JOIN sales s ON d.sale_id = s.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.customerId) {
            query += ' AND d.customer_id = ?';
            params.push(filters.customerId);
        }
        if (filters.status) {
            query += ' AND d.status = ?';
            params.push(filters.status);
        }
        if (filters.branchId) {
            query += ' AND d.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.search) {
            query += ' AND (c.full_name LIKE ? OR c.code LIKE ? OR d.debt_number LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }
        query += ' ORDER BY d.created_at DESC';
        return this.db.prepare(query).all(...params);
    }
    /**
     * Busca uma dívida por ID
     */
    getDebtById(id) {
        const debt = this.db.prepare(`
      SELECT 
        d.*,
        c.full_name as customer_name,
        c.code as customer_code,
        c.phone as customer_phone,
        c.credit_limit,
        c.current_debt,
        s.sale_number
      FROM debts d
      INNER JOIN customers c ON d.customer_id = c.id
      LEFT JOIN sales s ON d.sale_id = s.id
      WHERE d.id = ?
    `).get(id);
        if (!debt)
            return null;
        // Buscar pagamentos da dívida
        const payments = this.db.prepare(`
      SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY created_at DESC
    `).all(id);
        return { ...debt, payments };
    }
    /**
     * Busca vales pendentes de uma mesa específica
     * Retorna um mapa com customer_id => total de vales pendentes
     */
    getTablePendingDebts(tableNumber) {
        const debts = this.db.prepare(`
      SELECT 
        d.customer_id,
        d.balance
      FROM debts d
      WHERE d.status = 'pending'
        AND d.balance > 0
        AND d.notes LIKE ?
    `).all(`%Mesa ${tableNumber}%`);
        const debtMap = new Map();
        for (const debt of debts) {
            const currentTotal = debtMap.get(debt.customer_id) || 0;
            debtMap.set(debt.customer_id, currentTotal + debt.balance);
        }
        return debtMap;
    }
    /**
     * Busca todos os vales pendentes de clientes específicos com detalhes
     * Retorna array com informações de cada vale incluindo mesa de origem
     */
    getCustomersPendingDebts(customerIds) {
        if (customerIds.length === 0)
            return [];
        const placeholders = customerIds.map(() => '?').join(',');
        const debts = this.db.prepare(`
      SELECT 
        d.id as debt_id,
        d.customer_id,
        d.balance,
        d.notes,
        d.created_at
      FROM debts d
      WHERE d.customer_id IN (${placeholders})
        AND d.status = 'pending'
        AND d.balance > 0
      ORDER BY d.created_at DESC
    `).all(...customerIds);
        // Extrair número da mesa das notas (formato: "Vale da mesa X - Cliente")
        return debts.map(debt => {
            const tableMatch = debt.notes.match(/Mesa (\d+)/i);
            return {
                ...debt,
                table_number: tableMatch ? tableMatch[1] : null
            };
        });
    }
    /**
     * Registra um pagamento de dívida (quitação ou parcial)
     */
    payDebt(data) {
        const debt = this.db.prepare(`
      SELECT * FROM debts WHERE id = ?
    `).get(data.debtId);
        if (!debt) {
            throw new Error('Dívida não encontrada');
        }
        if (debt.balance <= 0) {
            throw new Error('Dívida já está quitada');
        }
        if (data.amount > debt.balance) {
            throw new Error(`Valor maior que o saldo da dívida (${debt.balance / 100} FCFA)`);
        }
        const paymentId = this.generateUUID();
        const newBalance = debt.balance - data.amount;
        const newStatus = newBalance === 0 ? 'paid' : 'partial';
        // Registrar pagamento da dívida
        this.db.prepare(`
      INSERT INTO debt_payments (id, debt_id, amount, method, reference, notes, received_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, data.debtId, data.amount, data.method, data.reference || null, data.notes || null, data.receivedBy);
        // Atualizar dívida
        this.db.prepare(`
      UPDATE debts 
      SET paid_amount = paid_amount + ?,
          balance = ?,
          status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(data.amount, newBalance, newStatus, data.debtId);
        // Atualizar dívida atual do cliente
        this.db.prepare(`
      UPDATE customers 
      SET current_debt = current_debt - ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(data.amount, debt.customer_id);
        // Registrar pagamento geral (para rastreabilidade)
        const generalPaymentId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO payments (id, debt_id, method, amount, status, notes)
      VALUES (?, ?, ?, ?, 'completed', ?)
    `).run(generalPaymentId, data.debtId, data.method, data.amount, `Pagamento de dívida ${debt.debt_number}`);
        this.addToSyncQueue('update', 'debt', data.debtId, data, 2);
        return {
            paymentId,
            newBalance,
            status: newStatus,
            isPaid: newBalance === 0
        };
    }
    /**
     * Cancela uma dívida (apenas se não tiver pagamentos)
     */
    cancelDebt(debtId, reason) {
        const debt = this.db.prepare(`
      SELECT * FROM debts WHERE id = ?
    `).get(debtId);
        if (!debt) {
            throw new Error('Dívida não encontrada');
        }
        if (debt.paid_amount > 0) {
            throw new Error('Não é possível cancelar dívida com pagamentos registrados');
        }
        // Marcar como cancelada
        this.db.prepare(`
      UPDATE debts 
      SET status = 'cancelled',
          notes = COALESCE(notes || ' | ', '') || 'Cancelada: ' || ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(reason, debtId);
        // Reverter dívida atual do cliente
        this.db.prepare(`
      UPDATE customers 
      SET current_debt = current_debt - ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(debt.original_amount, debt.customer_id);
        this.addToSyncQueue('update', 'debt', debtId, { status: 'cancelled', reason }, 2);
        return { success: true };
    }
    /**
     * Busca estatísticas de dívidas de um cliente
     */
    getCustomerDebtStats(customerId) {
        const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_debts,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_debts,
        COALESCE(SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END), 0) as partial_debts,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid_debts,
        COALESCE(SUM(original_amount), 0) as total_borrowed,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance), 0) as total_balance
      FROM debts
      WHERE customer_id = ?
    `).get(customerId);
        return stats;
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
    getCashBoxHistory(filters = {}) {
        let query = `
      SELECT 
        cb.*,
        COUNT(DISTINCT s.id) as total_transactions,
        SUM(CASE WHEN s.status = 'paid' THEN 1 ELSE 0 END) as paid_transactions
      FROM cash_boxes cb
      LEFT JOIN sales s ON s.created_at >= cb.opened_at 
        AND (cb.closed_at IS NULL OR s.created_at <= cb.closed_at)
        AND s.branch_id = cb.branch_id
      WHERE cb.status = 'closed'
    `;
        const params = [];
        if (filters.branchId) {
            query += ' AND cb.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.dateFrom) {
            query += ' AND cb.closed_at >= ?';
            params.push(filters.dateFrom);
        }
        if (filters.dateTo) {
            query += ' AND cb.closed_at <= ?';
            params.push(filters.dateTo);
        }
        query += ' GROUP BY cb.id ORDER BY cb.closed_at DESC LIMIT 50';
        return this.db.prepare(query).all(...params);
    }
    getCashBoxById(id) {
        const cashBox = this.db.prepare('SELECT * FROM cash_boxes WHERE id = ?').get(id);
        if (!cashBox)
            return null;
        // Buscar vendas do período do caixa
        const sales = this.db.prepare(`
      SELECT s.*, p.method as payment_method
      FROM sales s
      LEFT JOIN payments p ON s.id = p.sale_id
      WHERE s.created_at >= ? 
        AND (? IS NULL OR s.created_at <= ?)
        AND s.branch_id = ?
      ORDER BY s.created_at DESC
    `).all(cashBox.opened_at, cashBox.closed_at, cashBox.closed_at, cashBox.branch_id);
        // Se total_debt não está registrado (caixas antigos), calcular dinamicamente
        if (!cashBox.total_debt || cashBox.total_debt === 0) {
            const valeTotal = this.db.prepare(`
        SELECT COALESCE(SUM(s.total), 0) as total_vale
        FROM sales s
        INNER JOIN payments p ON s.id = p.sale_id
        WHERE s.created_at >= ?
          AND (? IS NULL OR s.created_at <= ?)
          AND s.branch_id = ?
          AND (p.method = 'vale' OR p.method = 'debt')
      `).get(cashBox.opened_at, cashBox.closed_at, cashBox.closed_at, cashBox.branch_id);
            cashBox.total_debt = valeTotal?.total_vale || 0;
        }
        // Calcular métricas de lucro
        const profitMetrics = this.calculateCashBoxProfitMetrics(id, cashBox);
        return { ...cashBox, sales, profitMetrics };
    }
    calculateCashBoxProfitMetrics(cashBoxId, cashBox) {
        // Buscar todos os itens vendidos durante o período do caixa (incluindo vendas sem método de pagamento)
        const salesItems = this.db.prepare(`
      SELECT 
        si.product_id,
        p.name as product_name,
        SUM(si.qty_units) as total_qty_sold,
        SUM(si.total) as total_revenue,
        SUM(si.unit_cost * si.qty_units) as total_cost,
        si.unit_cost,
        si.unit_price
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      INNER JOIN products p ON si.product_id = p.id
      WHERE s.created_at >= ?
        AND (? IS NULL OR s.created_at <= ?)
        AND s.branch_id = ?
      GROUP BY si.product_id, si.unit_cost, si.unit_price
      ORDER BY total_revenue DESC
    `).all(cashBox.opened_at, cashBox.closed_at, cashBox.closed_at, cashBox.branch_id);
        // Calcular totais
        let totalRevenue = 0;
        let totalCOGS = 0;
        salesItems.forEach((item) => {
            totalRevenue += item.total_revenue;
            totalCOGS += item.total_cost;
        });
        const grossProfit = totalRevenue - totalCOGS;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        // Buscar estoque atual para calcular reposição
        const lowStockItems = this.db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.units_per_box,
        p.cost_unit,
        ii.qty_units as current_stock,
        COALESCE(sold.qty_sold, 0) as qty_sold_in_period
      FROM products p
      LEFT JOIN inventory_items ii ON p.id = ii.product_id AND ii.branch_id = ?
      LEFT JOIN (
        SELECT 
          si.product_id,
          SUM(si.qty_units) as qty_sold
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at >= ?
          AND (? IS NULL OR s.created_at <= ?)
          AND s.branch_id = ?
        GROUP BY si.product_id
      ) sold ON p.id = sold.product_id
      WHERE p.is_active = 1
        AND sold.qty_sold > 0
      ORDER BY sold.qty_sold DESC
    `).all(cashBox.branch_id, cashBox.opened_at, cashBox.closed_at, cashBox.closed_at, cashBox.branch_id);
        // Calcular sugestões de reposição (produtos que caíram abaixo de 20% do estoque vendido)
        const restockSuggestions = lowStockItems
            .filter((item) => {
            const minStock = item.qty_sold_in_period * 0.2; // 20% do que foi vendido
            return (item.current_stock || 0) < minStock;
        })
            .map((item) => {
            const suggestedQty = Math.ceil(item.qty_sold_in_period * 1.5); // Sugerir 150% do vendido
            const restockCost = suggestedQty * item.cost_unit;
            return {
                productId: item.id,
                productName: item.name,
                sku: item.sku,
                currentStock: item.current_stock || 0,
                qtySoldInPeriod: item.qty_sold_in_period,
                suggestedRestockQty: suggestedQty,
                restockCost: restockCost,
                unitsPerBox: item.units_per_box,
                suggestedBoxes: Math.ceil(suggestedQty / item.units_per_box)
            };
        });
        const totalRestockCost = restockSuggestions.reduce((sum, item) => sum + item.restockCost, 0);
        return {
            totalRevenue,
            totalCOGS,
            grossProfit,
            profitMargin: Math.round(profitMargin * 100) / 100, // 2 casas decimais
            salesItems: salesItems.map((item) => ({
                productId: item.product_id,
                productName: item.product_name,
                qtySold: item.total_qty_sold,
                revenue: item.total_revenue,
                cost: item.total_cost,
                profit: item.total_revenue - item.total_cost,
                margin: item.total_revenue > 0 ? ((item.total_revenue - item.total_cost) / item.total_revenue) * 100 : 0
            })),
            restockSuggestions,
            totalRestockCost
        };
    }
    updateCashBoxTotals(cashBoxId, saleTotal, paymentMethod) {
        // Incrementar o total de vendas e o método específico
        let paymentField = '';
        if (paymentMethod === 'cash') {
            paymentField = 'total_cash';
        }
        else if (paymentMethod === 'orange' || paymentMethod === 'teletaku' || paymentMethod === 'mobile') {
            paymentField = 'total_mobile_money';
        }
        else if (paymentMethod === 'mixed' || paymentMethod === 'card') {
            paymentField = 'total_card';
        }
        else if (paymentMethod === 'vale' || paymentMethod === 'debt') {
            paymentField = 'total_debt';
        }
        if (paymentField) {
            this.db.prepare(`
        UPDATE cash_boxes 
        SET total_sales = total_sales + ?,
            ${paymentField} = ${paymentField} + ?,
            synced = 0, 
            updated_at = datetime('now')
        WHERE id = ?
      `).run(saleTotal, saleTotal, cashBoxId);
        }
        else {
            // Método desconhecido, apenas incrementa total_sales
            this.db.prepare(`
        UPDATE cash_boxes 
        SET total_sales = total_sales + ?,
            synced = 0, 
            updated_at = datetime('now')
        WHERE id = ?
      `).run(saleTotal, cashBoxId);
        }
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
        // Converter datas para string ISO8601 para SQLite
        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();
        let query = `
      SELECT 
        DATE(opened_at) as date,
        COUNT(*) as total_sales,
        SUM(total) as total_amount,
        SUM(muntu_savings) as total_savings
      FROM sales
      WHERE status = 'closed'
        AND DATE(opened_at) BETWEEN DATE(?) AND DATE(?)
    `;
        const params = [startStr, endStr];
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
    // Tables Management (Gestão de Mesas)
    // ============================================
    /**
     * Criar/Cadastrar mesas
     */
    createTable(data) {
        const id = this.generateUUID();
        this.db.prepare(`
      INSERT INTO tables (id, branch_id, number, seats, area, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, data.branchId, data.number, data.seats, data.area || null);
        this.addToSyncQueue('create', 'table', id, data, 3);
        return this.db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
    }
    /**
     * Listar mesas
     */
    getTables(filters = {}) {
        let query = 'SELECT * FROM tables WHERE 1=1';
        const params = [];
        if (filters.branchId) {
            query += ' AND branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.isActive !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }
        query += ' ORDER BY number ASC';
        return this.db.prepare(query).all(...params);
    }
    /**
     * Buscar mesa por ID
     */
    getTableById(id) {
        return this.db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
    }
    /**
     * Abrir uma sessão de mesa
     */
    openTableSession(data) {
        const id = this.generateUUID();
        // Verificar se mesa existe
        const table = this.getTableById(data.tableId);
        if (!table) {
            throw new Error('Mesa não encontrada');
        }
        // Verificar se mesa já está ocupada
        const existingSession = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
      ORDER BY opened_at DESC LIMIT 1
    `).get(data.tableId);
        if (existingSession) {
            throw new Error('Mesa já está ocupada');
        }
        // Gerar número sequencial da sessão
        const lastSession = this.db.prepare(`
      SELECT session_number FROM table_sessions 
      WHERE branch_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(data.branchId);
        const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
        // Criar sessão
        this.db.prepare(`
      INSERT INTO table_sessions (
        id, table_id, branch_id, session_number, status, opened_by, notes
      ) VALUES (?, ?, ?, ?, 'open', ?, ?)
    `).run(id, data.tableId, data.branchId, sessionNumber, data.openedBy, data.notes || null);
        // Registrar ação
        this.logTableAction({
            sessionId: id,
            actionType: 'open_table',
            performedBy: data.openedBy,
            description: `Mesa ${table.number} aberta`,
            metadata: JSON.stringify({ tableNumber: table.number }),
        });
        this.addToSyncQueue('create', 'table_session', id, data, 1);
        return this.getTableSessionById(id);
    }
    /**
     * Buscar sessão de mesa por ID
     */
    getTableSessionById(id) {
        const session = this.db.prepare(`
      SELECT 
        ts.*,
        t.number as table_number,
        t.seats as table_seats
      FROM table_sessions ts
      LEFT JOIN tables t ON ts.table_id = t.id
      WHERE ts.id = ?
    `).get(id);
        if (!session)
            return null;
        // Buscar clientes da sessão
        const customers = this.db.prepare(`
      SELECT * FROM table_customers WHERE session_id = ? ORDER BY order_sequence ASC
    `).all(id);
        // Buscar pedidos de cada cliente
        for (const customer of customers) {
            customer.orders = this.db.prepare(`
        SELECT 
          o.*,
          p.name as product_name,
          p.sku as product_sku
        FROM table_orders o
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.table_customer_id = ? AND o.status != 'cancelled'
        ORDER BY o.ordered_at ASC
      `).all(customer.id);
        }
        session.customers = customers;
        return session;
    }
    /**
     * Listar sessões de mesa
     */
    getTableSessions(filters = {}) {
        let query = `
      SELECT 
        ts.*,
        t.number as table_number,
        t.seats as table_seats,
        t.area as table_area
      FROM table_sessions ts
      LEFT JOIN tables t ON ts.table_id = t.id
      WHERE 1=1
    `;
        const params = [];
        if (filters.branchId) {
            query += ' AND ts.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.status) {
            query += ' AND ts.status = ?';
            params.push(filters.status);
        }
        if (filters.tableId) {
            query += ' AND ts.table_id = ?';
            params.push(filters.tableId);
        }
        query += ' ORDER BY ts.opened_at DESC';
        const sessions = this.db.prepare(query).all(...params);
        // Adicionar contagem de clientes para cada sessão
        for (const session of sessions) {
            const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as customer_count,
          SUM(total) as total_amount
        FROM table_customers 
        WHERE session_id = ?
      `).get(session.id);
            session.customer_count = stats?.customer_count || 0;
            session.total_amount = stats?.total_amount || 0;
        }
        return sessions;
    }
    /**
     * Adicionar cliente à mesa
     */
    addCustomerToTable(data) {
        const id = this.generateUUID();
        // Verificar se sessão existe e está aberta
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão de mesa não encontrada');
        }
        if (session.status !== 'open') {
            throw new Error('Mesa não está aberta para novos clientes');
        }
        // Determinar sequence
        const lastCustomer = this.db.prepare(`
      SELECT order_sequence FROM table_customers 
      WHERE session_id = ? 
      ORDER BY order_sequence DESC LIMIT 1
    `).get(data.sessionId);
        const orderSequence = lastCustomer ? (lastCustomer.order_sequence || 0) + 1 : 1;
        // Adicionar cliente
        this.db.prepare(`
      INSERT INTO table_customers (
        id, session_id, customer_name, customer_id, order_sequence
      ) VALUES (?, ?, ?, ?, ?)
    `).run(id, data.sessionId, data.customerName, data.customerId || null, orderSequence);
        // Registrar ação
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'add_customer',
            performedBy: data.addedBy,
            description: `Cliente "${data.customerName}" adicionado à mesa`,
            metadata: JSON.stringify({ customerName: data.customerName }),
        });
        return this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(id);
    }
    /**
     * Fazer pedido para um cliente da mesa
     */
    addTableOrder(data) {
        console.log('[addTableOrder] Chamado com:', JSON.stringify(data));
        const id = this.generateUUID();
        // Verificar sessão
        const session = this.getTableSessionById(data.sessionId);
        console.log('[addTableOrder] Sessão encontrada:', session ? { id: session.id, branch_id: session.branch_id, status: session.status } : 'null');
        if (!session || session.status !== 'open') {
            throw new Error('Sessão de mesa não está aberta');
        }
        // Buscar produto
        const product = this.getProductById(data.productId);
        if (!product) {
            throw new Error('Produto não encontrado');
        }
        console.log('[addTableOrder] Produto encontrado:', { id: product.id, name: product.name });
        console.log('[addTableOrder] Produto COMPLETO:', JSON.stringify(product, null, 2));
        // Calcular preços
        let unitPrice;
        let subtotal;
        if (data.isMuntu && product.muntu_price && product.muntu_quantity) {
            // Muntu: calcular quantos packs foram pedidos
            // Ex: 12 unidades / 6 unidades por pack = 2 packs
            const numPacks = data.qtyUnits / product.muntu_quantity;
            unitPrice = Math.round(product.muntu_price / product.muntu_quantity);
            subtotal = Math.round(product.muntu_price * numPacks);
        }
        else {
            unitPrice = product.price_unit || 0;
            subtotal = unitPrice * data.qtyUnits;
        }
        const unitCost = product.cost_unit || 0;
        const total = subtotal;
        console.log('[addTableOrder] Cálculo de preços:', { isMuntu: data.isMuntu, qtyUnits: data.qtyUnits, unitPrice, subtotal, total });
        console.log('[addTableOrder] Prestes a deduzir do estoque:', { productId: data.productId, branchId: session.branch_id, qtyUnits: data.qtyUnits });
        // Deduzir do estoque usando método avançado (registra movimentações)
        try {
            this.deductInventoryAdvanced(data.productId, session.branch_id, data.qtyUnits, data.isMuntu || false, undefined, // saleId (não aplicável para mesas)
            data.orderedBy);
            console.log('[addTableOrder] Estoque deduzido com sucesso');
        }
        catch (error) {
            console.error('[addTableOrder] ERRO ao deduzir estoque:', error);
            throw new Error(`Erro ao deduzir estoque: ${error.message}`);
        }
        // Criar pedido
        this.db.prepare(`
      INSERT INTO table_orders (
        id, session_id, table_customer_id, product_id, 
        qty_units, is_muntu, unit_price, unit_cost, subtotal, total,
        status, notes, ordered_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, data.sessionId, data.tableCustomerId, data.productId, data.qtyUnits, data.isMuntu ? 1 : 0, unitPrice, unitCost, subtotal, total, data.notes || null, data.orderedBy);
        // Atualizar totais do cliente
        this.updateTableCustomerTotals(data.tableCustomerId);
        // Atualizar totais da sessão
        this.updateTableSessionTotals(data.sessionId);
        // Registrar ação
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'add_order',
            performedBy: data.orderedBy,
            description: `Pedido de ${data.qtyUnits}x ${product.name || 'produto'}`,
            metadata: JSON.stringify({
                productId: data.productId,
                productName: product.name || 'produto',
                qtyUnits: data.qtyUnits
            }),
        });
        return this.db.prepare(`
      SELECT o.*, p.name as product_name 
      FROM table_orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).get(id);
    }
    /**
     * Cancelar pedido de mesa (retorna ao estoque)
     */
    cancelTableOrder(data) {
        const order = this.db.prepare('SELECT * FROM table_orders WHERE id = ?').get(data.orderId);
        if (!order) {
            throw new Error('Pedido não encontrado');
        }
        if (order.status === 'cancelled') {
            throw new Error('Pedido já foi cancelado');
        }
        // Retornar ao estoque
        const session = this.getTableSessionById(order.session_id);
        if (session) {
            this.db.prepare(`
        UPDATE inventory_items 
        SET qty_units = qty_units + ?, updated_at = datetime('now')
        WHERE product_id = ? AND branch_id = ?
      `).run(order.qty_units, order.product_id, session.branch_id);
        }
        // Cancelar pedido
        this.db.prepare(`
      UPDATE table_orders 
      SET status = 'cancelled', cancelled_by = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(data.cancelledBy, data.orderId);
        // Atualizar totais
        this.updateTableCustomerTotals(order.table_customer_id);
        this.updateTableSessionTotals(order.session_id);
        // Registrar ação
        this.logTableAction({
            sessionId: order.session_id,
            actionType: 'cancel_order',
            performedBy: data.cancelledBy,
            description: `Pedido cancelado: ${order.qty_units}x produto`,
            metadata: JSON.stringify({ orderId: data.orderId, reason: data.reason }),
        });
        return { success: true, message: 'Pedido cancelado e estoque restaurado' };
    }
    /**
     * Transferir item entre clientes da mesma mesa
     */
    transferTableOrder(data) {
        const order = this.db.prepare('SELECT * FROM table_orders WHERE id = ?').get(data.orderId);
        if (!order) {
            throw new Error('Pedido não encontrado');
        }
        if (order.status === 'cancelled') {
            throw new Error('Não é possível transferir pedido cancelado');
        }
        const qtyToTransfer = data.qtyUnits || order.qty_units || 0;
        if (qtyToTransfer > (order.qty_units || 0)) {
            throw new Error('Quantidade a transferir maior que o disponível');
        }
        // Verificar se clientes estão na mesma sessão
        const fromCustomer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.fromCustomerId);
        const toCustomer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.toCustomerId);
        if (!fromCustomer || !toCustomer || fromCustomer.session_id !== toCustomer.session_id) {
            throw new Error('Clientes devem estar na mesma mesa');
        }
        if (qtyToTransfer === order.qty_units) {
            // Transferir pedido inteiro
            this.db.prepare(`
        UPDATE table_orders 
        SET table_customer_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.toCustomerId, data.orderId);
        }
        else {
            // Dividir pedido
            // Reduzir quantidade do pedido original
            this.db.prepare(`
        UPDATE table_orders 
        SET qty_units = qty_units - ?,
            subtotal = unit_price * (qty_units - ?),
            total = unit_price * (qty_units - ?),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(qtyToTransfer, qtyToTransfer, qtyToTransfer, data.orderId);
            // Criar novo pedido para o cliente destino
            const newOrderId = this.generateUUID();
            const unitPriceVal = order.unit_price || 0;
            this.db.prepare(`
        INSERT INTO table_orders (
          id, session_id, table_customer_id, product_id,
          qty_units, is_muntu, unit_price, unit_cost, 
          subtotal, total, status, notes, ordered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newOrderId, order.session_id, data.toCustomerId, order.product_id, qtyToTransfer, order.is_muntu, order.unit_price, order.unit_cost, unitPriceVal * qtyToTransfer, unitPriceVal * qtyToTransfer, order.status, 'Transferido de outro cliente', data.transferredBy);
        }
        // Atualizar totais
        this.updateTableCustomerTotals(data.fromCustomerId);
        this.updateTableCustomerTotals(data.toCustomerId);
        // Registrar ação
        this.logTableAction({
            sessionId: order.session_id,
            actionType: 'transfer_item',
            performedBy: data.transferredBy,
            description: `${qtyToTransfer} itens transferidos entre clientes`,
            metadata: JSON.stringify({
                orderId: data.orderId,
                fromCustomerId: data.fromCustomerId,
                toCustomerId: data.toCustomerId,
                qtyUnits: qtyToTransfer
            }),
        });
        return { success: true, message: 'Item transferido com sucesso' };
    }
    /**
     * Dividir item entre múltiplos clientes
     */
    splitTableOrder(data) {
        const order = this.db.prepare('SELECT * FROM table_orders WHERE id = ?').get(data.orderId);
        if (!order) {
            throw new Error('Pedido não encontrado');
        }
        // Validar splits
        const totalSplit = data.splits.reduce((sum, s) => sum + s.qtyUnits, 0);
        if (totalSplit !== order.qty_units) {
            throw new Error('A soma das divisões deve ser igual à quantidade total');
        }
        // Cancelar pedido original
        this.db.prepare(`
      UPDATE table_orders 
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ?
    `).run(data.orderId);
        // Criar novos pedidos para cada divisão
        const unitPriceVal = order.unit_price || 0;
        for (const split of data.splits) {
            const newOrderId = this.generateUUID();
            this.db.prepare(`
        INSERT INTO table_orders (
          id, session_id, table_customer_id, product_id,
          qty_units, is_muntu, unit_price, unit_cost,
          subtotal, total, status, notes, ordered_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newOrderId, order.session_id, split.customerId, order.product_id, split.qtyUnits, order.is_muntu, order.unit_price, order.unit_cost, unitPriceVal * split.qtyUnits, unitPriceVal * split.qtyUnits, order.status, 'Item dividido', data.splitBy);
            this.updateTableCustomerTotals(split.customerId);
        }
        // Registrar ação
        this.logTableAction({
            sessionId: order.session_id,
            actionType: 'split_item',
            performedBy: data.splitBy,
            description: `Item dividido entre ${data.splits.length} clientes`,
            metadata: JSON.stringify({ orderId: data.orderId, splits: data.splits }),
        });
        return { success: true, message: 'Item dividido com sucesso' };
    }
    /**
     * Transferir todos os pedidos para outra mesa
     */
    transferTableSession(data) {
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }
        // Verificar se mesa destino está disponível
        const existingSession = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
    `).get(data.toTableId);
        if (existingSession) {
            throw new Error('Mesa de destino já está ocupada');
        }
        // Atualizar table_id da sessão
        this.db.prepare(`
      UPDATE table_sessions 
      SET table_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(data.toTableId, data.sessionId);
        // Registrar ação
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'transfer_table',
            performedBy: data.transferredBy,
            description: `Mesa transferida`,
            metadata: JSON.stringify({
                fromTableId: session.table_id,
                toTableId: data.toTableId
            }),
        });
        return { success: true, message: 'Mesa transferida com sucesso' };
    }
    /**
     * Transferir clientes específicos para outra mesa
     */
    transferTableCustomers(data) {
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }
        if (!data.customerIds || data.customerIds.length === 0) {
            throw new Error('Nenhum cliente selecionado para transferência');
        }
        // Verificar se todos os clientes pertencem à sessão
        const customers = this.db.prepare(`
      SELECT * FROM table_customers 
      WHERE id IN (${data.customerIds.map(() => '?').join(',')}) 
      AND session_id = ?
    `).all(...data.customerIds, data.sessionId);
        if (customers.length !== data.customerIds.length) {
            throw new Error('Um ou mais clientes não pertencem a esta sessão');
        }
        // Verificar se mesa destino já tem sessão aberta
        let targetSession = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
      ORDER BY opened_at DESC LIMIT 1
    `).get(data.toTableId);
        // Se mesa destino não tem sessão, criar uma nova
        if (!targetSession) {
            const newSessionId = this.generateUUID();
            // Gerar número sequencial da sessão
            const lastSession = this.db.prepare(`
        SELECT session_number FROM table_sessions 
        WHERE branch_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(session.branch_id);
            const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
            this.db.prepare(`
        INSERT INTO table_sessions (
          id, table_id, branch_id, session_number, status, opened_by
        ) VALUES (?, ?, ?, ?, 'open', ?)
      `).run(newSessionId, data.toTableId, session.branch_id, sessionNumber, data.transferredBy);
            targetSession = this.db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(newSessionId);
            this.logTableAction({
                sessionId: newSessionId,
                actionType: 'open_table',
                performedBy: data.transferredBy,
                description: 'Mesa aberta automaticamente para transferência de clientes',
                metadata: JSON.stringify({ fromSessionId: data.sessionId }),
            });
        }
        // Transferir cada cliente e seus pedidos
        for (const customerId of data.customerIds) {
            // Atualizar session_id do cliente
            this.db.prepare(`
        UPDATE table_customers 
        SET session_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(targetSession.id, customerId);
            // Atualizar session_id de todos os pedidos do cliente
            this.db.prepare(`
        UPDATE table_orders 
        SET session_id = ?, updated_at = datetime('now')
        WHERE table_customer_id = ?
      `).run(targetSession.id, customerId);
        }
        // Recalcular totais da sessão original
        this.updateTableSessionTotals(data.sessionId);
        // Recalcular totais da sessão destino
        this.updateTableSessionTotals(targetSession.id);
        // Registrar ação na sessão original
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'transfer_customers',
            performedBy: data.transferredBy,
            description: `${data.customerIds.length} cliente(s) transferido(s) para outra mesa`,
            metadata: JSON.stringify({
                customerIds: data.customerIds,
                toTableId: data.toTableId,
                toSessionId: targetSession.id
            }),
        });
        // Registrar ação na sessão destino
        this.logTableAction({
            sessionId: targetSession.id,
            actionType: 'receive_customers',
            performedBy: data.transferredBy,
            description: `Recebeu ${data.customerIds.length} cliente(s) de outra mesa`,
            metadata: JSON.stringify({
                customerIds: data.customerIds,
                fromSessionId: data.sessionId
            }),
        });
        // Se não restaram clientes na sessão original, fechar automaticamente
        const remainingCustomers = this.db.prepare('SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?').get(data.sessionId);
        if (remainingCustomers.count === 0) {
            this.db.prepare(`
        UPDATE table_sessions 
        SET status = 'closed', closed_at = datetime('now'), closed_by = ?
        WHERE id = ?
      `).run(data.transferredBy, data.sessionId);
            this.logTableAction({
                sessionId: data.sessionId,
                actionType: 'close_table',
                performedBy: data.transferredBy,
                description: 'Mesa fechada automaticamente (todos os clientes foram transferidos)',
                metadata: JSON.stringify({ reason: 'all_customers_transferred' }),
            });
        }
        return {
            success: true,
            message: `${data.customerIds.length} cliente(s) transferido(s) com sucesso`,
            targetSessionId: targetSession.id
        };
    }
    /**
     * Unir mesas - consolidar sessões de múltiplas mesas em uma única mesa
     */
    mergeTableSessions(data) {
        if (!data.sessionIds || data.sessionIds.length < 2) {
            throw new Error('É necessário selecionar pelo menos 2 mesas para unir');
        }
        // Buscar todas as sessões
        const sessions = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE id IN (${data.sessionIds.map(() => '?').join(',')}) 
      AND status IN ('open', 'awaiting_payment')
    `).all(...data.sessionIds);
        if (sessions.length !== data.sessionIds.length) {
            throw new Error('Uma ou mais sessões não estão abertas ou não existem');
        }
        // Verificar se todas as sessões são da mesma filial
        const branchIds = [...new Set(sessions.map(s => s.branch_id))];
        if (branchIds.length > 1) {
            throw new Error('Não é possível unir mesas de filiais diferentes');
        }
        // Verificar se mesa destino está disponível ou é uma das mesas sendo unidas
        const isTargetInMerge = sessions.some(s => s.table_id === data.targetTableId);
        let targetSession;
        if (isTargetInMerge) {
            // Se a mesa destino é uma das que está sendo unida, usar essa sessão
            targetSession = sessions.find(s => s.table_id === data.targetTableId);
        }
        else {
            // Verificar se mesa destino está livre
            const existingSession = this.db.prepare(`
        SELECT * FROM table_sessions 
        WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
      `).get(data.targetTableId);
            if (existingSession) {
                throw new Error('Mesa de destino já está ocupada');
            }
            // Criar nova sessão na mesa destino
            const newSessionId = this.generateUUID();
            // Gerar número sequencial da sessão
            const lastSession = this.db.prepare(`
        SELECT session_number FROM table_sessions 
        WHERE branch_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(sessions[0].branch_id);
            const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
            this.db.prepare(`
        INSERT INTO table_sessions (
          id, table_id, branch_id, session_number, status, opened_by
        ) VALUES (?, ?, ?, ?, 'open', ?)
      `).run(newSessionId, data.targetTableId, sessions[0].branch_id, sessionNumber, data.mergedBy);
            targetSession = this.db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(newSessionId);
            this.logTableAction({
                sessionId: newSessionId,
                actionType: 'open_table',
                performedBy: data.mergedBy,
                description: 'Mesa aberta para unificação de mesas',
                metadata: JSON.stringify({ mergedSessionIds: data.sessionIds }),
            });
        }
        if (!targetSession) {
            throw new Error('Erro ao criar ou encontrar sessão destino');
        }
        // Transferir todos os clientes e pedidos de todas as sessões para a sessão destino
        const sessionsToClose = sessions.filter(s => s.id !== targetSession.id);
        let totalCustomersMerged = 0;
        let totalOrdersMerged = 0;
        for (const session of sessionsToClose) {
            // Contar clientes e pedidos
            const customerCount = this.db.prepare('SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?').get(session.id);
            const orderCount = this.db.prepare("SELECT COUNT(*) as count FROM table_orders WHERE session_id = ? AND status != 'cancelled'").get(session.id);
            totalCustomersMerged += customerCount.count;
            totalOrdersMerged += orderCount.count;
            // Transferir clientes
            this.db.prepare(`
        UPDATE table_customers 
        SET session_id = ?, updated_at = datetime('now')
        WHERE session_id = ?
      `).run(targetSession.id, session.id);
            // Transferir pedidos
            this.db.prepare(`
        UPDATE table_orders 
        SET session_id = ?, updated_at = datetime('now')
        WHERE session_id = ?
      `).run(targetSession.id, session.id);
            // Registrar ação na sessão que será fechada
            this.logTableAction({
                sessionId: session.id,
                actionType: 'merge_out',
                performedBy: data.mergedBy,
                description: `Mesa unida à mesa ${data.targetTableId}`,
                metadata: JSON.stringify({
                    targetSessionId: targetSession.id,
                    targetTableId: data.targetTableId,
                    customersTransferred: customerCount.count,
                    ordersTransferred: orderCount.count
                }),
            });
            // Fechar sessão antiga
            this.db.prepare(`
        UPDATE table_sessions 
        SET status = 'closed', closed_at = datetime('now'), closed_by = ?
        WHERE id = ?
      `).run(data.mergedBy, session.id);
            this.logTableAction({
                sessionId: session.id,
                actionType: 'close_table',
                performedBy: data.mergedBy,
                description: 'Mesa fechada (unificada com outra mesa)',
                metadata: JSON.stringify({
                    reason: 'merged',
                    targetSessionId: targetSession.id
                }),
            });
        }
        // Recalcular totais da sessão destino
        this.updateTableSessionTotals(targetSession.id);
        // Registrar ação de unificação na sessão destino
        this.logTableAction({
            sessionId: targetSession.id,
            actionType: 'merge_in',
            performedBy: data.mergedBy,
            description: `${sessionsToClose.length} mesa(s) unida(s) nesta mesa`,
            metadata: JSON.stringify({
                mergedSessionIds: sessionsToClose.map(s => s.id),
                totalCustomers: totalCustomersMerged,
                totalOrders: totalOrdersMerged
            }),
        });
        return {
            success: true,
            message: `${data.sessionIds.length} mesas unidas com sucesso`,
            targetSessionId: targetSession.id,
            customersTransferred: totalCustomersMerged,
            ordersTransferred: totalOrdersMerged
        };
    }
    /**
     * Separar mesa unida - distribuir clientes entre múltiplas mesas
     */
    splitMergedTable(data) {
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }
        if (!data.distributions || data.distributions.length === 0) {
            throw new Error('É necessário especificar a distribuição dos clientes');
        }
        // Validar que todos os clientes pertencem à sessão
        const allCustomerIds = data.distributions.flatMap(d => d.customerIds);
        const customers = this.db.prepare(`
      SELECT id FROM table_customers 
      WHERE id IN (${allCustomerIds.map(() => '?').join(',')}) 
      AND session_id = ?
    `).all(...allCustomerIds, data.sessionId);
        if (customers.length !== allCustomerIds.length) {
            throw new Error('Um ou mais clientes não pertencem a esta sessão');
        }
        // Verificar se há duplicatas
        const uniqueIds = new Set(allCustomerIds);
        if (uniqueIds.size !== allCustomerIds.length) {
            throw new Error('Um mesmo cliente não pode estar em múltiplas mesas');
        }
        const createdSessions = [];
        // Processar cada distribuição
        for (const distribution of data.distributions) {
            if (distribution.customerIds.length === 0) {
                continue;
            }
            let targetSession;
            // Se a mesa é a mesma da sessão original, manter os clientes lá
            if (distribution.tableId === session.table_id) {
                targetSession = session;
            }
            else {
                // Verificar se mesa destino já tem sessão aberta
                targetSession = this.db.prepare(`
          SELECT * FROM table_sessions 
          WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
          ORDER BY opened_at DESC LIMIT 1
        `).get(distribution.tableId);
                // Se mesa destino não tem sessão, criar uma nova
                if (!targetSession) {
                    const newSessionId = this.generateUUID();
                    // Gerar número sequencial da sessão
                    const lastSession = this.db.prepare(`
            SELECT session_number FROM table_sessions 
            WHERE branch_id = ? 
            ORDER BY created_at DESC LIMIT 1
          `).get(session.branch_id);
                    const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
                    this.db.prepare(`
            INSERT INTO table_sessions (
              id, table_id, branch_id, session_number, status, opened_by
            ) VALUES (?, ?, ?, ?, 'open', ?)
          `).run(newSessionId, distribution.tableId, session.branch_id, sessionNumber, data.splitBy);
                    targetSession = this.db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(newSessionId);
                    this.logTableAction({
                        sessionId: newSessionId,
                        actionType: 'open_table',
                        performedBy: data.splitBy,
                        description: 'Mesa aberta para separação de clientes',
                        metadata: JSON.stringify({ fromSessionId: data.sessionId }),
                    });
                }
            }
            // Transferir clientes e seus pedidos
            for (const customerId of distribution.customerIds) {
                // Só transferir se não estiver na mesma sessão
                if (targetSession.id !== data.sessionId) {
                    // Atualizar session_id do cliente
                    this.db.prepare(`
            UPDATE table_customers 
            SET session_id = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(targetSession.id, customerId);
                    // Atualizar session_id de todos os pedidos do cliente
                    this.db.prepare(`
            UPDATE table_orders 
            SET session_id = ?, updated_at = datetime('now')
            WHERE table_customer_id = ?
          `).run(targetSession.id, customerId);
                }
            }
            // Recalcular totais da sessão destino
            this.updateTableSessionTotals(targetSession.id);
            createdSessions.push({
                tableId: distribution.tableId,
                sessionId: targetSession.id,
                customerCount: distribution.customerIds.length,
            });
        }
        // Registrar ação na sessão original
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'split_table',
            performedBy: data.splitBy,
            description: `Mesa separada em ${createdSessions.length} mesa(s)`,
            metadata: JSON.stringify({
                distributions: createdSessions,
                totalCustomers: allCustomerIds.length
            }),
        });
        // Verificar se restaram clientes na sessão original
        const remainingCustomers = this.db.prepare('SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?').get(data.sessionId);
        if (remainingCustomers.count === 0) {
            // Fechar sessão original se não restaram clientes
            this.db.prepare(`
        UPDATE table_sessions 
        SET status = 'closed', closed_at = datetime('now'), closed_by = ?
        WHERE id = ?
      `).run(data.splitBy, data.sessionId);
            this.logTableAction({
                sessionId: data.sessionId,
                actionType: 'close_table',
                performedBy: data.splitBy,
                description: 'Mesa fechada (todos os clientes foram distribuídos)',
                metadata: JSON.stringify({ reason: 'split_completed' }),
            });
        }
        return {
            success: true,
            message: `Mesa separada com sucesso em ${createdSessions.length} mesa(s)`,
            sessions: createdSessions
        };
    }
    /**
     * Atualizar totais de uma sessão (helper method)
     */
    updateTableSessionTotals(sessionId) {
        const totals = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_amount
      FROM table_customers
      WHERE session_id = ?
    `).get(sessionId);
        this.db.prepare(`
      UPDATE table_sessions
      SET total_amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(totals.total_amount, sessionId);
    }
    /**
     * Processar pagamento de cliente individual
     * CRIA UMA VENDA COMPLETA NO SISTEMA (como PDV)
     */
    processTableCustomerPayment(data) {
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }
        const customer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.tableCustomerId);
        if (!customer) {
            throw new Error('Cliente não encontrado');
        }
        // Buscar pedidos do cliente
        const orders = this.db.prepare(`
      SELECT o.*, p.name as product_name
      FROM table_orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.table_customer_id = ? AND o.status != 'cancelled'
    `).all(data.tableCustomerId);
        if (orders.length === 0) {
            throw new Error('Cliente não possui pedidos');
        }
        // Gerar número de venda único
        const lastSale = this.db.prepare('SELECT sale_number FROM sales ORDER BY created_at DESC LIMIT 1').get();
        const lastNumber = lastSale?.sale_number ? parseInt(lastSale.sale_number.split('-')[1]) : 0;
        const saleNumber = `SALE-${String(lastNumber + 1).padStart(6, '0')}`;
        // Criar venda (SALE)
        const saleId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO sales (
        id, sale_number, branch_id, type, table_id, customer_id, 
        cashier_id, status, subtotal, total, muntu_savings, 
        opened_at, closed_at
      ) VALUES (?, ?, ?, 'table', ?, ?, ?, 'paid', ?, ?, ?, datetime('now'), datetime('now'))
    `).run(saleId, saleNumber, session.branch_id, session.table_id, customer.customer_id || null, // ID do cliente cadastrado (se houver)
        data.processedBy, customer.total, customer.total, 0 // muntu_savings será calculado pelos itens
        );
        // Adicionar itens da venda (SALE_ITEMS)
        let totalMuntuSavings = 0;
        for (const order of orders) {
            const itemId = this.generateUUID();
            // Calcular economia Muntu
            let muntuSavings = 0;
            if (order.is_muntu) {
                const product = this.db.prepare('SELECT price_unit, muntu_quantity FROM products WHERE id = ?').get(order.product_id);
                if (product) {
                    const regularPrice = product.price_unit * order.qty_units;
                    muntuSavings = regularPrice - order.total;
                    totalMuntuSavings += muntuSavings;
                }
            }
            this.db.prepare(`
        INSERT INTO sale_items (
          id, sale_id, product_id, qty_units, is_muntu, 
          unit_price, unit_cost, subtotal, total, muntu_savings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, saleId, order.product_id, order.qty_units, order.is_muntu ? 1 : 0, order.unit_price, order.unit_cost, order.subtotal, order.total, muntuSavings);
        }
        // Atualizar economia Muntu na venda
        if (totalMuntuSavings > 0) {
            this.db.prepare('UPDATE sales SET muntu_savings = ? WHERE id = ?').run(totalMuntuSavings, saleId);
        }
        // Criar pagamento vinculado à venda
        const paymentId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO payments (
        id, sale_id, method, amount, reference_number, status, processed_at
      ) VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))
    `).run(paymentId, saleId, data.method, data.amount, data.referenceNumber || null);
        // Criar pagamento de mesa (table_payments) para rastreamento
        const tablePaymentId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO table_payments (
        id, session_id, table_customer_id, payment_id, method, amount, 
        reference_number, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tablePaymentId, data.sessionId, data.tableCustomerId, paymentId, data.method, data.amount, data.referenceNumber || null, data.processedBy);
        // Atualizar status dos pedidos para 'paid'
        this.db.prepare(`
      UPDATE table_orders 
      SET status = 'paid', updated_at = datetime('now')
      WHERE table_customer_id = ? AND status != 'cancelled'
    `).run(data.tableCustomerId);
        // Atualizar total pago do cliente
        this.db.prepare(`
      UPDATE table_customers 
      SET paid_amount = paid_amount + ?,
          payment_status = CASE 
            WHEN paid_amount + ? >= total THEN 'paid'
            WHEN paid_amount + ? > 0 THEN 'partial'
            ELSE 'pending'
          END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(data.amount, data.amount, data.amount, data.tableCustomerId);
        // Atualizar total pago da sessão
        this.db.prepare(`
      UPDATE table_sessions 
      SET paid_amount = paid_amount + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(data.amount, data.sessionId);
        // Atualizar totais do caixa
        const currentCashBox = this.getCurrentCashBox();
        if (currentCashBox) {
            this.updateCashBoxTotals(currentCashBox.id, data.amount, data.method);
        }
        // Adicionar pontos de fidelidade (se cliente cadastrado)
        if (customer.customer_id) {
            try {
                // 1 ponto para cada 1.000 FCFA (100.000 centavos) - MESMA LÓGICA DO PDV
                const pointsToAdd = Math.floor(data.amount / 100000);
                if (pointsToAdd > 0) {
                    this.db.prepare(`
            UPDATE customers 
            SET loyalty_points = loyalty_points + ?,
                updated_at = datetime('now'),
                synced = 0
            WHERE id = ?
          `).run(pointsToAdd, customer.customer_id);
                    console.log(`[LOYALTY] ${pointsToAdd} pontos adicionados ao cliente ${customer.customer_id}`);
                }
            }
            catch (error) {
                console.error('[LOYALTY] Erro ao adicionar pontos:', error);
            }
        }
        // Adicionar à fila de sincronização
        this.addToSyncQueue('create', 'sale', saleId, { saleNumber, amount: data.amount }, 1);
        // Registrar ação
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'payment',
            performedBy: data.processedBy,
            description: `Pagamento de ${data.amount / 100} FCFA (${data.method}) - Venda ${saleNumber}`,
            metadata: JSON.stringify({
                customerId: data.tableCustomerId,
                saleId,
                saleNumber,
                amount: data.amount,
                method: data.method
            }),
        });
        return {
            success: true,
            saleId,
            saleNumber,
            paymentId,
            tablePaymentId,
            amount: data.amount,
            muntuSavings: totalMuntuSavings
        };
    }
    /**
     * Processar pagamento total da mesa
     * CRIA UMA VENDA COMPLETA NO SISTEMA (como PDV)
     */
    processTableSessionPayment(data) {
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }
        // Buscar todos os pedidos não pagos da sessão
        const orders = this.db.prepare(`
      SELECT o.*, p.name as product_name, c.customer_id, c.customer_name
      FROM table_orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN table_customers c ON o.table_customer_id = c.id
      WHERE o.session_id = ? AND o.status != 'cancelled' AND o.status != 'paid'
    `).all(data.sessionId);
        if (orders.length === 0) {
            throw new Error('Nenhum pedido pendente para pagamento');
        }
        // Calcular total dos pedidos
        const totalOrders = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        // Gerar número de venda único
        const lastSale = this.db.prepare('SELECT sale_number FROM sales ORDER BY created_at DESC LIMIT 1').get();
        const lastNumber = lastSale?.sale_number ? parseInt(lastSale.sale_number.split('-')[1]) : 0;
        const saleNumber = `SALE-${String(lastNumber + 1).padStart(6, '0')}`;
        // Verificar se há cliente único cadastrado na mesa
        const customers = this.db.prepare(`
      SELECT DISTINCT customer_id 
      FROM table_customers 
      WHERE session_id = ? AND customer_id IS NOT NULL
    `).all(data.sessionId);
        const singleCustomerId = customers.length === 1 ? customers[0].customer_id : null;
        // Criar venda (SALE)
        const saleId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO sales (
        id, sale_number, branch_id, type, table_id, customer_id, 
        cashier_id, status, subtotal, total, muntu_savings, 
        opened_at, closed_at
      ) VALUES (?, ?, ?, 'table', ?, ?, ?, 'paid', ?, ?, ?, datetime('now'), datetime('now'))
    `).run(saleId, saleNumber, session.branch_id, session.table_id, singleCustomerId, data.processedBy, totalOrders, totalOrders, 0 // será atualizado depois
        );
        // Adicionar itens da venda (SALE_ITEMS) e calcular economia Muntu
        let totalMuntuSavings = 0;
        const customerIds = new Set();
        for (const order of orders) {
            const itemId = this.generateUUID();
            // Calcular economia Muntu
            let muntuSavings = 0;
            if (order.is_muntu) {
                const product = this.db.prepare('SELECT price_unit FROM products WHERE id = ?').get(order.product_id);
                if (product) {
                    const regularPrice = product.price_unit * order.qty_units;
                    muntuSavings = regularPrice - order.total;
                    totalMuntuSavings += muntuSavings;
                }
            }
            this.db.prepare(`
        INSERT INTO sale_items (
          id, sale_id, product_id, qty_units, is_muntu, 
          unit_price, unit_cost, subtotal, total, muntu_savings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, saleId, order.product_id, order.qty_units, order.is_muntu ? 1 : 0, order.unit_price, order.unit_cost, order.subtotal, order.total, muntuSavings);
            // Coletar IDs de clientes para pontos
            if (order.customer_id) {
                customerIds.add(order.customer_id);
            }
        }
        // Atualizar economia Muntu na venda
        if (totalMuntuSavings > 0) {
            this.db.prepare('UPDATE sales SET muntu_savings = ? WHERE id = ?').run(totalMuntuSavings, saleId);
        }
        // Criar pagamento vinculado à venda
        const paymentId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO payments (
        id, sale_id, method, amount, reference_number, status, processed_at
      ) VALUES (?, ?, ?, ?, ?, 'completed', datetime('now'))
    `).run(paymentId, saleId, data.method, data.amount, data.referenceNumber || null);
        // Criar pagamento de mesa (table_payments)
        const tablePaymentId = this.generateUUID();
        this.db.prepare(`
      INSERT INTO table_payments (
        id, session_id, payment_id, method, amount, reference_number, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tablePaymentId, data.sessionId, paymentId, data.method, data.amount, data.referenceNumber || null, data.processedBy);
        // Atualizar status dos pedidos para 'paid'
        this.db.prepare(`
      UPDATE table_orders 
      SET status = 'paid', updated_at = datetime('now')
      WHERE session_id = ? AND status != 'cancelled' AND status != 'paid'
    `).run(data.sessionId);
        // Atualizar pagamento de todos os clientes
        this.db.prepare(`
      UPDATE table_customers 
      SET paid_amount = total,
          payment_status = 'paid',
          updated_at = datetime('now')
      WHERE session_id = ?
    `).run(data.sessionId);
        // Atualizar total pago da sessão
        this.db.prepare(`
      UPDATE table_sessions 
      SET paid_amount = paid_amount + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(data.amount, data.sessionId);
        // Atualizar totais do caixa
        const currentCashBox = this.getCurrentCashBox();
        if (currentCashBox) {
            this.updateCashBoxTotals(currentCashBox.id, data.amount, data.method);
        }
        // Adicionar pontos de fidelidade para cada cliente cadastrado
        // 1 ponto para cada 1.000 FCFA (100.000 centavos) - MESMA LÓGICA DO PDV
        const pointsToAdd = Math.floor(data.amount / 100000);
        if (pointsToAdd > 0) {
            for (const customerId of customerIds) {
                try {
                    this.db.prepare(`
            UPDATE customers 
            SET loyalty_points = loyalty_points + ?,
                updated_at = datetime('now'),
                synced = 0
            WHERE id = ?
          `).run(pointsToAdd, customerId);
                    console.log(`[LOYALTY] ${pointsToAdd} pontos adicionados ao cliente ${customerId}`);
                }
                catch (error) {
                    console.error('[LOYALTY] Erro ao adicionar pontos:', error);
                }
            }
        }
        // Adicionar à fila de sincronização
        this.addToSyncQueue('create', 'sale', saleId, { saleNumber, amount: data.amount }, 1);
        // Registrar ação
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'payment',
            performedBy: data.processedBy,
            description: `Pagamento total de ${data.amount / 100} FCFA (${data.method}) - Venda ${saleNumber}`,
            metadata: JSON.stringify({
                saleId,
                saleNumber,
                amount: data.amount,
                method: data.method,
                customersCount: customerIds.size
            }),
        });
        return {
            success: true,
            saleId,
            saleNumber,
            paymentId,
            tablePaymentId,
            amount: data.amount,
            muntuSavings: totalMuntuSavings,
            itemsCount: orders.length
        };
    }
    /**
     * Fechar sessão de mesa
     */
    closeTableSession(data) {
        const session = this.getTableSessionById(data.sessionId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }
        if (session.status === 'closed') {
            throw new Error('Mesa já está fechada');
        }
        // Verificar se há pagamentos pendentes
        if ((session.paid_amount || 0) < (session.total_amount || 0)) {
            throw new Error('Há valores pendentes de pagamento');
        }
        // Fechar sessão
        this.db.prepare(`
      UPDATE table_sessions 
      SET status = 'closed', 
          closed_by = ?, 
          closed_at = datetime('now'),
          notes = CASE WHEN notes IS NULL THEN ? ELSE notes || ' | ' || ? END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(data.closedBy, data.notes || null, data.notes || null, data.sessionId);
        // Registrar ação
        this.logTableAction({
            sessionId: data.sessionId,
            actionType: 'close_table',
            performedBy: data.closedBy,
            description: `Mesa fechada`,
            metadata: JSON.stringify({ notes: data.notes }),
        });
        return this.getTableSessionById(data.sessionId);
    }
    /**
     * Definir pontos de fidelidade manualmente para um cliente
     */
    setCustomerLoyaltyPoints(customerCode, points) {
        // Buscar cliente
        const customer = this.db.prepare(`
      SELECT id, code, full_name, loyalty_points FROM customers WHERE code = ?
    `).get(customerCode);
        if (!customer) {
            throw new Error(`Cliente com código ${customerCode} não encontrado`);
        }
        const previousPoints = customer.loyalty_points || 0;
        // Atualizar pontos
        this.db.prepare(`
      UPDATE customers 
      SET loyalty_points = ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(points, customer.id);
        console.log(`[SET LOYALTY] Cliente: ${customer.full_name} (${customer.code})`);
        console.log(`[SET LOYALTY] Pontos anteriores: ${previousPoints}`);
        console.log(`[SET LOYALTY] Novos pontos: ${points}`);
        console.log(`[SET LOYALTY] Diferença: ${points - previousPoints}`);
        return {
            success: true,
            customerName: customer.full_name,
            customerCode: customer.code,
            previousPoints,
            newPoints: points,
            difference: points - previousPoints
        };
    }
    /**
     * Corrigir pontos de fidelidade de um cliente
     * Recalcula baseado no total de vendas (1 ponto = 1.000 FCFA)
     */
    fixCustomerLoyaltyPoints(customerCode) {
        // Buscar cliente
        const customer = this.db.prepare(`
      SELECT id, code, full_name, loyalty_points FROM customers WHERE code = ?
    `).get(customerCode);
        if (!customer) {
            throw new Error(`Cliente com código ${customerCode} não encontrado`);
        }
        // Calcular total de vendas do cliente (em centavos)
        const salesTotal = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_spent
      FROM sales
      WHERE customer_id = ? AND status = 'paid'
    `).get(customer.id);
        // Calcular pontos corretos: 1 ponto para cada 1.000 FCFA (100.000 centavos)
        const correctPoints = Math.floor((salesTotal?.total_spent || 0) / 100000);
        const currentPoints = customer.loyalty_points || 0;
        const difference = correctPoints - currentPoints;
        console.log(`[FIX LOYALTY] Cliente: ${customer.full_name} (${customer.code})`);
        console.log(`[FIX LOYALTY] Total gasto: ${(salesTotal?.total_spent || 0) / 100} FCFA`);
        console.log(`[FIX LOYALTY] Pontos atuais: ${currentPoints}`);
        console.log(`[FIX LOYALTY] Pontos corretos: ${correctPoints}`);
        console.log(`[FIX LOYALTY] Diferença: ${difference}`);
        // Atualizar pontos
        this.db.prepare(`
      UPDATE customers 
      SET loyalty_points = ?,
          updated_at = datetime('now'),
          synced = 0
      WHERE id = ?
    `).run(correctPoints, customer.id);
        return {
            success: true,
            customerName: customer.full_name,
            customerCode: customer.code,
            previousPoints: currentPoints,
            correctPoints: correctPoints,
            difference: difference,
            totalSpent: (salesTotal?.total_spent || 0) / 100
        };
    }
    /**
     * Atualizar totais do cliente
     */
    updateTableCustomerTotals(tableCustomerId) {
        const totals = this.db.prepare(`
      SELECT 
        COALESCE(SUM(subtotal), 0) as subtotal,
        COALESCE(SUM(total), 0) as total
      FROM table_orders
      WHERE table_customer_id = ? AND status != 'cancelled'
    `).get(tableCustomerId);
        this.db.prepare(`
      UPDATE table_customers 
      SET subtotal = ?, total = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(totals.subtotal, totals.total, tableCustomerId);
    }
    /**
     * Registrar ação de auditoria
     */
    logTableAction(data) {
        const id = this.generateUUID();
        this.db.prepare(`
      INSERT INTO table_actions (
        id, session_id, action_type, performed_by, description, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.sessionId, data.actionType, data.performedBy, data.description, data.metadata || null);
    }
    /**
     * Buscar histórico de ações de uma sessão
     */
    getTableSessionActions(sessionId) {
        return this.db.prepare(`
      SELECT * FROM table_actions 
      WHERE session_id = ? 
      ORDER BY performed_at DESC
    `).all(sessionId);
    }
    /**
     * Obter resumo de todas as mesas (dashboard)
     */
    getTablesOverview(branchId) {
        const tables = this.getTables({ branchId, isActive: true });
        return tables.map((table) => {
            const session = this.db.prepare(`
        SELECT * FROM table_sessions 
        WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
        ORDER BY opened_at DESC LIMIT 1
      `).get(table.id);
            if (session) {
                const customerCount = this.db.prepare(`
          SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?
        `).get(session.id);
                const orderCount = this.db.prepare(`
          SELECT COUNT(*) as count FROM table_orders 
          WHERE session_id = ? AND status != 'cancelled'
        `).get(session.id);
                return {
                    ...table,
                    status: session.status,
                    sessionId: session.id,
                    customerCount: customerCount.count,
                    orderCount: orderCount.count,
                    totalAmount: session.total_amount,
                    paidAmount: session.paid_amount,
                    openedAt: session.opened_at,
                };
            }
            return {
                ...table,
                status: 'available',
                sessionId: null,
                customerCount: 0,
                orderCount: 0,
                totalAmount: 0,
                paidAmount: 0,
                openedAt: null,
            };
        });
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
    // Seed Data
    // ============================================
    async seedInitialData() {
        // Migrar branch-1 para main-branch se existir
        const oldBranch = this.db.prepare('SELECT id FROM branches WHERE id = ?').get('branch-1');
        if (oldBranch) {
            console.log('Migrando branch-1 para main-branch...');
            // Atualizar tabelas que referenciam branch_id
            this.db.prepare('UPDATE tables SET branch_id = ? WHERE branch_id = ?').run('main-branch', 'branch-1');
            this.db.prepare('UPDATE table_sessions SET branch_id = ? WHERE branch_id = ?').run('main-branch', 'branch-1');
            this.db.prepare('UPDATE inventory SET branch_id = ? WHERE branch_id = ?').run('main-branch', 'branch-1');
            this.db.prepare('UPDATE sales SET branch_id = ? WHERE branch_id = ?').run('main-branch', 'branch-1');
            this.db.prepare('UPDATE cash_boxes SET branch_id = ? WHERE branch_id = ?').run('main-branch', 'branch-1');
            // Atualizar o próprio branch
            this.db.prepare('UPDATE branches SET id = ? WHERE id = ?').run('main-branch', 'branch-1');
            console.log('✅ Branch migrado para main-branch!');
            return;
        }
        // Verifica se a filial padrão já existe
        const existingBranch = this.db.prepare('SELECT COUNT(*) as count FROM branches').get();
        if (existingBranch.count > 0) {
            console.log('Filial padrão já existe, pulando seed inicial');
            return;
        }
        console.log('Criando dados essenciais do sistema...');
        // Criar filial padrão com ID main-branch
        const branchId = 'main-branch';
        this.db.prepare(`
      INSERT INTO branches (id, name, code, is_main, is_active, created_at, updated_at)
      VALUES (?, 'Filial Principal', 'MAIN', 1, 1, datetime('now'), datetime('now'))
    `).run(branchId);
        console.log('✅ Filial padrão criada!');
    }
    // ============================================
    // Data Migrations
    // ============================================
    /**
     * Corrige unit_cost nos sale_items existentes usando cost_unit dos produtos
     * Esta migration deve ser executada uma vez após atualização do código
     */
    fixUnitCostInSaleItems() {
        try {
            // Verificar quantos sale_items têm unit_cost = 0 ou NULL
            const countBefore = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM sale_items 
        WHERE unit_cost IS NULL OR unit_cost = 0
      `).get();
            console.log(`[Migration] Sale items com unit_cost = 0 ou NULL: ${countBefore.count}`);
            if (countBefore.count > 0) {
                // Atualizar unit_cost usando o cost_unit do produto
                const result = this.db.prepare(`
          UPDATE sale_items 
          SET unit_cost = (
            SELECT cost_unit 
            FROM products 
            WHERE id = sale_items.product_id
          ) 
          WHERE unit_cost IS NULL OR unit_cost = 0
        `).run();
                console.log(`[Migration] ✅ ${result.changes} registros atualizados!`);
                // Verificar novamente
                const countAfter = this.db.prepare(`
          SELECT COUNT(*) as count 
          FROM sale_items 
          WHERE unit_cost IS NULL OR unit_cost = 0
        `).get();
                console.log(`[Migration] Sale items com unit_cost = 0 ou NULL após atualização: ${countAfter.count}`);
                return {
                    success: true,
                    recordsBefore: countBefore.count,
                    recordsUpdated: result.changes,
                    recordsAfter: countAfter.count
                };
            }
            else {
                console.log('[Migration] ✅ Todos os sale_items já têm unit_cost preenchido!');
                return {
                    success: true,
                    recordsBefore: 0,
                    recordsUpdated: 0,
                    recordsAfter: 0
                };
            }
        }
        catch (error) {
            console.error('[Migration] ❌ Erro ao corrigir unit_cost:', error);
            throw error;
        }
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
    generateSequentialNumber(lastNumber, prefix) {
        if (!lastNumber) {
            return `${prefix}-00001`;
        }
        // Extrair o número do formato PREFIX-XXXXX
        const match = lastNumber.match(/(\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10) + 1;
            return `${prefix}-${num.toString().padStart(5, '0')}`;
        }
        return `${prefix}-00001`;
    }
    /**
     * Criar vendas de exemplo para testes de relatórios
     */
    seedSampleSales() {
        try {
            console.log('[Seed] Verificando necessidade de criar vendas de exemplo...');
            // Verificar se já existem vendas
            const existingSales = this.db.prepare('SELECT COUNT(*) as count FROM sales').get();
            if (existingSales.count > 0) {
                console.log(`[Seed] Já existem ${existingSales.count} vendas no banco`);
                return;
            }
            console.log('[Seed] Criando vendas de exemplo...');
            const branchId = 'main-branch';
            const cashierId = 'admin';
            // Criar 20 vendas nos últimos 30 dias
            for (let i = 0; i < 20; i++) {
                const daysAgo = Math.floor(Math.random() * 30);
                const date = new Date();
                date.setDate(date.getDate() - daysAgo);
                const saleId = this.generateUUID();
                const saleNumber = `VD-${String(i + 1).padStart(5, '0')}`;
                const subtotal = Math.floor(Math.random() * 50000) + 10000; // 10k a 60k
                const muntuSavings = Math.floor(Math.random() * 5000);
                const total = subtotal - muntuSavings;
                this.db.prepare(`
          INSERT INTO sales (
            id, sale_number, branch_id, cashier_id, status,
            subtotal, total, muntu_savings, 
            opened_at, closed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'closed', ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, saleNumber, branchId, cashierId, subtotal, total, muntuSavings, date.toISOString(), date.toISOString(), date.toISOString(), date.toISOString());
            }
            console.log('[Seed] ✅ 20 vendas de exemplo criadas!');
        }
        catch (error) {
            console.error('[Seed] ❌ Erro ao criar vendas de exemplo:', error);
        }
    }
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=manager.js.map