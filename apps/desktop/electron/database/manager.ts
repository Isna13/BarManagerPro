// Importar better-sqlite3 com fallback
let Database: any;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.error('⚠️ better-sqlite3 não disponível - modo apenas online');
  Database = null;
}
import * as fs from 'fs';
import * as path from 'path';
import { tryNormalizePaymentMethod, isValidPaymentMethod, PaymentMethod } from '../shared/payment-methods';

// ============================================
// Interfaces para tipos de dados SQLite
// ============================================
interface TableRow {
  id: string;
  number?: number;
  name?: string;
  [key: string]: any;
}

interface SessionRow {
  id: string;
  session_number?: string;
  status?: string;
  table_id?: string;
  branch_id?: string;
  customer_count?: number;
  total_amount?: number;
  paid_amount?: number;
  opened_at?: string;
  [key: string]: any;
}

interface CustomerRow {
  id: string;
  session_id?: string;
  order_sequence?: number;
  total?: number;
  orders?: any[];
  [key: string]: any;
}

interface OrderRow {
  id: string;
  session_id?: string;
  table_customer_id?: string;
  product_id?: string;
  qty_units?: number;
  is_muntu?: number;
  unit_price?: number;
  unit_cost?: number;
  status?: string;
  [key: string]: any;
}

interface ProductRow {
  id: string;
  name?: string;
  sku?: string;
  box_price?: number;
  unit_price?: number;
  unit_cost?: number;
  branch_id?: string;
  [key: string]: any;
}

interface StatsRow {
  customer_count?: number;
  total_amount?: number;
  [key: string]: any;
}

interface TotalsRow {
  total?: number;
  [key: string]: any;
}

interface CountRow {
  count?: number;
  [key: string]: any;
}

export class DatabaseManager {
  private db: any = null;

  constructor(private dbPath: string) {}

  async initialize() {
    if (!Database) {
      throw new Error('better-sqlite3 não disponível');
    }
    
    this.db = new Database(this.dbPath, { verbose: console.log });
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    await this.createTables();
    await this.runMigrations();
    await this.seedInitialData();
  }

  isAvailable(): boolean {
    return this.db !== null;
  }

  private async createTables() {
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
        allowed_tabs TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_login DATETIME,
        synced BOOLEAN DEFAULT 0,
        sync_status TEXT DEFAULT 'PENDING',
        server_id TEXT,
        last_sync DATETIME,
        last_sync_attempt DATETIME,
        sync_error TEXT,
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
        processed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sync Audit Log (log de auditoria de sincronização)
      CREATE TABLE IF NOT EXISTS sync_audit_log (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        direction TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sync Conflicts (conflitos de sincronização)
      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_data TEXT NOT NULL,
        server_data TEXT NOT NULL,
        local_device_id TEXT NOT NULL,
        server_device_id TEXT,
        local_timestamp DATETIME NOT NULL,
        server_timestamp DATETIME NOT NULL,
        resolution TEXT,
        resolved_at DATETIME,
        resolved_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Dead Letter Queue (itens que falharam definitivamente)
      CREATE TABLE IF NOT EXISTS sync_dead_letter (
        id TEXT PRIMARY KEY,
        original_item_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data TEXT NOT NULL,
        priority INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        original_created_at DATETIME,
        moved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        resolved_at DATETIME,
        resolved_by TEXT,
        resolution_action TEXT
      );

      -- Device Registry (registro de dispositivos ativos)
      CREATE TABLE IF NOT EXISTS device_registry (
        device_id TEXT PRIMARY KEY,
        device_name TEXT,
        last_heartbeat DATETIME NOT NULL,
        last_sync DATETIME,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        amount INTEGER DEFAULT 0,
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
        name TEXT,
        seats INTEGER DEFAULT 4,
        area TEXT,
        status TEXT DEFAULT 'available',
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

  private async runMigrations() {
    // Migration 1: Adicionar campo supplier_id à tabela products
    try {
      const tableInfo: any[] = this.db.pragma('table_info(products)') as any[];
      const hasSupplierColumn = tableInfo.some((col: any) => col.name === 'supplier_id');
      
      if (!hasSupplierColumn) {
        console.log('Executando migration: adicionando coluna supplier_id em products...');
        this.db.exec('ALTER TABLE products ADD COLUMN supplier_id TEXT');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id)');
        console.log('✅ Migration supplier_id concluída!');
      }
    } catch (error) {
      console.error('Erro na migration supplier_id:', error);
    }

    // Migration 2: Adicionar colunas dose_enabled e doses_per_bottle
    try {
      const tableInfo: any[] = this.db.pragma('table_info(products)') as any[];
      const hasDoseEnabled = tableInfo.some((col: any) => col.name === 'dose_enabled');
      
      if (!hasDoseEnabled) {
        console.log('Executando migration: adicionando colunas de dose em products...');
        this.db.exec('ALTER TABLE products ADD COLUMN dose_enabled BOOLEAN DEFAULT 0');
        this.db.exec('ALTER TABLE products ADD COLUMN doses_per_bottle INTEGER DEFAULT 0');
        console.log('✅ Migration dose columns concluída!');
      }
    } catch (error) {
      console.error('Erro na migration dose columns:', error);
    }

    // Migration 3: Adicionar colunas avançadas de inventário
    try {
      const invTableInfo: any[] = this.db.pragma('table_info(inventory_items)') as any[];
      const hasClosedBoxes = invTableInfo.some((col: any) => col.name === 'closed_boxes');
      
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
    } catch (error) {
      console.error('Erro na migration inventory advanced:', error);
    }

    // Migration 4: Criar tabela stock_movements se não existir
    try {
      const tables: any[] = this.db.pragma('table_list') as any[];
      const hasStockMovements = tables.some((t: any) => t.name === 'stock_movements');
      
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
    } catch (error) {
      console.error('Erro na migration stock_movements:', error);
    }

    // Migration 5: Migrar dados de inventory para inventory_items
    try {
      // Verificar se existem dados na tabela antiga
      const oldInventoryCount: any = this.db.prepare('SELECT COUNT(*) as count FROM inventory').get();
      const newInventoryCount: any = this.db.prepare('SELECT COUNT(*) as count FROM inventory_items').get();
      
      if (oldInventoryCount.count > 0 && newInventoryCount.count === 0) {
        console.log('Executando migration: migrando dados de inventory para inventory_items...');
        
        // Buscar todos os registros da tabela antiga com informações do produto
        const oldInventory: any[] = this.db.prepare(`
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
          
          insertStmt.run(
            item.id,
            item.product_id,
            item.branch_id,
            totalUnits,
            closedBoxes,
            openBoxUnits,
            item.created_at,
            item.updated_at
          );
        }
        
        console.log(`✅ Migration de ${oldInventory.length} registros concluída!`);
      } else if (newInventoryCount.count > 0) {
        console.log('Dados já existem em inventory_items, pulando migração de dados.');
      }
    } catch (error) {
      console.error('Erro na migration de dados de inventory:', error);
    }

    // Migration 8: Corrigir valores de closed_boxes e open_box_units no estoque
    try {
      console.log('\nVerificando necessidade de correção de estoque (caixas/unidades)...');
      
      const inventoryItems: any[] = this.db.prepare(`
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
      } else {
        console.log('✅ Estoque já está correto, nenhuma correção necessária.');
      }
    } catch (error) {
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
      } else {
        console.log('✅ Todos os clientes já possuem loyalty_points definido.');
      }
    } catch (error) {
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
    } catch (error) {
      console.error('Erro ao criar tabelas de gestão de mesas:', error);
    }

    // Migration 11: Adicionar coluna payment_method à tabela sales
    // CRÍTICO: Necessário para rastrear método de pagamento original (especialmente VALE)
    try {
      const salesTableInfo: any[] = this.db.pragma('table_info(sales)') as any[];
      const hasPaymentMethod = salesTableInfo.some((col: any) => col.name === 'payment_method');
      
      if (!hasPaymentMethod) {
        console.log('Executando migration: adicionando coluna payment_method em sales...');
        this.db.exec('ALTER TABLE sales ADD COLUMN payment_method TEXT');
        console.log('✅ Migration payment_method em sales concluída!');
      }
    } catch (error) {
      console.error('Erro na migration payment_method:', error);
    }

    // Migration 12: Adicionar coluna amount à tabela debts
    // CRÍTICO: Necessário para sincronização de dívidas do servidor Railway
    try {
      const debtsTableInfo: any[] = this.db.pragma('table_info(debts)') as any[];
      const hasAmount = debtsTableInfo.some((col: any) => col.name === 'amount');
      
      if (!hasAmount) {
        console.log('Executando migration: adicionando coluna amount em debts...');
        this.db.exec('ALTER TABLE debts ADD COLUMN amount INTEGER DEFAULT 0');
        // Atualizar registros existentes: amount = original_amount
        this.db.exec('UPDATE debts SET amount = original_amount WHERE amount IS NULL OR amount = 0');
        console.log('✅ Migration amount em debts concluída!');
      }
    } catch (error) {
      console.error('Erro na migration amount em debts:', error);
    }

    // Migration 13: Adicionar coluna allowed_tabs para controle de acesso por abas
    // IMPORTANTE: Permite que administradores definam quais abas cada usuário pode acessar
    try {
      const usersTableInfo: any[] = this.db.pragma('table_info(users)') as any[];
      const hasAllowedTabs = usersTableInfo.some((col: any) => col.name === 'allowed_tabs');
      
      if (!hasAllowedTabs) {
        console.log('Executando migration: adicionando coluna allowed_tabs em users...');
        // JSON array com as abas permitidas. NULL significa todas as abas (para admins)
        this.db.exec('ALTER TABLE users ADD COLUMN allowed_tabs TEXT');
        console.log('✅ Migration allowed_tabs em users concluída!');
      }
    } catch (error) {
      console.error('Erro na migration allowed_tabs:', error);
    }

    // Migration 14: Criar tabela backup_history para histórico de backups
    try {
      const tables: any[] = this.db.pragma('table_list') as any[];
      const hasBackupHistory = tables.some((t: any) => t.name === 'backup_history');
      
      if (!hasBackupHistory) {
        console.log('Executando migration: criando tabela backup_history...');
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS backup_history (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            backup_type TEXT DEFAULT 'manual', -- manual, automatic
            status TEXT DEFAULT 'completed', -- completed, failed
            error_message TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at);
        `);
        console.log('✅ Migration backup_history table concluída!');
      }
    } catch (error) {
      console.error('Erro na migration backup_history:', error);
    }

    // Migration 15: Adicionar colunas name e status à tabela tables
    try {
      const tablesInfo: any[] = this.db.pragma('table_info(tables)') as any[];
      const hasName = tablesInfo.some((col: any) => col.name === 'name');
      const hasStatus = tablesInfo.some((col: any) => col.name === 'status');
      
      if (!hasName) {
        console.log('Executando migration: adicionando coluna name em tables...');
        this.db.exec('ALTER TABLE tables ADD COLUMN name TEXT');
        // Atualizar registros existentes com nome padrão
        this.db.exec(`UPDATE tables SET name = 'Mesa ' || number WHERE name IS NULL`);
        console.log('✅ Migration tables.name concluída!');
      }
      
      if (!hasStatus) {
        console.log('Executando migration: adicionando coluna status em tables...');
        this.db.exec("ALTER TABLE tables ADD COLUMN status TEXT DEFAULT 'available'");
        console.log('✅ Migration tables.status concluída!');
      }
    } catch (error) {
      console.error('Erro na migration tables name/status:', error);
    }

    // Migration 16: Adicionar coluna updated_at à tabela sync_queue
    try {
      const syncQueueInfo: any[] = this.db.pragma('table_info(sync_queue)') as any[];
      const hasUpdatedAt = syncQueueInfo.some((col: any) => col.name === 'updated_at');
      
      if (!hasUpdatedAt) {
        console.log('Executando migration: adicionando coluna updated_at em sync_queue...');
        // SQLite não permite DEFAULT com função em ALTER TABLE, então adicionamos como NULL e depois atualizamos
        this.db.exec('ALTER TABLE sync_queue ADD COLUMN updated_at DATETIME');
        this.db.exec("UPDATE sync_queue SET updated_at = created_at WHERE updated_at IS NULL");
        console.log('✅ Migration sync_queue.updated_at concluída!');
      }
    } catch (error) {
      console.error('Erro na migration sync_queue updated_at:', error);
    }

    // Migration 17: Adicionar campos de controle de sincronização à tabela users
    try {
      const usersInfo: any[] = this.db.pragma('table_info(users)') as any[];
      const hasSyncStatus = usersInfo.some((col: any) => col.name === 'sync_status');
      const hasServerId = usersInfo.some((col: any) => col.name === 'server_id');
      const hasLastSyncAttempt = usersInfo.some((col: any) => col.name === 'last_sync_attempt');
      const hasSyncError = usersInfo.some((col: any) => col.name === 'sync_error');
      const hasAllowedTabs = usersInfo.some((col: any) => col.name === 'allowed_tabs');
      
      if (!hasSyncStatus) {
        console.log('Executando migration: adicionando coluna sync_status em users...');
        this.db.exec("ALTER TABLE users ADD COLUMN sync_status TEXT DEFAULT 'PENDING'");
        // Marcar usuários já sincronizados
        this.db.exec("UPDATE users SET sync_status = 'SYNCED' WHERE synced = 1");
        this.db.exec("UPDATE users SET sync_status = 'PENDING' WHERE synced = 0 OR synced IS NULL");
        console.log('✅ Migration users.sync_status concluída!');
      }
      
      if (!hasServerId) {
        console.log('Executando migration: adicionando coluna server_id em users...');
        this.db.exec('ALTER TABLE users ADD COLUMN server_id TEXT');
        // Para usuários já sincronizados, o server_id é o próprio id (pois usamos o mesmo ID)
        this.db.exec("UPDATE users SET server_id = id WHERE synced = 1");
        console.log('✅ Migration users.server_id concluída!');
      }
      
      if (!hasLastSyncAttempt) {
        console.log('Executando migration: adicionando coluna last_sync_attempt em users...');
        this.db.exec('ALTER TABLE users ADD COLUMN last_sync_attempt DATETIME');
        console.log('✅ Migration users.last_sync_attempt concluída!');
      }
      
      if (!hasSyncError) {
        console.log('Executando migration: adicionando coluna sync_error em users...');
        this.db.exec('ALTER TABLE users ADD COLUMN sync_error TEXT');
        console.log('✅ Migration users.sync_error concluída!');
      }
      
      if (!hasAllowedTabs) {
        console.log('Executando migration: adicionando coluna allowed_tabs em users...');
        this.db.exec('ALTER TABLE users ADD COLUMN allowed_tabs TEXT');
        console.log('✅ Migration users.allowed_tabs concluída!');
      }
    } catch (error) {
      console.error('Erro na migration users sync fields:', error);
    }

    // Migration 18: Adicionar coluna version para detecção de conflitos (versionamento otimista)
    try {
      // Adicionar version em sales
      const salesInfo: any[] = this.db.pragma('table_info(sales)') as any[];
      const salesHasVersion = salesInfo.some((col: any) => col.name === 'version');
      if (!salesHasVersion) {
        console.log('Executando migration: adicionando coluna version em sales...');
        this.db.exec('ALTER TABLE sales ADD COLUMN version INTEGER DEFAULT 1');
        console.log('✅ Migration sales.version concluída!');
      }

      // Adicionar version em customers
      const customersInfo: any[] = this.db.pragma('table_info(customers)') as any[];
      const customersHasVersion = customersInfo.some((col: any) => col.name === 'version');
      if (!customersHasVersion) {
        console.log('Executando migration: adicionando coluna version em customers...');
        this.db.exec('ALTER TABLE customers ADD COLUMN version INTEGER DEFAULT 1');
        console.log('✅ Migration customers.version concluída!');
      }

      // Adicionar version em inventory_items
      const inventoryInfo: any[] = this.db.pragma('table_info(inventory_items)') as any[];
      const inventoryHasVersion = inventoryInfo.some((col: any) => col.name === 'version');
      if (!inventoryHasVersion) {
        console.log('Executando migration: adicionando coluna version em inventory_items...');
        this.db.exec('ALTER TABLE inventory_items ADD COLUMN version INTEGER DEFAULT 1');
        console.log('✅ Migration inventory_items.version concluída!');
      }

      // Adicionar version em products
      const productsInfo: any[] = this.db.pragma('table_info(products)') as any[];
      const productsHasVersion = productsInfo.some((col: any) => col.name === 'version');
      if (!productsHasVersion) {
        console.log('Executando migration: adicionando coluna version em products...');
        this.db.exec('ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1');
        console.log('✅ Migration products.version concluída!');
      }

      // Adicionar version em purchases
      const purchasesInfo: any[] = this.db.pragma('table_info(purchases)') as any[];
      const purchasesHasVersion = purchasesInfo.some((col: any) => col.name === 'version');
      if (!purchasesHasVersion) {
        console.log('Executando migration: adicionando coluna version em purchases...');
        this.db.exec('ALTER TABLE purchases ADD COLUMN version INTEGER DEFAULT 1');
        console.log('✅ Migration purchases.version concluída!');
      }

      // Adicionar version em debts
      const debtsInfo: any[] = this.db.pragma('table_info(debts)') as any[];
      const debtsHasVersion = debtsInfo.some((col: any) => col.name === 'version');
      if (!debtsHasVersion) {
        console.log('Executando migration: adicionando coluna version em debts...');
        this.db.exec('ALTER TABLE debts ADD COLUMN version INTEGER DEFAULT 1');
        console.log('✅ Migration debts.version concluída!');
      }

    } catch (error) {
      console.error('Erro na migration version columns:', error);
    }

    // Migration 19: Adicionar coluna qty_boxes na tabela purchase_items
    // CRÍTICO: Necessário para sincronização de itens de compra do servidor Railway
    try {
      const purchaseItemsInfo: any[] = this.db.pragma('table_info(purchase_items)') as any[];
      const hasQtyBoxes = purchaseItemsInfo.some((col: any) => col.name === 'qty_boxes');
      
      if (!hasQtyBoxes) {
        console.log('Executando migration: adicionando coluna qty_boxes em purchase_items...');
        this.db.exec('ALTER TABLE purchase_items ADD COLUMN qty_boxes INTEGER DEFAULT 0');
        console.log('✅ Migration purchase_items.qty_boxes concluída!');
      }
    } catch (error) {
      console.error('Erro na migration qty_boxes:', error);
    }

    // Migration 20: Criar tabela inventory_movements se não existir
    // CRÍTICO: Necessário para sincronização e rastreamento de movimentações de estoque
    try {
      const tables: any[] = this.db.pragma('table_list') as any[];
      const hasInventoryMovements = tables.some((t: any) => t.name === 'inventory_movements');
      
      if (!hasInventoryMovements) {
        console.log('Executando migration: criando tabela inventory_movements...');
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS inventory_movements (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            branch_id TEXT NOT NULL,
            type TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste', 'transferencia'
            qty_before INTEGER NOT NULL,
            qty_after INTEGER NOT NULL,
            qty_changed INTEGER NOT NULL,
            closed_boxes_before INTEGER DEFAULT 0,
            closed_boxes_after INTEGER DEFAULT 0,
            open_box_units_before INTEGER DEFAULT 0,
            open_box_units_after INTEGER DEFAULT 0,
            reason TEXT NOT NULL,
            reference_type TEXT, -- 'sale', 'purchase', 'adjustment', 'transfer'
            reference_id TEXT,
            responsible TEXT,
            notes TEXT,
            synced BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (branch_id) REFERENCES branches(id)
          );
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch ON inventory_movements(branch_id);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(type);
          CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at);
        `);
        console.log('✅ Migration inventory_movements table concluída!');
      }
    } catch (error) {
      console.error('Erro na migration inventory_movements:', error);
    }

    // Migration 21: Adicionar coluna needs_online_auth para usuários sincronizados do servidor
    // CRÍTICO: Permite identificar usuários que precisam fazer login online primeiro
    try {
      const usersTableInfo: any[] = this.db.pragma('table_info(users)') as any[];
      const hasNeedsOnlineAuth = usersTableInfo.some((col: any) => col.name === 'needs_online_auth');
      
      if (!hasNeedsOnlineAuth) {
        console.log('Executando migration: adicionando coluna needs_online_auth em users...');
        this.db.exec('ALTER TABLE users ADD COLUMN needs_online_auth BOOLEAN DEFAULT 0');
        console.log('✅ Migration needs_online_auth em users concluída!');
      }
    } catch (error) {
      console.error('Erro na migration needs_online_auth:', error);
    }
    
    // Migration 22: Adicionar coluna synced para settings globais
    // CORREÇÃO F5: Permite sincronizar configurações entre PCs
    try {
      const settingsTableInfo: any[] = this.db.pragma('table_info(settings)') as any[];
      const hasSettingsSynced = settingsTableInfo.some((col: any) => col.name === 'synced');
      
      if (!hasSettingsSynced) {
        console.log('Executando migration: adicionando coluna synced em settings...');
        this.db.exec('ALTER TABLE settings ADD COLUMN synced BOOLEAN DEFAULT 0');
        // Marcar settings existentes como não sincronizadas
        this.db.exec('UPDATE settings SET synced = 0');
        console.log('✅ Migration synced em settings concluída!');
      }
    } catch (error) {
      console.error('Erro na migration synced em settings:', error);
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * 🔴 TRANSAÇÃO ATÔMICA: Wrapper para operações que precisam ser atômicas
   * Garante rollback automático em caso de erro
   */
  private runInTransaction<T>(operation: () => T): T {
    const transaction = this.db.transaction(() => {
      return operation();
    });
    return transaction();
  }

  createSale(data: any, skipSyncQueue: boolean = false) {
    // Se o ID já existe (vindo do servidor), usar ele; senão gerar novo
    const id = data.id || this.generateUUID();
    
    // Normalizar payment_method se fornecido
    const rawPaymentMethod = data.paymentMethod || data.payment_method;
    const paymentMethod = rawPaymentMethod ? tryNormalizePaymentMethod(rawPaymentMethod) : null;
    
    const stmt = this.db.prepare(`
      INSERT INTO sales (
        id, sale_number, branch_id, type, status, table_id, customer_id,
        cashier_id, subtotal, discount_total, tax_total, total,
        payment_method, notes, synced, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.saleNumber || data.sale_number || `SALE-${Date.now()}`,
      data.branchId || data.branch_id || 'main-branch',
      data.type || 'counter',
      data.status || 'open',
      data.tableId || data.table_id || null,
      data.customerId || data.customer_id || null,
      data.cashierId || data.cashier_id || data.createdBy || data.created_by || 'system',
      data.subtotal || 0,
      data.discount || data.discount_total || 0,
      data.tax || data.tax_total || 0,
      data.total || 0,
      paymentMethod, // Método de pagamento normalizado
      data.notes || null,
      skipSyncQueue ? 1 : (data.synced || 0),
      data.createdAt || data.created_at || new Date().toISOString(),
      data.updatedAt || data.updated_at || new Date().toISOString()
    );
    
    // Só adiciona na fila de sync se skipSyncQueue for false
    if (!skipSyncQueue) {
      // IMPORTANTE: Incluir o id nos dados para o backend usar o mesmo UUID
      const syncData = {
        ...data,
        id, // Garantir que o ID seja enviado para o backend
      };
      this.addToSyncQueue('create', 'sale', id, syncData, 1); // Alta prioridade
    }
    
    return this.getSaleById(id);
  }

  addSaleItem(saleId: string, itemData: any) {
    // Validar dados obrigatórios
    if (!itemData || !itemData.productId) {
      throw new Error('Dados do item inválidos: productId é obrigatório');
    }

    if (!itemData.branchId) {
      throw new Error('Dados do item inválidos: branchId é obrigatório');
    }

    // 🔴 CORREÇÃO CRÍTICA: Envolver em transação atômica
    // Se qualquer operação falhar (insert, update totais, deduct estoque),
    // todas as mudanças são revertidas automaticamente
    return this.runInTransaction(() => {
      const id = this.generateUUID();
      const stmt = this.db.prepare(`
        INSERT INTO sale_items 
        (id, sale_id, product_id, qty_units, is_muntu, unit_price, unit_cost, 
         subtotal, tax_amount, total, muntu_savings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, saleId, itemData.productId, itemData.qtyUnits, 
               itemData.isMuntu ? 1 : 0, itemData.unitPrice, itemData.unitCost,
               itemData.subtotal, itemData.taxAmount, itemData.total, itemData.muntuSavings);
      
      // Atualizar totais da venda
      this.updateSaleTotals(saleId);
      
      // Deduzir estoque usando o sistema avançado com abertura automática de caixas
      // Se falhar, a exceção será propagada e TODA a transação será revertida
      this.deductInventoryAdvanced(
        itemData.productId, 
        itemData.branchId, 
        itemData.qtyUnits,
        itemData.isMuntu || false,
        saleId,
        itemData.cashierId || 'system'
      );
      
      // Adicionar à fila - incluir saleId nos dados
      this.addToSyncQueue('create', 'sale_item', id, { ...itemData, saleId }, 1);
      
      return { id, ...itemData };
    });
  }

  addSalePayment(saleId: string, paymentData: any) {
    // Validar método de pagamento - NUNCA usar fallback
    const normalizedMethod = tryNormalizePaymentMethod(paymentData.method);
    if (!normalizedMethod) {
      console.error(`❌ Método de pagamento inválido: ${paymentData.method}`);
      throw new Error(`Método de pagamento inválido: ${paymentData.method}`);
    }
    
    // 🔴 CORREÇÃO CRÍTICA: Envolver em transação atômica
    // Garante que pagamento, atualização de venda e caixa são atômicos
    return this.runInTransaction(() => {
      const id = this.generateUUID();
      const stmt = this.db.prepare(`
        INSERT INTO payments 
        (id, sale_id, method, provider, amount, reference_number, transaction_id, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, 
        saleId, 
        normalizedMethod, // Método validado e normalizado
        paymentData.provider || null,
        paymentData.amount,
        paymentData.referenceNumber || null,
        paymentData.transactionId || null,
        paymentData.status || 'completed',
        paymentData.notes || null
      );
      
      // Atualizar status da venda para 'paid' e incrementar versão
      this.db.prepare(`
        UPDATE sales 
        SET status = 'paid', 
            updated_at = datetime('now'),
            synced = 0,
            version = COALESCE(version, 0) + 1
        WHERE id = ?
      `).run(saleId);
      
      // IMPORTANTE: Atualizar totais do caixa
      const currentCashBox: any = this.getCurrentCashBox();
      if (currentCashBox) {
        this.updateCashBoxTotals(currentCashBox.id, paymentData.amount, normalizedMethod);
        console.log(`[CASH-BOX] Atualizado: +${paymentData.amount/100} FCFA (${normalizedMethod})`);
      } else {
        console.warn('[CASH-BOX] Nenhum caixa aberto - totais não atualizados');
      }
      
      // Adicionar à fila - incluir saleId nos dados
      this.addToSyncQueue('create', 'payment', id, { ...paymentData, saleId }, 1);
      
      return { id, ...paymentData };
    });
  }

  getSales(filters: any = {}) {
    // IMPORTANTE: NUNCA usar CASH como fallback - isso causa bug de VALE aparecer como CASH
    // Prioridade: 1) Payment.method, 2) Sale.payment_method original, 3) NULL (não classificar)
    let query = `
      SELECT 
        s.*,
        COALESCE(
          (SELECT method FROM payments WHERE sale_id = s.id ORDER BY created_at DESC LIMIT 1),
          s.payment_method
        ) as payment_method
      FROM sales s
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (filters.branchId) {
      query += ' AND s.branch_id = ?';
      params.push(filters.branchId);
    }
    
    if (filters.status) {
      query += ' AND s.status = ?';
      params.push(filters.status);
    }
    
    query += ' ORDER BY s.created_at DESC LIMIT 100';
    
    const results = this.db.prepare(query).all(...params);
    
    // 🔴 LOG FASE 11: Electron lendo vendas do banco
    console.log('\\n═══════════════════════════════════════════════════════');
    console.log('🔴 [ELECTRON][getSales] Vendas carregadas do banco local:');
    results.slice(0, 5).forEach((sale: any) => {
      console.log(`   Venda ${sale.sale_number}: payment_method="${sale.payment_method}"`);
    });
    console.log('═══════════════════════════════════════════════════════\\n');
    
    return results;
  }

  getSaleById(id: string) {
    const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return null;
    
    const items = this.db.prepare(`
      SELECT si.*, p.name as product_name 
      FROM sale_items si 
      LEFT JOIN products p ON si.product_id = p.id 
      WHERE si.sale_id = ?
    `).all(id);
    
    const payments = this.db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(id);
    
    return { ...(sale as object), items, payments };
  }

  getProducts(filters: any = {}) {
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params: any[] = [];
    
    if (filters.categoryId) {
      query += ' AND category_id = ?';
      params.push(filters.categoryId);
    }
    
    query += ' ORDER BY name';
    
    return this.db.prepare(query).all(...params);
  }

  searchProducts(query: string) {
    return this.db.prepare(`
      SELECT * FROM products 
      WHERE is_active = 1 
        AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
      ORDER BY name
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  createProduct(productData: any, skipSyncQueue: boolean = false) {
    const id = productData.id || this.generateUUID();
    const stmt = this.db.prepare(`
      INSERT INTO products (
        id, sku, barcode, name, category_id, supplier_id, price_unit, price_box, cost_unit, 
        cost_box, units_per_box, box_enabled, is_muntu_eligible, muntu_quantity, 
        muntu_price, low_stock_alert, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      productData.sku,
      productData.barcode || null,
      productData.name,
      productData.categoryId || null,
      productData.supplierId || null,
      productData.priceUnit || 0,
      productData.priceBox || null,
      productData.costUnit || 0,
      productData.costBox || null,
      productData.unitsPerBox || null,
      productData.priceBox ? 1 : 0,
      productData.isMuntuEligible ? 1 : 0,
      productData.muntuQuantity || null,
      productData.muntuPrice || null,
      productData.lowStockAlert || 10
    );

    // Só adiciona na fila de sync se skipSyncQueue for false
    // 🔴 CORREÇÃO: Incluir o ID nos dados para sincronização
    if (!skipSyncQueue) {
      this.addToSyncQueue('create', 'product', id, { id, ...productData });
    }
    
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

  updateProduct(id: string, productData: any, skipSyncQueue: boolean = false) {
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
    // Suporte para atualização de estoque via sincronização
    if (productData.stock !== undefined) {
      fields.push('stock = ?');
      values.push(productData.stock);
    }
    // Suporte para synced e last_sync
    if (productData.synced !== undefined) {
      fields.push('synced = ?');
      values.push(productData.synced);
    }
    if (productData.last_sync !== undefined) {
      fields.push('last_sync = ?');
      values.push(productData.last_sync);
    }

    fields.push('updated_at = datetime(\'now\')');
    fields.push('version = COALESCE(version, 0) + 1');
    // Só marca como synced = 0 se não foi explicitamente definido
    if (productData.synced === undefined) {
      fields.push('synced = 0');
    }
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    if (!skipSyncQueue) {
      // 🔴 CORREÇÃO: Incluir o ID nos dados para sincronização
      this.addToSyncQueue('update', 'product', id, { id, ...productData });
    }
    return { id, ...productData };
  }

  getProductById(id: string) {
    return this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  }

  deleteProduct(id: string) {
    // Buscar produto antes de deletar para ter os dados completos
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    
    if (!product) {
      console.warn(`⚠️ Produto ${id} não encontrado para exclusão`);
      return { success: false, id, error: 'Produto não encontrado' };
    }
    
    // Soft delete - apenas marca como inativo e incrementa versão
    const stmt = this.db.prepare(`
      UPDATE products 
      SET is_active = 0, synced = 0, updated_at = datetime('now'), version = COALESCE(version, 0) + 1
      WHERE id = ?
    `);
    stmt.run(id);
    
    // Log de auditoria local
    console.log(`🗑️ Produto deletado: ${product.name} (${id})`);
    
    // Adiciona à fila de sincronização com dados completos
    this.addToSyncQueue('delete', 'product', id, {
      id,
      sku: product.sku,
      name: product.name,
      isActive: false,
      _deletedAt: new Date().toISOString(),
    });
    
    return { success: true, id, name: product.name };
  }

  // ============================================
  // Categories
  // ============================================

  getCategories(filters: any = {}) {
    let query = 'SELECT * FROM categories WHERE is_active = 1';
    const params: any[] = [];

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        query += ' AND parent_id IS NULL';
      } else {
        query += ' AND parent_id = ?';
        params.push(filters.parentId);
      }
    }

    query += ' ORDER BY sort_order, name';
    return this.db.prepare(query).all(...params);
  }

  createCategory(categoryData: any, skipSyncQueue: boolean = false) {
    const id = categoryData.id || this.generateUUID();
    const stmt = this.db.prepare(`
      INSERT INTO categories (id, name, description, parent_id, sort_order, is_active, synced, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      categoryData.name,
      categoryData.description || null,
      categoryData.parent_id || categoryData.parentId || null,
      categoryData.sort_order || categoryData.sortOrder || 0,
      categoryData.synced || 0
    );

    // Só adiciona à fila se não vier do servidor
    // 🔴 CORREÇÃO: Incluir o ID nos dados para sincronização
    if (!skipSyncQueue && categoryData.synced !== 1) {
      this.addToSyncQueue('create', 'category', id, { id, ...categoryData });
    }
    return { id, ...categoryData };
  }

  updateCategory(id: string, categoryData: any, skipSyncQueue: boolean = false) {
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
    if (categoryData.synced !== undefined) {
      fields.push('synced = ?');
      values.push(categoryData.synced);
    } else if (!skipSyncQueue) {
      fields.push('synced = 0');
    }

    fields.push('updated_at = datetime(\'now\')');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE categories 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    
    // Só adiciona à fila se não vier do servidor
    // 🔴 CORREÇÃO: Incluir o ID nos dados para sincronização
    if (!skipSyncQueue && categoryData.synced !== 1) {
      this.addToSyncQueue('update', 'category', id, { id, ...categoryData });
    }
    return { id, ...categoryData };
  }

  deleteCategory(id: string) {
    // Verificar se há produtos usando esta categoria
    const productsCount = this.db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id) as { count: number };
    
    if (productsCount.count > 0) {
      throw new Error('Não é possível deletar categoria com produtos associados');
    }

    // Buscar categoria antes de deletar
    const category = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;

    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    
    // 🔴 CORREÇÃO: Incluir dados completos para sincronização
    this.addToSyncQueue('delete', 'category', id, {
      id,
      name: category?.name,
      isActive: false,
    });
    return { success: true, id, name: category?.name };
  }

  // ============================================
  // Suppliers (Fornecedores)
  // ============================================

  getSuppliers() {
    return this.db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name').all();
  }

  createSupplier(supplierData: any, skipSyncQueue: boolean = false) {
    const id = supplierData.id || this.generateUUID();
    const stmt = this.db.prepare(`
      INSERT INTO suppliers (
        id, code, name, contact_person, phone, email, address, 
        tax_id, payment_terms, notes, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
    
    stmt.run(
      id,
      supplierData.code,
      supplierData.name,
      supplierData.contactPerson || null,
      supplierData.phone || null,
      supplierData.email || null,
      supplierData.address || null,
      supplierData.taxId || null,
      supplierData.paymentTerms || null,
      supplierData.notes || null
    );
    
    // 🔴 CORREÇÃO: Incluir o ID nos dados para sincronização
    if (!skipSyncQueue) {
      this.addToSyncQueue('create', 'supplier', id, { id, ...supplierData });
    }
    return { id, ...supplierData };
  }

  updateSupplier(id: string, supplierData: any, skipSyncQueue: boolean = false) {
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
    
    // 🔴 CORREÇÃO: Incluir o ID nos dados para sincronização
    if (!skipSyncQueue) {
      this.addToSyncQueue('update', 'supplier', id, { id, ...supplierData });
    }
    return this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  }

  deleteSupplier(id: string) {
    // Buscar fornecedor antes de deletar
    const supplier = this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
    
    // Soft delete
    this.db.prepare('UPDATE suppliers SET is_active = 0, synced = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
    
    // 🔴 CORREÇÃO: Incluir dados completos para sincronização
    this.addToSyncQueue('delete', 'supplier', id, {
      id,
      code: supplier?.code,
      name: supplier?.name,
      isActive: false,
    });
    return { success: true, id, name: supplier?.name };
  }

  // ============================================
  // Purchases (Compras)
  // ============================================

  getPurchases(filters: any = {}) {
    let query = `
      SELECT p.*, s.name as supplier_name 
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

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

  getPurchaseById(id: string) {
    const purchase: any = this.db.prepare(`
      SELECT p.*
      FROM purchases p
      WHERE p.id = ?
    `).get(id);
    
    if (!purchase) return null;

    // Buscar informações do fornecedor
    const supplier: any = this.db.prepare(`
      SELECT id, name, code, phone, email
      FROM suppliers
      WHERE id = ?
    `).get(purchase.supplier_id);

    // Buscar itens da compra (incluindo units_per_box para calcular quantidade de caixas)
    const items = this.db.prepare(`
      SELECT pi.*, p.name as product_name, p.sku as product_sku, p.units_per_box
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

  createPurchase(purchaseData: any) {
    const id = this.generateUUID();
    const purchaseNumber = this.generatePurchaseNumber();
    
    const stmt = this.db.prepare(`
      INSERT INTO purchases (
        id, purchase_number, branch_id, supplier_id, status, 
        payment_method, payment_status, notes, received_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      purchaseNumber,
      purchaseData.branchId,
      purchaseData.supplierId || null,
      purchaseData.status || 'pending',
      purchaseData.paymentMethod || null,
      purchaseData.paymentStatus || 'pending',
      purchaseData.notes || null,
      purchaseData.receivedBy || null
    );

    // Incluir purchaseNumber nos dados do sync
    this.addToSyncQueue('create', 'purchase', id, { ...purchaseData, purchaseNumber });
    return { id, purchaseNumber };
  }

  addPurchaseItem(purchaseId: string, itemData: any) {
    const id = this.generateUUID();
    const stmt = this.db.prepare(`
      INSERT INTO purchase_items (
        id, purchase_id, product_id, qty_units, unit_cost, 
        subtotal, tax_amount, total, batch_number, expiry_date, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      purchaseId,
      itemData.productId,
      itemData.qtyUnits,
      itemData.unitCost,
      itemData.subtotal,
      itemData.taxAmount || 0,
      itemData.total,
      itemData.batchNumber || null,
      itemData.expiryDate || null
    );

    // Atualizar totais da compra
    this.updatePurchaseTotals(purchaseId);

    // Adicionar à fila de sincronização - incluir purchaseId nos dados!
    this.addToSyncQueue('create', 'purchase_item', id, { ...itemData, purchaseId }, 1);

    return { id, ...itemData };
  }

  completePurchase(purchaseId: string, receivedBy: string) {
    // Obter itens da compra ANTES da transação para evitar problemas
    const items = this.db.prepare(`
      SELECT product_id, qty_units, batch_number, expiry_date
      FROM purchase_items
      WHERE purchase_id = ?
    `).all(purchaseId);

    // Obter branch_id da compra
    const purchase: any = this.db.prepare('SELECT branch_id FROM purchases WHERE id = ?').get(purchaseId);

    if (!purchase) {
      throw new Error('Compra não encontrada');
    }

    // 🔴 CORREÇÃO CRÍTICA: Envolver em transação atômica
    // Garante que status da compra e estoque são atualizados juntos
    return this.runInTransaction(() => {
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

      // Atualizar estoque para cada item
      items.forEach((item: any) => {
        this.addInventory(item.product_id, purchase.branch_id, item.qty_units, item.batch_number, item.expiry_date);
      });

      this.addToSyncQueue('update', 'purchase', purchaseId, { status: 'completed', receivedBy });
      return { success: true };
    });
  }

  private updatePurchaseTotals(purchaseId: string) {
    const totals: any = this.db.prepare(`
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
    `).run(
      totals.subtotal || 0,
      totals.tax_total || 0,
      totals.total || 0,
      purchaseId
    );
  }

  private generatePurchaseNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const count: any = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE DATE(created_at) = DATE('now')
    `).get();
    
    const sequence = (count.count + 1).toString().padStart(4, '0');
    return `CP${year}${month}${day}-${sequence}`;
  }

  getInventory(filters: any = {}) {
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
    const params: any[] = [];
    
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

  updateInventory(productId: string, branchId: string, quantity: number, reason: string) {
    // Buscar produto para pegar units_per_box
    const product: any = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
    const unitsPerBox = product?.units_per_box || 1;
    
    // Verificar se já existe registro de estoque
    const existing: any = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);

    if (existing) {
      // Calcular novo total de unidades
      const newQtyUnits = existing.qty_units + quantity;
      const newClosedBoxes = Math.floor(newQtyUnits / unitsPerBox);
      const newOpenBoxUnits = newQtyUnits % unitsPerBox;
      
      // Atualizar existente e incrementar versão
      this.db.prepare(`
        UPDATE inventory_items 
        SET qty_units = ?, 
            closed_boxes = ?,
            open_box_units = ?,
            updated_at = datetime('now'),
            synced = 0,
            version = COALESCE(version, 0) + 1
        WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
      `).run(newQtyUnits, newClosedBoxes, newOpenBoxUnits, productId, branchId);
    } else {
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
    
    this.addToSyncQueue('update', 'inventory', productId, { 
      quantity,  // quantidade adicionada/ajustada
      adjustment: quantity,  // delta para sync correto
      reason, 
      branchId 
    }, 2);
  }

  private addInventory(productId: string, branchId: string, qtyUnits: number, batchNumber?: string, expiryDate?: string) {
    // Buscar produto para pegar units_per_box
    const product: any = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
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

        const newQtyUnits = (existing as any).qty_units + qtyUnits;
        const newClosedBoxes = (existing as any).closed_boxes + closedBoxes;
        const newOpenBoxUnits = (existing as any).open_box_units + openBoxUnits;

        this.db.prepare(`
          UPDATE inventory_items 
          SET qty_units = ?,
              closed_boxes = ?,
              open_box_units = ?,
              expiry_date = COALESCE(?, expiry_date),
              updated_at = datetime('now'),
              synced = 0
          WHERE id = ?
        `).run(newQtyUnits, newClosedBoxes, newOpenBoxUnits, expiryDate, (existing as any).id);

        // Sincronizar estoque com lote - usar adjustment para multi-PC
        this.addToSyncQueue('update', 'inventory', productId, {
          productId,
          branchId,
          qtyUnits: newQtyUnits,
          closedBoxes: newClosedBoxes,
          openBoxUnits: newOpenBoxUnits,
          adjustment: qtyUnits,  // delta positivo para entrada
          reason: `Compra recebida - Lote ${batchNumber}`,
        }, 2);
      } else {
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

        // Sincronizar novo registro de estoque com lote
        this.addToSyncQueue('create', 'inventory', productId, {
          productId,
          branchId,
          qtyUnits,
          qtyBoxes: closedBoxes,
          adjustment: qtyUnits,  // delta positivo para entrada inicial
          reason: `Compra inicial - Lote ${batchNumber}`,
        }, 2);
      }
    } else {
      // Adicionar ao estoque geral (sem lote) usando sistema de caixas
      const existing = this.db.prepare(`
        SELECT id, qty_units, closed_boxes, open_box_units 
        FROM inventory_items 
        WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
      `).get(productId, branchId);

      const closedBoxes = Math.floor(qtyUnits / unitsPerBox);
      const openBoxUnits = qtyUnits % unitsPerBox;

      if (existing) {
        const qtyBefore = (existing as any).qty_units;
        const closedBoxesBefore = (existing as any).closed_boxes;
        const openBoxBefore = (existing as any).open_box_units;

        this.db.prepare(`
          UPDATE inventory_items 
          SET qty_units = qty_units + ?,
              closed_boxes = closed_boxes + ?,
              open_box_units = open_box_units + ?,
              updated_at = datetime('now'),
              synced = 0
          WHERE id = ?
        `).run(qtyUnits, closedBoxes, openBoxUnits, (existing as any).id);

        const newQtyAfter = qtyBefore + qtyUnits;
        const newClosedBoxesAfter = closedBoxesBefore + closedBoxes;
        const newOpenBoxAfter = openBoxBefore + openBoxUnits;

        // Registrar movimento
        this.registerStockMovement({
          productId,
          branchId,
          movementType: 'purchase',
          quantity: qtyUnits,
          quantityBefore: qtyBefore,
          quantityAfter: newQtyAfter,
          closedBoxesBefore,
          closedBoxesAfter: newClosedBoxesAfter,
          openBoxBefore,
          openBoxAfter: newOpenBoxAfter,
          boxOpenedAutomatically: false,
          reason: 'Compra recebida',
          responsible: 'system',
        });

        // Sincronizar estoque com o servidor - usar valores absolutos
        this.addToSyncQueue('update', 'inventory', productId, {
          productId,
          branchId,
          qtyUnits: newQtyAfter,
          closedBoxes: newClosedBoxesAfter,
          openBoxUnits: newOpenBoxAfter,
          reason: 'Compra recebida',
        }, 2);
      } else {
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

        // Sincronizar estoque com o servidor (criar entrada)
        this.addToSyncQueue('create', 'inventory', productId, {
          productId,
          branchId,
          qtyUnits,
          qtyBoxes: closedBoxes,
          reason: 'Compra inicial',
        }, 2);
      }
    }
  }

  // ============================================
  // MÉTODOS PARA SINCRONIZAÇÃO DE INVENTÁRIO
  // ============================================

  /**
   * Buscar item de inventário por ID do produto
   * Usado principalmente pela sincronização para atualizar estoque
   */
  getInventoryItemByProductId(productId: string, branchId?: string): any {
    if (branchId) {
      return this.db.prepare(`
        SELECT * FROM inventory_items 
        WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
      `).get(productId, branchId);
    }
    // Se não especificar branch, retorna o primeiro encontrado
    return this.db.prepare(`
      SELECT * FROM inventory_items 
      WHERE product_id = ? AND batch_number IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `).get(productId);
  }

  /**
   * Atualizar item de inventário diretamente
   * Usado pela sincronização para atualizar estoque do servidor
   */
  updateInventoryItemByProductId(
    productId: string, 
    data: { qtyUnits: number; closedBoxes?: number; openBoxUnits?: number },
    skipSyncQueue: boolean = false
  ): boolean {
    const existing = this.getInventoryItemByProductId(productId);
    
    if (!existing) {
      console.log(`⚠️ Inventory item não encontrado para produto: ${productId}`);
      return false;
    }

    // Buscar produto para pegar units_per_box
    const product: any = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
    const unitsPerBox = product?.units_per_box || 1;
    
    // Calcular closed_boxes e open_box_units se não fornecidos
    const closedBoxes = data.closedBoxes ?? Math.floor(data.qtyUnits / unitsPerBox);
    const openBoxUnits = data.openBoxUnits ?? (data.qtyUnits % unitsPerBox);

    this.db.prepare(`
      UPDATE inventory_items 
      SET qty_units = ?,
          closed_boxes = ?,
          open_box_units = ?,
          updated_at = datetime('now'),
          synced = 1,
          last_sync = datetime('now')
      WHERE id = ?
    `).run(data.qtyUnits, closedBoxes, openBoxUnits, existing.id);

    console.log(`✅ Inventory item atualizado: productId=${productId}, qty=${data.qtyUnits}`);
    return true;
  }

  /**
   * Criar item de inventário para sincronização
   * Usado quando o servidor tem um item que não existe localmente
   */
  createInventoryItemFromSync(
    productId: string,
    branchId: string,
    data: { qtyUnits: number; closedBoxes?: number; openBoxUnits?: number }
  ): string {
    // Buscar produto para pegar units_per_box
    const product: any = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
    const unitsPerBox = product?.units_per_box || 1;
    
    const closedBoxes = data.closedBoxes ?? Math.floor(data.qtyUnits / unitsPerBox);
    const openBoxUnits = data.openBoxUnits ?? (data.qtyUnits % unitsPerBox);

    const id = this.generateUUID();
    this.db.prepare(`
      INSERT INTO inventory_items (
        id, product_id, branch_id, qty_units, closed_boxes, open_box_units,
        synced, last_sync, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
    `).run(id, productId, branchId, data.qtyUnits, closedBoxes, openBoxUnits);

    console.log(`✅ Inventory item criado: productId=${productId}, qty=${data.qtyUnits}`);
    return id;
  }

  // ============================================
  // SISTEMA AVANÇADO DE ESTOQUE
  // ============================================

  /**
   * Abre uma caixa automaticamente quando necessário
   * Reduz closed_boxes em 1 e adiciona units_per_box em open_box_units
   */
  private openBoxAutomatically(productId: string, branchId: string, reason: string, responsible?: string, saleId?: string) {
    // Buscar produto e estoque
    const product: any = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);
    const inventory: any = this.db.prepare(`
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
  private deductInventoryAdvanced(
    productId: string, 
    branchId: string, 
    qtyUnits: number, 
    isMuntu: boolean = false,
    saleId?: string,
    responsible?: string
  ) {
    const product: any = this.db.prepare('SELECT units_per_box, dose_enabled, doses_per_bottle FROM products WHERE id = ?').get(productId);
    const inventory: any = this.db.prepare(`
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
      const openResult = this.openBoxAutomatically(
        productId, 
        branchId, 
        isMuntu ? 'Venda Muntu' : 'Venda unitária',
        responsible,
        saleId
      );
      
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
    const inventoryAfter: any = this.db.prepare(`
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

    // 🔴 CORREÇÃO CRÍTICA: NÃO sincronizar como 'inventory' (valor absoluto)!
    // O registerStockMovement() acima já adiciona à fila como 'stock_movement'
    // que usa delta operation (adjustment) - isso é correto para multi-PC.
    // Enviar também como 'inventory' causava DUPLICAÇÃO porque:
    // 1. stock_movement subtrai -N do servidor
    // 2. inventory sobrescreve com valor absoluto local (que pode estar desatualizado)
    // 
    // REMOVIDO:
    // this.addToSyncQueue('update', 'inventory', inventory.id, {
    //   productId, branchId, qtyUnits: inventoryAfter.qty_units,
    //   adjustment: -unitsToDeduct, reason, saleId
    // }, 2);

    return {
      success: true,
      deducted: unitsToDeduct,
      boxesOpened,
      remainingStock: inventoryAfter.qty_units,
    };
  }

  /**
   * Registrar movimento de estoque (auditoria)
   * 🔴 CORREÇÃO F4: Agora sincroniza movimento como delta operation
   */
  private registerStockMovement(data: {
    productId: string;
    branchId: string;
    movementType: string;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    closedBoxesBefore: number;
    closedBoxesAfter: number;
    openBoxBefore: number;
    openBoxAfter: number;
    boxOpenedAutomatically: boolean;
    reason: string;
    responsible?: string;
    terminal?: string;
    saleId?: string;
    purchaseId?: string;
    notes?: string;
  }) {
    const id = this.generateUUID();
    
    this.db.prepare(`
      INSERT INTO stock_movements (
        id, product_id, branch_id, movement_type, quantity,
        quantity_before, quantity_after, closed_boxes_before, closed_boxes_after,
        open_box_before, open_box_after, box_opened_automatically,
        reason, responsible, terminal, sale_id, purchase_id, notes,
        synced, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(
      id, data.productId, data.branchId, data.movementType, data.quantity,
      data.quantityBefore, data.quantityAfter, data.closedBoxesBefore, data.closedBoxesAfter,
      data.openBoxBefore, data.openBoxAfter, data.boxOpenedAutomatically ? 1 : 0,
      data.reason, data.responsible || 'system', data.terminal || 'desktop',
      data.saleId || null, data.purchaseId || null, data.notes || null
    );
    
    // 🔴 CORREÇÃO F4: Sincronizar movimento como delta operation
    // O servidor aplicará o adjustment ao estoque ao invés de receber valor absoluto
    this.addToSyncQueue('create', 'stock_movement', id, {
      id,
      productId: data.productId,
      branchId: data.branchId,
      movementType: data.movementType,
      adjustment: data.quantity, // Delta: positivo = entrada, negativo = saída
      reason: data.reason,
      saleId: data.saleId,
      purchaseId: data.purchaseId,
      responsible: data.responsible || 'system',
      terminal: data.terminal || 'desktop',
    }, 1); // Prioridade 1 = Alta (crítico para consistência de estoque)
  }
  
  /**
   * Marca um movimento de estoque como sincronizado
   */
  markStockMovementSynced(movementId: string) {
    try {
      this.db.prepare(`
        UPDATE stock_movements 
        SET synced = 1
        WHERE id = ?
      `).run(movementId);
    } catch (error) {
      console.warn(`⚠️ Erro ao marcar movimento ${movementId} como sincronizado:`, error);
    }
  }

  /**
   * Registrar perda de produto
   */
  registerLoss(productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) {
    const inventory: any = this.db.prepare(`
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

    // 🔴 CORREÇÃO: registerStockMovement() já sincroniza via stock_movement (delta)
    // NÃO adicionar também como 'inventory' (valor absoluto) - causa duplicação
    // REMOVIDO: addToSyncQueue('update', 'inventory', ...)

    return { success: true, quantityLost: quantity };
  }

  /**
   * Registrar quebra de produto
   */
  registerBreakage(productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) {
    const inventory: any = this.db.prepare(`
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

    // 🔴 CORREÇÃO: registerStockMovement() já sincroniza via stock_movement (delta)
    // NÃO adicionar também como 'inventory' (valor absoluto) - causa duplicação
    // REMOVIDO: addToSyncQueue('update', 'inventory', ...)

    return { success: true, quantityBroken: quantity };
  }

  /**
   * Ajuste manual de estoque com log obrigatório
   */
  manualAdjustment(productId: string, branchId: string, quantity: number, reason: string, responsible: string, notes?: string) {
    const inventory: any = this.db.prepare(`
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

    // 🔴 CORREÇÃO: registerStockMovement() já sincroniza via stock_movement (delta)
    // NÃO adicionar também como 'inventory' (valor absoluto) - causa duplicação
    // REMOVIDO: addToSyncQueue('update', 'inventory', ...)

    return { success: true, adjusted: quantity };
  }

  /**
   * Calcular consumo médio e previsões
   */
  calculateConsumptionAndForecast(productId: string, branchId: string) {
    const now = new Date();
    const date7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const date15d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calcular consumo por período
    const consumption7d: any = this.db.prepare(`
      SELECT SUM(ABS(quantity)) as total 
      FROM stock_movements 
      WHERE product_id = ? AND branch_id = ? 
        AND movement_type IN ('sale', 'sale_muntu')
        AND created_at >= ?
    `).get(productId, branchId, date7d.toISOString());

    const consumption15d: any = this.db.prepare(`
      SELECT SUM(ABS(quantity)) as total 
      FROM stock_movements 
      WHERE product_id = ? AND branch_id = ? 
        AND movement_type IN ('sale', 'sale_muntu')
        AND created_at >= ?
    `).get(productId, branchId, date15d.toISOString());

    const consumption30d: any = this.db.prepare(`
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
    const inventory: any = this.db.prepare(`
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
  getStockMovements(filters: any = {}) {
    let query = `
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku as product_sku
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

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
  validateInventoryConsistency(productId: string, branchId: string) {
    const inventory: any = this.db.prepare(`
      SELECT id, qty_units, closed_boxes, open_box_units 
      FROM inventory_items 
      WHERE product_id = ? AND branch_id = ? AND batch_number IS NULL
    `).get(productId, branchId);

    const product: any = this.db.prepare('SELECT units_per_box FROM products WHERE id = ?').get(productId);

    if (!inventory || !product) {
      return { valid: false, errors: ['Produto ou estoque não encontrado'] };
    }

    const errors: string[] = [];
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

  private deductInventory(productId: string, branchId: string, qtyUnits: number) {
    // MÉTODO LEGADO - Usar deductInventoryAdvanced() para nova lógica
    // Mantido para compatibilidade com código antigo
    
    console.log(`[deductInventory] Deduzindo ${qtyUnits} unidades do produto ${productId} na filial ${branchId}`);
    
    // Deduzir primeiro dos lotes mais antigos (FIFO)
    const batches: any[] = this.db.prepare(`
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
      if (remaining <= 0) break;

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
    const afterDeduct = this.db.prepare(`SELECT qty_units FROM inventory_items WHERE product_id = ? AND branch_id = ?`).get(productId, branchId) as any;
    console.log(`[deductInventory] Estoque APÓS dedução:`, afterDeduct?.qty_units);

    if (remaining > 0) {
      console.warn(`Estoque insuficiente para produto ${productId}. Faltam ${remaining} unidades.`);
    }
  }

  private updateSaleTotals(saleId: string) {
    this.db.exec(`
      UPDATE sales 
      SET subtotal = (SELECT SUM(subtotal) FROM sale_items WHERE sale_id = '${saleId}'),
          tax_total = (SELECT SUM(tax_amount) FROM sale_items WHERE sale_id = '${saleId}'),
          total = (SELECT SUM(total) FROM sale_items WHERE sale_id = '${saleId}'),
          muntu_savings = (SELECT SUM(muntu_savings) FROM sale_items WHERE sale_id = '${saleId}'),
          updated_at = CURRENT_TIMESTAMP,
          synced = 0,
          version = COALESCE(version, 0) + 1
      WHERE id = '${saleId}'
    `);
  }

  // ============================================
  // Customers
  // ============================================

  getCustomers(filters: any = {}) {
    let query = 'SELECT id, code, full_name as name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points FROM customers';
    const params: any[] = [];
    
    if (filters.search) {
      query += ' WHERE (full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    
    query += ' ORDER BY full_name';
    
    return this.db.prepare(query).all(...params);
  }

  getCustomerById(id: string) {
    return this.db.prepare(`
      SELECT id, code, full_name as name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points, synced 
      FROM customers WHERE id = ?
    `).get(id);
  }

  createCustomer(data: any, skipSyncQueue: boolean = false) {
    const id = data.id || this.generateUUID();
    
    // Gerar código único se não fornecido
    const code = data.code || `CUST-${Date.now().toString().slice(-6)}`;
    
    // Obter valores de loyalty_points e current_debt
    const loyaltyPoints = data.loyalty_points ?? data.loyaltyPoints ?? 0;
    const currentDebt = data.current_debt ?? data.currentDebt ?? 0;
    const creditLimit = data.creditLimit ?? data.credit_limit ?? 0;
    
    const stmt = this.db.prepare(`
      INSERT INTO customers (id, code, full_name, phone, email, credit_limit, current_debt, is_blocked, loyalty_points)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);
    
    stmt.run(id, code, data.name, data.phone, data.email, creditLimit, currentDebt, loyaltyPoints);
    
    if (!skipSyncQueue) {
      // Prioridade 0 = mais alta (antes de vendas que são prioridade 1)
      // IMPORTANTE: Incluir o id nos dados para o backend usar o mesmo UUID
      const syncData = {
        ...data,
        id, // Garantir que o ID seja enviado para o backend
        code,
      };
      this.addToSyncQueue('create', 'customer', id, syncData, 0);
    }
    
    return this.getCustomerById(id);
  }

  updateCustomer(id: string, data: any, skipSyncQueue: boolean = false) {
    // Aceitar tanto creditLimit quanto credit_limit
    const creditLimit = data.creditLimit ?? data.credit_limit;
    const loyaltyPoints = data.loyalty_points ?? data.loyaltyPoints;
    const currentDebt = data.current_debt ?? data.currentDebt;
    
    // Construir query dinamicamente para atualizar apenas campos fornecidos
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('full_name = ?');
      params.push(data.name);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      params.push(data.phone);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      params.push(data.email);
    }
    if (creditLimit !== undefined) {
      updates.push('credit_limit = ?');
      params.push(creditLimit);
    }
    if (loyaltyPoints !== undefined) {
      updates.push('loyalty_points = ?');
      params.push(loyaltyPoints);
    }
    if (currentDebt !== undefined) {
      updates.push('current_debt = ?');
      params.push(currentDebt);
    }
    if (data.code !== undefined) {
      updates.push('code = ?');
      params.push(data.code);
    }
    if (data.is_active !== undefined) {
      updates.push('is_blocked = ?');
      params.push(data.is_active ? 0 : 1);
    }
    
    // Se skipSyncQueue é true, significa que veio do servidor, então marcar como synced = 1
    const synced = skipSyncQueue ? 1 : 0;
    updates.push('synced = ?');
    params.push(synced);
    updates.push('updated_at = datetime(\'now\')');
    updates.push('version = COALESCE(version, 0) + 1');
    
    if (updates.length === 0) {
      return this.getCustomerById(id);
    }
    
    params.push(id);
    const stmt = this.db.prepare(`
      UPDATE customers 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...params);
    
    if (!skipSyncQueue) {
      // Prioridade 0 = mais alta (antes de vendas)
      this.addToSyncQueue('update', 'customer', id, data, 0);
    }
    
    return this.getCustomerById(id);
  }

  deleteCustomer(id: string) {
    // Soft delete - apenas marca como inativo e incrementa versão
    const stmt = this.db.prepare(`
      UPDATE customers 
      SET is_blocked = 1, updated_at = datetime('now'), synced = 0, version = COALESCE(version, 0) + 1
      WHERE id = ?
    `);
    
    stmt.run(id);
    
    // Prioridade 0 = mais alta (antes de vendas)
    this.addToSyncQueue('delete', 'customer', id, {}, 0);
    
    return { success: true };
  }

  getCustomerPurchaseHistory(customerId: string, filters: any = {}) {
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
    
    const params: any[] = [customerId];
    
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

  getCustomerStats(customerId: string) {
    // Total de compras
    const totalPurchases = this.db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_spent,
        COALESCE(AVG(total), 0) as avg_order_value
      FROM sales
      WHERE customer_id = ?
    `).get(customerId) as any;

    // Última compra
    const lastPurchase = this.db.prepare(`
      SELECT created_at as last_purchase_date
      FROM sales
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(customerId) as any;

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
  addLoyaltyPoints(customerId: string, saleAmount: number, saleId: string) {
    // Calcular pontos: 1 ponto para cada 1.000 FCFA (100000 centavos)
    const pointsToAdd = Math.floor(saleAmount / 100000);
    
    if (pointsToAdd <= 0) {
      return { pointsAdded: 0, totalPoints: 0 };
    }

    // Buscar cliente atual
    const customer = this.db.prepare(`
      SELECT id, full_name, loyalty_points FROM customers WHERE id = ?
    `).get(customerId) as any;

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
  getCustomerLoyalty(customerId: string) {
    const customer = this.db.prepare(`
      SELECT id, code, full_name, loyalty_points FROM customers WHERE id = ?
    `).get(customerId) as any;

    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // Calcular tier baseado nos pontos
    let tier = 'Bronze';
    let tierColor = '#cd7f32';
    if (customer.loyalty_points >= 1000) {
      tier = 'Gold';
      tierColor = '#ffd700';
    } else if (customer.loyalty_points >= 500) {
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
  createUser(data: {
    username: string;
    email: string;
    fullName: string;
    passwordHash: string;
    password?: string; // Senha original para sync com backend
    role: string;
    branchId?: string;
    phone?: string;
    allowedTabs?: string[];
  }) {
    const id = this.generateUUID();
    
    // Converter array de abas para JSON string
    const allowedTabsJson = data.allowedTabs ? JSON.stringify(data.allowedTabs) : null;
    
    this.db.prepare(`
      INSERT INTO users (
        id, username, email, full_name, password_hash, role, branch_id, phone, allowed_tabs,
        synced, sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING')
    `).run(
      id,
      data.username,
      data.email,
      data.fullName,
      data.passwordHash,
      data.role,
      data.branchId || null,
      data.phone || null,
      allowedTabsJson
    );

    // Dados para sync - incluir password original (não o hash) para o backend
    // O backend faz seu próprio hash da senha
    // IMPORTANTE: Se a senha não estiver disponível, a sincronização falhará
    const syncData = {
      id,
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      branchId: data.branchId || null,
      phone: data.phone,
      allowedTabs: data.allowedTabs,
      password: data.password, // Senha original para o backend
      isActive: true,
    };
    
    if (data.password) {
      this.addToSyncQueue('create', 'user', id, syncData, 2);
      console.log(`📤 Usuário ${data.email} adicionado à fila de sincronização com senha`);
    } else {
      // Sem senha - adicionar à fila mas marcar que falta senha
      this.addToSyncQueue('create', 'user', id, syncData, 2);
      console.log(`⚠️ Usuário ${data.email} adicionado à fila SEM senha - sincronização pode falhar`);
    }

    return { id, ...data };
  }

  /**
   * 🔴 CORREÇÃO CRÍTICA: Cria usuário a partir dos dados do servidor
   * Usado para sincronizar usuários criados em outros PCs ou no backend
   * Usuários criados por este método NÃO têm senha local - precisam fazer login online primeiro
   */
  createUserFromServer(data: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    branchId?: string;
    phone?: string;
    allowedTabs?: string[] | string;
  }) {
    // Converter array de abas para JSON string se necessário
    let allowedTabsJson: string | null = null;
    if (data.allowedTabs) {
      if (typeof data.allowedTabs === 'string') {
        allowedTabsJson = data.allowedTabs;
      } else {
        allowedTabsJson = JSON.stringify(data.allowedTabs);
      }
    }
    
    // Placeholder de senha - usuário DEVE fazer login online primeiro
    // Este hash não é válido para bcrypt e será rejeitado em login offline
    const NEEDS_ONLINE_LOGIN_HASH = '$NEEDS_ONLINE_LOGIN$';
    
    try {
      this.db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, branch_id, phone, 
          allowed_tabs, synced, sync_status, is_active, needs_online_auth,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'SYNCED_FROM_SERVER', 1, 1, datetime('now'), datetime('now'))
      `).run(
        data.id,
        data.username,
        data.email,
        data.fullName,
        NEEDS_ONLINE_LOGIN_HASH,
        data.role,
        data.branchId || null,
        data.phone || null,
        allowedTabsJson
      );
      
      console.log(`✅ Usuário criado do servidor: ${data.email} (ID: ${data.id}) - Requer login online`);
      return { ...data, needsOnlineAuth: true };
    } catch (error: any) {
      // Se usuário já existe, atualizar ao invés de falhar
      if (error.message?.includes('UNIQUE constraint failed')) {
        console.log(`⚠️ Usuário ${data.email} já existe, atualizando...`);
        this.updateUserFromServer(data.id, {
          username: data.username,
          email: data.email,
          full_name: data.fullName,
          role: data.role,
          branch_id: data.branchId,
          phone: data.phone,
          allowed_tabs: data.allowedTabs,
          synced: 1,
        });
        return { ...data };
      }
      throw error;
    }
  }

  /**
   * Atualiza senha local do usuário após login online bem-sucedido
   * Isso permite que usuários sincronizados do servidor façam login offline
   */
  updateUserPasswordLocal(userId: string, passwordHash: string) {
    try {
      const result = this.db.prepare(`
        UPDATE users 
        SET password_hash = ?,
            needs_online_auth = 0,
            sync_status = 'PASSWORD_SET_LOCALLY',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(passwordHash, userId);
      
      if (result.changes > 0) {
        console.log(`✅ Senha local atualizada para usuário: ${userId}`);
        return true;
      } else {
        console.warn(`⚠️ Usuário não encontrado para atualização de senha: ${userId}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar senha local:', error);
      throw error;
    }
  }

  /**
   * Lista todos os usuários
   */
  getUsers(filters: {
    branchId?: string;
    role?: string;
    search?: string;
    isActive?: boolean;
  } = {}) {
    let query = `
      SELECT 
        u.*,
        b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

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
  getUserById(id: string) {
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
  getUserByUsername(username: string) {
    return this.db.prepare(`
      SELECT * FROM users WHERE username = ?
    `).get(username);
  }

  /**
   * Busca um usuário por email
   */
  getUserByEmail(email: string) {
    return this.db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email);
  }

  /**
   * Atualiza um usuário
   */
  updateUser(id: string, data: {
    username?: string;
    fullName?: string;
    email?: string;
    role?: string;
    branchId?: string;
    phone?: string;
    isActive?: boolean;
    allowedTabs?: string[];
    password?: string; // Senha original para sincronização
  }) {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.username !== undefined) {
      updates.push('username = ?');
      params.push(data.username);
    }

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

    if (data.allowedTabs !== undefined) {
      updates.push('allowed_tabs = ?');
      params.push(data.allowedTabs ? JSON.stringify(data.allowedTabs) : null);
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
   * @param id - ID do usuário
   * @param newPasswordHash - Hash da nova senha para armazenamento local
   * @param originalPassword - Senha original em texto para sincronização com o backend (opcional)
   */
  resetUserPassword(id: string, newPasswordHash: string, originalPassword?: string) {
    this.db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `).run(newPasswordHash, id);

    // Enviar para sync com a senha original (não o hash)
    this.addToSyncQueue('update', 'user_password', id, { 
      newPassword: originalPassword || null,
      passwordReset: true 
    }, 2);

    console.log(`🔑 Senha do usuário ${id} resetada localmente${originalPassword ? ' e enfileirada para sync' : ''}`);

    return { success: true };
  }

  /**
   * Atualiza o último login do usuário
   */
  updateUserLastLogin(id: string) {
    this.db.prepare(`
      UPDATE users 
      SET last_login = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * Deleta (desativa) um usuário
   */
  deleteUser(id: string) {
    this.db.prepare(`
      UPDATE users 
      SET is_active = 0, updated_at = datetime('now'), synced = 0
      WHERE id = ?
    `).run(id);

    this.addToSyncQueue('delete', 'user', id, {}, 2);

    return { success: true };
  }

  // ============================================
  // User Sync Management (Gerenciamento de Sincronização de Usuários)
  // ============================================

  /**
   * Retorna todos os usuários que ainda não foram sincronizados com o servidor
   */
  getUnsyncedUsers(): any[] {
    return this.db.prepare(`
      SELECT * FROM users 
      WHERE synced = 0 OR sync_status = 'PENDING' OR sync_status = 'ERROR' OR sync_status IS NULL
      ORDER BY created_at ASC
    `).all();
  }

  /**
   * Retorna estatísticas de sincronização de usuários
   */
  getUserSyncStats(): { total: number; synced: number; pending: number; error: number } {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sync_status = 'SYNCED' OR synced = 1 THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN sync_status = 'PENDING' OR (synced = 0 AND sync_status IS NULL) THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN sync_status = 'ERROR' THEN 1 ELSE 0 END) as error
      FROM users
    `).get() as any;
    
    return {
      total: stats.total || 0,
      synced: stats.synced || 0,
      pending: stats.pending || 0,
      error: stats.error || 0
    };
  }

  /**
   * Marca usuário como sincronizado com sucesso
   */
  markUserSynced(id: string, serverId?: string) {
    this.db.prepare(`
      UPDATE users 
      SET synced = 1, 
          sync_status = 'SYNCED', 
          server_id = ?,
          last_sync = datetime('now'),
          sync_error = NULL
      WHERE id = ?
    `).run(serverId || id, id);
  }

  /**
   * Marca usuário com erro de sincronização
   */
  markUserSyncError(id: string, errorMessage: string) {
    this.db.prepare(`
      UPDATE users 
      SET sync_status = 'ERROR', 
          last_sync_attempt = datetime('now'),
          sync_error = ?
      WHERE id = ?
    `).run(errorMessage, id);
  }

  /**
   * Adiciona usuário pendente à fila de sincronização
   * Usado para re-sincronizar usuários que falharam
   */
  queueUserForSync(userId: string, password?: string) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Preparar dados para sync
    const syncData = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      branchId: user.branch_id,
      phone: user.phone,
      allowedTabs: user.allowed_tabs ? JSON.parse(user.allowed_tabs) : null,
      isActive: user.is_active === 1,
      password: password, // Senha se disponível
    };

    // Verificar se já está na fila
    const existingInQueue = this.db.prepare(`
      SELECT id FROM sync_queue 
      WHERE entity = 'user' AND entity_id = ? AND status = 'pending'
    `).get(userId);

    if (!existingInQueue) {
      this.addToSyncQueue('create', 'user', userId, syncData, 2);
      console.log(`📤 Usuário ${user.email} adicionado à fila de sincronização`);
    } else {
      console.log(`⏳ Usuário ${user.email} já está na fila de sincronização`);
    }

    return { queued: true, userId };
  }

  /**
   * Sincroniza todos os usuários pendentes para a fila
   * NOTA: Sem senha disponível, os usuários não poderão ser criados no backend
   * Este método é útil para reprocessar usuários que falharam
   */
  queueAllPendingUsersForSync(): { queued: number; skipped: number; users: string[] } {
    const unsyncedUsers = this.getUnsyncedUsers();
    let queued = 0;
    let skipped = 0;
    const queuedUsers: string[] = [];

    for (const user of unsyncedUsers) {
      // Verificar se já está na fila
      const existingInQueue = this.db.prepare(`
        SELECT id FROM sync_queue 
        WHERE entity = 'user' AND entity_id = ? AND status = 'pending'
      `).get(user.id);

      if (existingInQueue) {
        skipped++;
        continue;
      }

      // Preparar dados (sem senha - será marcado como erro se necessário)
      const syncData = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        branchId: user.branch_id,
        phone: user.phone,
        allowedTabs: user.allowed_tabs ? JSON.parse(user.allowed_tabs) : null,
        isActive: user.is_active === 1,
        // password não disponível - backend vai rejeitar criação
      };

      this.addToSyncQueue('create', 'user', user.id, syncData, 2);
      queuedUsers.push(user.email);
      queued++;
    }

    console.log(`📊 Usuários: ${queued} adicionados à fila, ${skipped} já na fila`);
    return { queued, skipped, users: queuedUsers };
  }

  // ============================================
  // Debts (Dívidas/Vales)
  // ============================================

  /**
   * Cria uma nova dívida para um cliente
   */
  createDebt(data: {
    customerId: string;
    saleId?: string;
    branchId: string;
    amount: number;
    dueDate?: string;
    notes?: string;
    createdBy: string;
  }) {
    const id = this.generateUUID();
    const debtNumber = `DEBT-${Date.now().toString().slice(-8)}`;

    // Verificar limite de crédito do cliente
    const customer = this.db.prepare(`
      SELECT credit_limit, current_debt FROM customers WHERE id = ?
    `).get(data.customerId) as any;

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
    `).run(
      id, debtNumber, data.customerId, data.saleId || null, data.branchId,
      data.amount, data.amount, data.dueDate || null, data.notes || null, data.createdBy
    );

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
  getDebts(filters: {
    customerId?: string;
    status?: string;
    branchId?: string;
    search?: string;
  } = {}) {
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
    const params: any[] = [];

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
  getDebtById(id: string) {
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

    if (!debt) return null;

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
  getTablePendingDebts(tableNumber: string): Map<string, number> {
    const debts = this.db.prepare(`
      SELECT 
        d.customer_id,
        d.balance
      FROM debts d
      WHERE d.status = 'pending'
        AND d.balance > 0
        AND d.notes LIKE ?
    `).all(`%Mesa ${tableNumber}%`) as Array<{ customer_id: string; balance: number }>;

    const debtMap = new Map<string, number>();
    
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
  getCustomersPendingDebts(customerIds: string[]): Array<{
    customer_id: string;
    debt_id: string;
    balance: number;
    table_number: string | null;
    notes: string;
    created_at: string;
  }> {
    if (customerIds.length === 0) return [];
    
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
    `).all(...customerIds) as Array<{
      debt_id: string;
      customer_id: string;
      balance: number;
      notes: string;
      created_at: string;
    }>;

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
   * 🔴 CORREÇÃO CRÍTICA: Agora usa transação atômica
   */
  payDebt(data: {
    debtId: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
    receivedBy: string;
  }) {
    const debt = this.db.prepare(`
      SELECT * FROM debts WHERE id = ?
    `).get(data.debtId) as any;

    if (!debt) {
      throw new Error('Dívida não encontrada');
    }

    if (debt.balance <= 0) {
      throw new Error('Dívida já está quitada');
    }

    if (data.amount > debt.balance) {
      throw new Error(`Valor maior que o saldo da dívida (${debt.balance / 100} FCFA)`);
    }

    // 🔴 CORREÇÃO CRÍTICA: Envolver em transação atômica
    // Garante que pagamento, atualização de dívida e cliente são atômicos
    return this.runInTransaction(() => {
      const paymentId = this.generateUUID();
      const newBalance = debt.balance - data.amount;
      const newStatus = newBalance === 0 ? 'paid' : 'partial';

      // Registrar pagamento da dívida
      this.db.prepare(`
        INSERT INTO debt_payments (id, debt_id, amount, method, reference, notes, received_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId, data.debtId, data.amount, data.method, 
        data.reference || null, data.notes || null, data.receivedBy
      );

      // Atualizar dívida - incluir synced = 0 para garantir sincronização
      const newPaidAmount = debt.paid_amount + data.amount;
      this.db.prepare(`
        UPDATE debts 
        SET paid_amount = ?,
            balance = ?,
            status = ?,
            synced = 0,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newPaidAmount, newBalance, newStatus, data.debtId);

      // Atualizar dívida atual do cliente - incluir synced = 0
      this.db.prepare(`
        UPDATE customers 
        SET current_debt = current_debt - ?,
            synced = 0,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(data.amount, debt.customer_id);

      // Registrar pagamento geral (para rastreabilidade)
      const generalPaymentId = this.generateUUID();
      this.db.prepare(`
        INSERT INTO payments (id, debt_id, method, amount, status, notes)
        VALUES (?, ?, ?, ?, 'completed', ?)
      `).run(
        generalPaymentId, data.debtId, data.method, data.amount,
        `Pagamento de dívida ${debt.debt_number}`
      );

      // Sincronizar pagamento de dívida para o backend
      this.addToSyncQueue('create', 'debt_payment', paymentId, {
        debtId: data.debtId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      }, 1); // Alta prioridade
      
      // IMPORTANTE: Também sincronizar a atualização da dívida em si
      this.addToSyncQueue('update', 'debt', data.debtId, {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
      }, 20); // Prioridade normal de dívidas
      
      // Sincronizar atualização do current_debt do cliente
      this.addToSyncQueue('update', 'customer', debt.customer_id, {
        currentDebt: debt.current_debt - data.amount,
      }, 10); // Prioridade de clientes

      return {
        paymentId,
        newBalance,
        status: newStatus,
        isPaid: newBalance === 0
      };
    });
  }

  /**
   * Cancela uma dívida (apenas se não tiver pagamentos)
   */
  cancelDebt(debtId: string, reason: string) {
    const debt = this.db.prepare(`
      SELECT * FROM debts WHERE id = ?
    `).get(debtId) as any;

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
  getCustomerDebtStats(customerId: string) {
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
    `).get(customerId) as any;

    return stats;
  }

  // =============================================================================
  // 🔴 CORREÇÃO: Métodos de CashBox para sincronização multi-PC
  // =============================================================================

  openCashBox(data: any) {
    const id = this.generateUUID();
    this.db.prepare(`
      INSERT INTO cash_boxes (id, box_number, branch_id, opened_by, opening_cash)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.boxNumber, data.branchId, data.openedBy, data.openingCash || 0);
    
    // Garantir dados completos para sincronização
    const syncData = {
      ...data,
      id,
      boxNumber: data.boxNumber,
      box_number: data.boxNumber,
      branchId: data.branchId,
      branch_id: data.branchId,
      openingCash: data.openingCash || 0,
      opening_cash: data.openingCash || 0,
    };
    this.addToSyncQueue('create', 'cash_box', id, syncData, 2);
    return { id, ...data };
  }

  /**
   * Cria um caixa localmente a partir dos dados do servidor
   * NÃO adiciona à fila de sync (já existe no servidor)
   * 🔴 CORREÇÃO: Incluir TODOS os campos para evitar NaN/Invalid Date
   */
  createCashBoxFromServer(data: {
    id: string;
    boxNumber: string;
    branchId: string;
    openedBy: string;
    openingCash: number;
    status: string;
    openedAt?: string;
    totalSales?: number;
    totalCash?: number;
    totalCard?: number;
    totalMobileMoney?: number;
    totalDebt?: number;
    closingCash?: number;
    closedAt?: string;
    closedBy?: string;
    notes?: string;
  }) {
    try {
      // Verificar se já existe
      const existing = this.db.prepare('SELECT id FROM cash_boxes WHERE id = ?').get(data.id);
      if (existing) {
        console.log(`📦 CashBox ${data.id} já existe localmente`);
        return this.getCashBoxById(data.id);
      }
      
      // Garantir que opened_at tenha um valor válido
      const openedAt = data.openedAt || new Date().toISOString();
      
      this.db.prepare(`
        INSERT INTO cash_boxes (
          id, box_number, branch_id, opened_by, opening_cash, status, synced,
          opened_at, total_sales, total_cash, total_card, total_mobile_money, total_debt,
          closing_cash, closed_at, closed_by, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.id,
        data.boxNumber,
        data.branchId,
        data.openedBy,
        data.openingCash ?? 0,
        data.status || 'open',
        openedAt,
        data.totalSales ?? 0,
        data.totalCash ?? 0,
        data.totalCard ?? 0,
        data.totalMobileMoney ?? 0,
        data.totalDebt ?? 0,
        data.closingCash ?? null,
        data.closedAt ?? null,
        data.closedBy ?? null,
        data.notes ?? null
      );
      
      console.log(`✅ CashBox criado localmente a partir do servidor: ${data.id}`);
      return this.getCashBoxById(data.id);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        console.log(`⚠️ CashBox ${data.id} já existe, atualizando...`);
        this.updateCashBoxFromServer(data.id, data);
        return this.getCashBoxById(data.id);
      }
      throw error;
    }
  }
  
  /**
   * Atualiza um caixa local com dados do servidor
   * 🔴 CORREÇÃO: Atualizar TODOS os campos para evitar NaN/Invalid Date
   */
  updateCashBoxFromServer(cashBoxId: string, serverData: any) {
    try {
      this.db.prepare(`
        UPDATE cash_boxes 
        SET status = COALESCE(?, status),
            opening_cash = COALESCE(?, opening_cash),
            opened_at = COALESCE(?, opened_at),
            total_sales = COALESCE(?, total_sales),
            total_cash = COALESCE(?, total_cash),
            total_card = COALESCE(?, total_card),
            total_mobile_money = COALESCE(?, total_mobile_money),
            total_debt = COALESCE(?, total_debt),
            closing_cash = COALESCE(?, closing_cash),
            closed_at = COALESCE(?, closed_at),
            closed_by = COALESCE(?, closed_by),
            notes = COALESCE(?, notes),
            synced = 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        serverData.status,
        serverData.openingCash ?? serverData.opening_cash,
        serverData.openedAt || serverData.opened_at,
        serverData.totalSales ?? serverData.total_sales,
        serverData.totalCash ?? serverData.total_cash,
        serverData.totalCard ?? serverData.total_card,
        serverData.totalMobileMoney ?? serverData.total_mobile_money,
        serverData.totalDebt ?? serverData.total_debt,
        serverData.closingCash ?? serverData.closing_cash,
        serverData.closedAt || serverData.closed_at,
        serverData.closedBy || serverData.closed_by,
        serverData.notes,
        cashBoxId
      );
      
      console.log(`✅ CashBox ${cashBoxId} atualizado do servidor`);
    } catch (error) {
      console.error('❌ Erro ao atualizar CashBox do servidor:', error);
      throw error;
    }
  }

  closeCashBox(cashBoxId: string, closingData: any) {
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
    `).run(closingData.closingCash, closingData.difference, 
           closingData.closedBy, closingData.notes, cashBoxId);
    
    // Garantir que closingData tenha status: 'closed' para sincronização
    const syncData = {
      ...closingData,
      status: 'closed',
      closing_cash: closingData.closingCash,
      closingCash: closingData.closingCash,
    };
    this.addToSyncQueue('update', 'cash_box', cashBoxId, syncData, 1);
  }

  getCurrentCashBox() {
    return this.db.prepare(`
      SELECT * FROM cash_boxes 
      WHERE status = 'open' 
      ORDER BY opened_at DESC 
      LIMIT 1
    `).get();
  }

  getCashBoxHistory(filters: any = {}) {
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
    const params: any[] = [];

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

  getCashBoxById(id: string) {
    const cashBox: any = this.db.prepare('SELECT * FROM cash_boxes WHERE id = ?').get(id);
    if (!cashBox) return null;

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
    // CRÍTICO: Incluir AMBOS payments E table_payments!
    if (!cashBox.total_debt || cashBox.total_debt === 0) {
      // Pagamentos normais (Payment via Sales)
      const valeTotal = this.db.prepare(`
        SELECT COALESCE(SUM(s.total), 0) as total_vale
        FROM sales s
        INNER JOIN payments p ON s.id = p.sale_id
        WHERE s.created_at >= ?
          AND (? IS NULL OR s.created_at <= ?)
          AND s.branch_id = ?
          AND (LOWER(p.method) = 'vale' OR LOWER(p.method) = 'debt')
      `).get(cashBox.opened_at, cashBox.closed_at, cashBox.closed_at, cashBox.branch_id) as any;
      
      // CRÍTICO: Pagamentos de mesas (TablePayment) - não passam pela tabela Payment!
      const tableValeTotal = this.db.prepare(`
        SELECT COALESCE(SUM(tp.amount), 0) as total_vale
        FROM table_payments tp
        INNER JOIN table_sessions ts ON tp.session_id = ts.id
        WHERE tp.processed_at >= ?
          AND (? IS NULL OR tp.processed_at <= ?)
          AND ts.branch_id = ?
          AND (LOWER(tp.method) = 'vale' OR LOWER(tp.method) = 'debt')
      `).get(cashBox.opened_at, cashBox.closed_at, cashBox.closed_at, cashBox.branch_id) as any;
      
      cashBox.total_debt = (valeTotal?.total_vale || 0) + (tableValeTotal?.total_vale || 0);
    }

    // Calcular métricas de lucro
    const profitMetrics = this.calculateCashBoxProfitMetrics(id, cashBox);

    return { ...cashBox, sales, profitMetrics };
  }

  calculateCashBoxProfitMetrics(cashBoxId: string, cashBox: any) {
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

    salesItems.forEach((item: any) => {
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
      .filter((item: any) => {
        const minStock = item.qty_sold_in_period * 0.2; // 20% do que foi vendido
        return (item.current_stock || 0) < minStock;
      })
      .map((item: any) => {
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

    const totalRestockCost = restockSuggestions.reduce((sum: number, item: any) => sum + item.restockCost, 0);

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      profitMargin: Math.round(profitMargin * 100) / 100, // 2 casas decimais
      salesItems: salesItems.map((item: any) => ({
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

  updateCashBoxTotals(cashBoxId: string, saleTotal: number, paymentMethod: string) {
    // Incrementar o total de vendas e o método específico
    // Normalizar para uppercase para comparação consistente
    const method = (paymentMethod || '').toUpperCase();
    let paymentField = '';
    
    if (method === 'CASH' || method === 'DINHEIRO') {
      paymentField = 'total_cash';
    } else if (method === 'ORANGE_MONEY' || method === 'ORANGE' || method === 'TELETAKU' || method === 'MOBILE') {
      paymentField = 'total_mobile_money';
    } else if (method === 'MIXED' || method === 'CARD' || method === 'MISTO') {
      paymentField = 'total_card';
    } else if (method === 'VALE' || method === 'DEBT' || method === 'FIADO') {
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
    } else {
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

  private addToSyncQueue(operation: string, entity: string, entityId: string, data: any, priority: number = 5) {
    const id = this.generateUUID();
    const deviceId = this.getDeviceId();
    
    // Adicionar device_id e timestamp aos dados
    const enrichedData = {
      ...data,
      _deviceId: deviceId,
      _timestamp: new Date().toISOString(),
    };
    
    this.db.prepare(`
      INSERT INTO sync_queue (id, operation, entity, entity_id, data, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, operation, entity, entityId, JSON.stringify(enrichedData), priority);
  }

  getPendingSyncItems() {
    return this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending' 
      ORDER BY priority ASC, created_at ASC
      LIMIT 100
    `).all();
  }

  markSyncItemCompleted(id: string) {
    this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'completed', processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
  }

  markSyncItemFailed(id: string | null, error: string | string[]) {
    // Garantir que id não é null (proteção contra chamadas inválidas)
    if (!id) {
      console.warn('⚠️ markSyncItemFailed chamado com id nulo');
      return;
    }
    // Converter array de erros para string
    const errorStr = Array.isArray(error) ? error.join(', ') : String(error);
    this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'failed', retry_count = retry_count + 1, last_error = ? 
      WHERE id = ?
    `).run(errorStr, id);
  }

  /**
   * Marca itens falhados como pendentes para re-tentativa
   * Útil após sincronizar dependências (ex: clientes antes de vendas)
   */
  retryFailedSyncItems(maxRetries: number = 3) {
    // Resetar itens falhados que ainda não atingiram o limite de retentativas
    const result = this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'pending', last_error = NULL 
      WHERE status = 'failed' AND retry_count < ?
    `).run(maxRetries);
    
    console.log(`🔄 ${result.changes} itens marcados para re-tentativa`);
    return result.changes;
  }

  /**
   * Obtém contagem de itens falhados por entidade
   */
  getFailedSyncStats() {
    return this.db.prepare(`
      SELECT entity, COUNT(*) as count, MAX(last_error) as last_error
      FROM sync_queue 
      WHERE status = 'failed'
      GROUP BY entity
    `).all();
  }

  // ============================================
  // Dead Letter Queue (DLQ)
  // ============================================

  /**
   * Move itens que excederam o limite de retentativas para a Dead Letter Queue
   * Isso limpa a sync_queue e preserva os dados para análise/recuperação manual
   */
  moveToDeadLetterQueue(maxRetries: number = 10) {
    const failedItems = this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'failed' AND retry_count >= ?
    `).all(maxRetries) as any[];

    let movedCount = 0;
    for (const item of failedItems) {
      const dlqId = this.generateUUID();
      
      this.db.prepare(`
        INSERT INTO sync_dead_letter (
          id, original_item_id, operation, entity, entity_id, data,
          priority, retry_count, last_error, original_created_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dlqId,
        item.id,
        item.operation,
        item.entity,
        item.entity_id,
        item.data,
        item.priority,
        item.retry_count,
        item.last_error,
        item.created_at,
        `Excedeu limite de ${maxRetries} tentativas`
      );

      // Remover da fila principal
      this.db.prepare('DELETE FROM sync_queue WHERE id = ?').run(item.id);
      movedCount++;
    }

    if (movedCount > 0) {
      console.log(`📦 ${movedCount} itens movidos para Dead Letter Queue`);
    }
    return movedCount;
  }

  /**
   * Lista itens na Dead Letter Queue para análise
   */
  getDeadLetterItems(limit: number = 100) {
    return this.db.prepare(`
      SELECT * FROM sync_dead_letter 
      WHERE resolved_at IS NULL
      ORDER BY moved_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Tenta reprocessar um item da Dead Letter Queue
   * Move de volta para sync_queue com retry_count zerado
   */
  retryDeadLetterItem(dlqId: string) {
    const item = this.db.prepare(
      'SELECT * FROM sync_dead_letter WHERE id = ?'
    ).get(dlqId) as any;

    if (!item) {
      throw new Error('Item não encontrado na Dead Letter Queue');
    }

    // Criar novo item na sync_queue
    const newId = this.generateUUID();
    this.db.prepare(`
      INSERT INTO sync_queue (
        id, operation, entity, entity_id, data, priority, status, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)
    `).run(
      newId,
      item.operation,
      item.entity,
      item.entity_id,
      item.data,
      item.priority
    );

    // Marcar DLQ item como resolvido
    this.db.prepare(`
      UPDATE sync_dead_letter 
      SET resolved_at = CURRENT_TIMESTAMP, resolution_action = 'retry'
      WHERE id = ?
    `).run(dlqId);

    console.log(`🔄 Item ${dlqId} movido de volta para sync_queue como ${newId}`);
    return newId;
  }

  /**
   * Descarta permanentemente um item da Dead Letter Queue
   */
  discardDeadLetterItem(dlqId: string, resolvedBy: string, reason: string) {
    this.db.prepare(`
      UPDATE sync_dead_letter 
      SET resolved_at = CURRENT_TIMESTAMP, 
          resolved_by = ?,
          resolution_action = 'discarded',
          reason = ?
      WHERE id = ?
    `).run(resolvedBy, reason, dlqId);
    
    console.log(`🗑️ Item ${dlqId} descartado da Dead Letter Queue`);
  }

  /**
   * Estatísticas da Dead Letter Queue
   */
  getDeadLetterStats() {
    return this.db.prepare(`
      SELECT 
        entity,
        COUNT(*) as total,
        SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved
      FROM sync_dead_letter
      GROUP BY entity
    `).all();
  }

  // ============================================
  // Reports
  // ============================================

  getSalesReport(startDate: Date, endDate: Date, branchId?: string) {
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
    
    const params: any[] = [startStr, endStr];
    
    if (branchId) {
      query += ' AND branch_id = ?';
      params.push(branchId);
    }
    
    query += ' GROUP BY DATE(opened_at) ORDER BY date DESC';
    
    return this.db.prepare(query).all(...params);
  }

  getInventoryReport(branchId?: string) {
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
    
    const params: any[] = [];
    
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
  createTable(data: { branchId: string; number: string; seats: number; area?: string }) {
    const id = this.generateUUID();
    
    this.db.prepare(`
      INSERT INTO tables (id, branch_id, number, seats, area, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, data.branchId, data.number, data.seats, data.area || null);
    
    // Prioridade 0 - mesas devem ser sincronizadas ANTES das vendas (prioridade 1)
    this.addToSyncQueue('create', 'table', id, data, 0);
    
    return this.db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
  }

  /**
   * Listar mesas
   */
  getTables(filters: { branchId?: string; isActive?: boolean } = {}) {
    let query = 'SELECT * FROM tables WHERE 1=1';
    const params: any[] = [];
    
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
  getTableById(id: string) {
    return this.db.prepare('SELECT * FROM tables WHERE id = ?').get(id);
  }

  /**
   * Atualizar mesa
   */
  updateTable(id: string, data: { status?: string; seats?: number; area?: string; isActive?: boolean }) {
    const existing = this.getTableById(id) as any;
    if (!existing) {
      throw new Error('Mesa não encontrada');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.seats !== undefined) {
      updates.push('seats = ?');
      params.push(data.seats);
    }
    if (data.area !== undefined) {
      updates.push('area = ?');
      params.push(data.area);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = datetime("now")');
      updates.push('synced = 0');
      params.push(id);

      this.db.prepare(`
        UPDATE tables SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);

      // Adicionar à fila de sincronização
      const updated = this.getTableById(id);
      this.addToSyncQueue('update', 'table', id, {
        ...updated,
        source: 'electron',
      }, 0);
    }

    return this.getTableById(id);
  }

  /**
   * Re-sincronizar todas as mesas não sincronizadas
   * Isso adiciona mesas com synced=0 à fila de sync
   */
  resyncUnsyncedTables() {
    const unsyncedTables = this.db.prepare(`
      SELECT * FROM tables WHERE synced = 0
    `).all() as any[];

    console.log(`[RESYNC] Encontradas ${unsyncedTables.length} mesas não sincronizadas`);

    for (const table of unsyncedTables) {
      // Verificar se já está na fila
      const inQueue = this.db.prepare(`
        SELECT id FROM sync_queue 
        WHERE entity = 'table' AND entity_id = ? AND status != 'completed'
      `).get(table.id);

      if (!inQueue) {
        console.log(`[RESYNC] Adicionando mesa ${table.number} à fila de sync`);
        this.addToSyncQueue('create', 'table', table.id, {
          id: table.id,
          branchId: table.branch_id,
          number: table.number,
          seats: table.seats,
          area: table.area,
          isActive: table.is_active === 1,
        }, 0); // Prioridade 0 - antes das vendas
      }
    }

    return unsyncedTables.length;
  }

  /**
   * Re-tentar vendas de mesa que falharam
   * Isso reseta o status das vendas com erro de FK para 'pending'
   */
  retryFailedTableSales() {
    // Buscar vendas de mesa que falharam com erro de FK
    const failedSales = this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE entity = 'sale' 
      AND status = 'failed'
      AND json_extract(data, '$.type') = 'table'
    `).all() as any[];

    console.log(`[RETRY] Encontradas ${failedSales.length} vendas de mesa com falha`);

    let retried = 0;
    for (const sale of failedSales) {
      // Resetar status para pending
      this.db.prepare(`
        UPDATE sync_queue 
        SET status = 'pending', 
            retry_count = 0, 
            last_error = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(sale.id);
      retried++;
      console.log(`[RETRY] Venda ${sale.entity_id} marcada para re-sincronização`);
    }

    // Também re-tentar itens e pagamentos relacionados
    const failedItems = this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'pending', 
          retry_count = 0, 
          last_error = NULL,
          updated_at = datetime('now')
      WHERE entity IN ('sale_item', 'payment') 
      AND status = 'failed'
    `).run();

    console.log(`[RETRY] ${failedItems.changes} itens/pagamentos marcados para re-sincronização`);

    return retried;
  }

  /**
   * Abrir uma sessão de mesa
   */
  openTableSession(data: {
    tableId: string;
    branchId: string;
    openedBy: string;
    notes?: string;
  }) {
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
    `).get(data.branchId) as SessionRow | undefined;
    
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
      description: `Mesa ${(table as TableRow).number} aberta`,
      metadata: JSON.stringify({ tableNumber: (table as TableRow).number }),
    });
    
    this.addToSyncQueue('create', 'table_session', id, data, 1);
    
    return this.getTableSessionById(id);
  }

  /**
   * Buscar sessão de mesa por ID
   */
  getTableSessionById(id: string): SessionRow | null {
    const session = this.db.prepare(`
      SELECT 
        ts.*,
        t.number as table_number,
        t.seats as table_seats
      FROM table_sessions ts
      LEFT JOIN tables t ON ts.table_id = t.id
      WHERE ts.id = ?
    `).get(id) as SessionRow | undefined;
    
    if (!session) return null;
    
    // Buscar clientes da sessão
    const customers = this.db.prepare(`
      SELECT * FROM table_customers WHERE session_id = ? ORDER BY order_sequence ASC
    `).all(id) as CustomerRow[];
    
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
      `).all(customer.id) as OrderRow[];
    }
    
    session.customers = customers;
    
    return session;
  }

  /**
   * Listar sessões de mesa
   */
  getTableSessions(filters: { 
    branchId?: string; 
    status?: string;
    tableId?: string;
  } = {}) {
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
    const params: any[] = [];
    
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
    
    const sessions = this.db.prepare(query).all(...params) as SessionRow[];
    
    // Adicionar contagem de clientes para cada sessão
    for (const session of sessions) {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as customer_count,
          SUM(total) as total_amount
        FROM table_customers 
        WHERE session_id = ?
      `).get(session.id) as StatsRow | undefined;
      
      session.customer_count = stats?.customer_count || 0;
      session.total_amount = stats?.total_amount || 0;
    }
    
    return sessions;
  }

  /**
   * Adicionar cliente à mesa
   */
  addCustomerToTable(data: {
    sessionId: string;
    customerName: string;
    customerId?: string;
    addedBy: string;
  }) {
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
    `).get(data.sessionId) as CustomerRow | undefined;
    
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
    
    // Adicionar à fila de sincronização (prioridade 2 - depois de sessões)
    this.addToSyncQueue('create', 'table_customer', id, {
      id,
      sessionId: data.sessionId,
      customerName: data.customerName,
      customerId: data.customerId,
      addedBy: data.addedBy,
    }, 2);
    
    return this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(id) as CustomerRow;
  }

  /**
   * Fazer pedido para um cliente da mesa
   */
  addTableOrder(data: {
    sessionId: string;
    tableCustomerId: string;
    productId: string;
    qtyUnits: number;
    isMuntu?: boolean;
    notes?: string;
    orderedBy: string;
  }) {
    console.log('[addTableOrder] Chamado com:', JSON.stringify(data));
    const id = this.generateUUID();
    
    // Verificar sessão
    const session = this.getTableSessionById(data.sessionId);
    console.log('[addTableOrder] Sessão encontrada:', session ? { id: session.id, branch_id: session.branch_id, status: session.status } : 'null');
    
    if (!session || session.status !== 'open') {
      throw new Error('Sessão de mesa não está aberta');
    }
    
    // Buscar produto
    const product = this.getProductById(data.productId) as ProductRow | undefined;
    if (!product) {
      throw new Error('Produto não encontrado');
    }
    
    console.log('[addTableOrder] Produto encontrado:', { id: product.id, name: product.name });
    console.log('[addTableOrder] Produto COMPLETO:', JSON.stringify(product, null, 2));
    
    // Calcular preços
    let unitPrice: number;
    let subtotal: number;
    
    if (data.isMuntu && product.muntu_price && product.muntu_quantity) {
      // Muntu: calcular quantos packs foram pedidos
      // Ex: 12 unidades / 6 unidades por pack = 2 packs
      const numPacks = data.qtyUnits / product.muntu_quantity;
      unitPrice = Math.round(product.muntu_price / product.muntu_quantity);
      subtotal = Math.round(product.muntu_price * numPacks);
    } else {
      unitPrice = product.price_unit || 0;
      subtotal = unitPrice * data.qtyUnits;
    }
    
    const unitCost = product.cost_unit || 0;
    const total = subtotal;
    
    console.log('[addTableOrder] Cálculo de preços:', { isMuntu: data.isMuntu, qtyUnits: data.qtyUnits, unitPrice, subtotal, total });
    
    console.log('[addTableOrder] Prestes a deduzir do estoque:', { productId: data.productId, branchId: session.branch_id, qtyUnits: data.qtyUnits });
    
    // Deduzir do estoque usando método avançado (registra movimentações)
    try {
      this.deductInventoryAdvanced(
        data.productId, 
        session.branch_id!, 
        data.qtyUnits,
        data.isMuntu || false,
        undefined, // saleId (não aplicável para mesas)
        data.orderedBy
      );
      console.log('[addTableOrder] Estoque deduzido com sucesso');
    } catch (error: any) {
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
    `).run(
      id, data.sessionId, data.tableCustomerId, data.productId,
      data.qtyUnits, data.isMuntu ? 1 : 0, unitPrice, unitCost, subtotal, total,
      data.notes || null, data.orderedBy
    );
    
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
    
    // Adicionar à fila de sincronização (prioridade 3 - depois de clientes)
    this.addToSyncQueue('create', 'table_order', id, {
      id,
      sessionId: data.sessionId,
      tableCustomerId: data.tableCustomerId,
      productId: data.productId,
      qtyUnits: data.qtyUnits,
      isMuntu: data.isMuntu || false,
      orderedBy: data.orderedBy,
    }, 3);
    
    return this.db.prepare(`
      SELECT o.*, p.name as product_name 
      FROM table_orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `).get(id) as OrderRow;
  }

  /**
   * Cancelar pedido de mesa (retorna ao estoque)
   */
  cancelTableOrder(data: {
    orderId: string;
    cancelledBy: string;
    reason?: string;
  }) {
    const order = this.db.prepare('SELECT * FROM table_orders WHERE id = ?').get(data.orderId) as OrderRow | undefined;
    
    if (!order) {
      throw new Error('Pedido não encontrado');
    }
    
    if (order.status === 'cancelled') {
      throw new Error('Pedido já foi cancelado');
    }
    
    // Retornar ao estoque
    const session = this.getTableSessionById(order.session_id!);
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
    this.updateTableCustomerTotals(order.table_customer_id!);
    this.updateTableSessionTotals(order.session_id!);
    
    // Registrar ação
    this.logTableAction({
      sessionId: order.session_id!,
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
  transferTableOrder(data: {
    orderId: string;
    fromCustomerId: string;
    toCustomerId: string;
    qtyUnits?: number; // Se não especificado, transfere tudo
    transferredBy: string;
  }) {
    const order = this.db.prepare('SELECT * FROM table_orders WHERE id = ?').get(data.orderId) as OrderRow | undefined;
    
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
    const fromCustomer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.fromCustomerId) as CustomerRow | undefined;
    const toCustomer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.toCustomerId) as CustomerRow | undefined;
    
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
    } else {
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
      `).run(
        newOrderId, order.session_id, data.toCustomerId, order.product_id,
        qtyToTransfer, order.is_muntu, order.unit_price, order.unit_cost,
        unitPriceVal * qtyToTransfer, unitPriceVal * qtyToTransfer,
        order.status, 'Transferido de outro cliente', data.transferredBy
      );
    }
    
    // Atualizar totais
    this.updateTableCustomerTotals(data.fromCustomerId);
    this.updateTableCustomerTotals(data.toCustomerId);
    
    // Registrar ação
    this.logTableAction({
      sessionId: order.session_id!,
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
  splitTableOrder(data: {
    orderId: string;
    splits: Array<{ customerId: string; qtyUnits: number }>;
    splitBy: string;
  }) {
    const order = this.db.prepare('SELECT * FROM table_orders WHERE id = ?').get(data.orderId) as OrderRow | undefined;
    
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
      `).run(
        newOrderId, order.session_id, split.customerId, order.product_id,
        split.qtyUnits, order.is_muntu, order.unit_price, order.unit_cost,
        unitPriceVal * split.qtyUnits, unitPriceVal * split.qtyUnits,
        order.status, 'Item dividido', data.splitBy
      );
      
      this.updateTableCustomerTotals(split.customerId);
    }
    
    // Registrar ação
    this.logTableAction({
      sessionId: order.session_id!,
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
  transferTableSession(data: {
    sessionId: string;
    toTableId: string;
    transferredBy: string;
  }) {
    const session = this.getTableSessionById(data.sessionId);
    
    if (!session) {
      throw new Error('Sessão não encontrada');
    }
    
    // Verificar se mesa destino está disponível
    const existingSession = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
    `).get(data.toTableId) as SessionRow | undefined;
    
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
  transferTableCustomers(data: {
    sessionId: string;
    customerIds: string[];
    toTableId: string;
    transferredBy: string;
  }) {
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
    `).all(...data.customerIds, data.sessionId) as CustomerRow[];

    if (customers.length !== data.customerIds.length) {
      throw new Error('Um ou mais clientes não pertencem a esta sessão');
    }

    // Verificar se mesa destino já tem sessão aberta
    let targetSession = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
      ORDER BY opened_at DESC LIMIT 1
    `).get(data.toTableId) as SessionRow | undefined;

    // Se mesa destino não tem sessão, criar uma nova
    if (!targetSession) {
      const newSessionId = this.generateUUID();
      
      // Gerar número sequencial da sessão
      const lastSession = this.db.prepare(`
        SELECT session_number FROM table_sessions 
        WHERE branch_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(session.branch_id) as SessionRow | undefined;
      
      const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
      
      this.db.prepare(`
        INSERT INTO table_sessions (
          id, table_id, branch_id, session_number, status, opened_by
        ) VALUES (?, ?, ?, ?, 'open', ?)
      `).run(newSessionId, data.toTableId, session.branch_id, sessionNumber, data.transferredBy);

      targetSession = this.db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(newSessionId) as SessionRow;

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
    const remainingCustomers = this.db.prepare(
      'SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?'
    ).get(data.sessionId) as { count: number };

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
  mergeTableSessions(data: {
    sessionIds: string[];
    targetTableId: string;
    mergedBy: string;
  }) {
    if (!data.sessionIds || data.sessionIds.length < 2) {
      throw new Error('É necessário selecionar pelo menos 2 mesas para unir');
    }

    // Buscar todas as sessões
    const sessions = this.db.prepare(`
      SELECT * FROM table_sessions 
      WHERE id IN (${data.sessionIds.map(() => '?').join(',')}) 
      AND status IN ('open', 'awaiting_payment')
    `).all(...data.sessionIds) as SessionRow[];

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
    let targetSession: SessionRow | undefined;

    if (isTargetInMerge) {
      // Se a mesa destino é uma das que está sendo unida, usar essa sessão
      targetSession = sessions.find(s => s.table_id === data.targetTableId);
    } else {
      // Verificar se mesa destino está livre
      const existingSession = this.db.prepare(`
        SELECT * FROM table_sessions 
        WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
      `).get(data.targetTableId) as SessionRow | undefined;

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
      `).get(sessions[0].branch_id) as SessionRow | undefined;
      
      const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
      
      this.db.prepare(`
        INSERT INTO table_sessions (
          id, table_id, branch_id, session_number, status, opened_by
        ) VALUES (?, ?, ?, ?, 'open', ?)
      `).run(newSessionId, data.targetTableId, sessions[0].branch_id, sessionNumber, data.mergedBy);

      targetSession = this.db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(newSessionId) as SessionRow;

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
    const sessionsToClose = sessions.filter(s => s.id !== targetSession!.id);
    let totalCustomersMerged = 0;
    let totalOrdersMerged = 0;

    for (const session of sessionsToClose) {
      // Contar clientes e pedidos
      const customerCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?'
      ).get(session.id) as { count: number };

      const orderCount = this.db.prepare(
        "SELECT COUNT(*) as count FROM table_orders WHERE session_id = ? AND status != 'cancelled'"
      ).get(session.id) as { count: number };

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
  splitMergedTable(data: {
    sessionId: string;
    distributions: Array<{
      customerIds: string[];
      tableId: string;
    }>;
    splitBy: string;
  }) {
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
    `).all(...allCustomerIds, data.sessionId) as CustomerRow[];

    if (customers.length !== allCustomerIds.length) {
      throw new Error('Um ou mais clientes não pertencem a esta sessão');
    }

    // Verificar se há duplicatas
    const uniqueIds = new Set(allCustomerIds);
    if (uniqueIds.size !== allCustomerIds.length) {
      throw new Error('Um mesmo cliente não pode estar em múltiplas mesas');
    }

    const createdSessions: { tableId: string; sessionId: string; customerCount: number }[] = [];

    // Processar cada distribuição
    for (const distribution of data.distributions) {
      if (distribution.customerIds.length === 0) {
        continue;
      }

      let targetSession: SessionRow | undefined;

      // Se a mesa é a mesma da sessão original, manter os clientes lá
      if (distribution.tableId === session.table_id) {
        targetSession = session;
      } else {
        // Verificar se mesa destino já tem sessão aberta
        targetSession = this.db.prepare(`
          SELECT * FROM table_sessions 
          WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
          ORDER BY opened_at DESC LIMIT 1
        `).get(distribution.tableId) as SessionRow | undefined;

        // Se mesa destino não tem sessão, criar uma nova
        if (!targetSession) {
          const newSessionId = this.generateUUID();
          
          // Gerar número sequencial da sessão
          const lastSession = this.db.prepare(`
            SELECT session_number FROM table_sessions 
            WHERE branch_id = ? 
            ORDER BY created_at DESC LIMIT 1
          `).get(session.branch_id) as SessionRow | undefined;
          
          const sessionNumber = this.generateSequentialNumber(lastSession?.session_number, 'SESSION');
          
          this.db.prepare(`
            INSERT INTO table_sessions (
              id, table_id, branch_id, session_number, status, opened_by
            ) VALUES (?, ?, ?, ?, 'open', ?)
          `).run(newSessionId, distribution.tableId, session.branch_id, sessionNumber, data.splitBy);

          targetSession = this.db.prepare('SELECT * FROM table_sessions WHERE id = ?').get(newSessionId) as SessionRow;

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
    const remainingCustomers = this.db.prepare(
      'SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?'
    ).get(data.sessionId) as { count: number };

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
  private updateTableSessionTotals(sessionId: string) {
    const totals = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_amount
      FROM table_customers
      WHERE session_id = ?
    `).get(sessionId) as { total_amount: number };

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
  processTableCustomerPayment(data: {
    sessionId: string;
    tableCustomerId: string;
    method: string;
    amount: number;
    referenceNumber?: string;
    processedBy: string;
  }) {
    const session = this.getTableSessionById(data.sessionId) as any;
    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    const customer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.tableCustomerId) as any;
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // Buscar apenas pedidos PENDENTES do cliente (não cancelados E não pagos)
    const orders = this.db.prepare(`
      SELECT o.*, p.name as product_name
      FROM table_orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.table_customer_id = ? AND o.status NOT IN ('cancelled', 'paid')
    `).all(data.tableCustomerId) as any[];

    if (orders.length === 0) {
      throw new Error('Cliente não possui pedidos pendentes');
    }

    // Calcular total dos pedidos PENDENTES (não usar customer.total que inclui pagos)
    const pendingTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Gerar número de venda único - usar MAX para evitar duplicação após sync
    const saleNumber = this.generateUniqueSaleNumber();

    // Criar venda (SALE) - usar pendingTotal em vez de customer.total
    const saleId = this.generateUUID();
    this.db.prepare(`
      INSERT INTO sales (
        id, sale_number, branch_id, type, table_id, customer_id, 
        cashier_id, status, subtotal, total, muntu_savings, 
        opened_at, closed_at
      ) VALUES (?, ?, ?, 'table', ?, ?, ?, 'paid', ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      saleId, 
      saleNumber, 
      session.branch_id, 
      session.table_id,
      customer.customer_id || null, // ID do cliente cadastrado (se houver)
      data.processedBy,
      pendingTotal,
      pendingTotal,
      0 // muntu_savings será calculado pelos itens
    );

    // Adicionar itens da venda (SALE_ITEMS)
    let totalMuntuSavings = 0;
    for (const order of orders) {
      const itemId = this.generateUUID();
      
      // Calcular economia Muntu
      let muntuSavings = 0;
      if (order.is_muntu) {
        const product: any = this.db.prepare('SELECT price_unit, muntu_quantity FROM products WHERE id = ?').get(order.product_id);
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
      `).run(
        itemId, 
        saleId, 
        order.product_id, 
        order.qty_units, 
        order.is_muntu ? 1 : 0,
        order.unit_price,
        order.unit_cost,
        order.subtotal,
        order.total,
        muntuSavings
      );

      // Adicionar item à fila de sincronização
      this.addToSyncQueue('create', 'sale_item', itemId, {
        saleId,
        productId: order.product_id,
        qtyUnits: order.qty_units,
        isMuntu: order.is_muntu ? true : false,
        unitPrice: order.unit_price,
        unitCost: order.unit_cost,
        subtotal: order.subtotal,
        total: order.total,
        muntuSavings: muntuSavings,
      }, 2); // Prioridade 2 (após a venda)
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

    // Adicionar pagamento à fila de sincronização
    this.addToSyncQueue('create', 'payment', paymentId, {
      saleId,
      method: data.method,
      amount: data.amount,
      referenceNumber: data.referenceNumber || null,
      status: 'completed',
    }, 3); // Prioridade 3 (após itens da venda)

    // Criar pagamento de mesa (table_payments) para rastreamento
    const tablePaymentId = this.generateUUID();
    this.db.prepare(`
      INSERT INTO table_payments (
        id, session_id, table_customer_id, payment_id, method, amount, 
        reference_number, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tablePaymentId, 
      data.sessionId, 
      data.tableCustomerId, 
      paymentId,
      data.method, 
      data.amount, 
      data.referenceNumber || null, 
      data.processedBy
    );

    // Adicionar pagamento de mesa à fila de sincronização (prioridade 4)
    this.addToSyncQueue('create', 'table_payment', tablePaymentId, {
      id: tablePaymentId,
      sessionId: data.sessionId,
      tableCustomerId: data.tableCustomerId,
      paymentId,
      method: data.method,
      amount: data.amount,
      referenceNumber: data.referenceNumber || null,
      processedBy: data.processedBy,
    }, 4);

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
    const currentCashBox: any = this.getCurrentCashBox();
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
      } catch (error) {
        console.error('[LOYALTY] Erro ao adicionar pontos:', error);
      }
    }

    // Adicionar à fila de sincronização - DADOS COMPLETOS DA VENDA
    const saleData = this.getSaleById(saleId);
    const saleQueueData = {
      id: saleId,
      saleNumber,
      branchId: session.branch_id,
      type: 'table',
      tableId: session.table_id,
      customerId: customer.customer_id || null,
      customerName: customer.customer_name,
      cashierId: data.processedBy,
      status: 'paid',
      subtotal: pendingTotal,
      total: pendingTotal,
      muntuSavings: totalMuntuSavings,
      paymentMethod: data.method,
      ...saleData
    };
    console.log('[MESA] Adicionando venda à fila de sync:', JSON.stringify(saleQueueData, null, 2).substring(0, 500));
    this.addToSyncQueue('create', 'sale', saleId, saleQueueData, 1);

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
  processTableSessionPayment(data: {
    sessionId: string;
    method: string;
    amount: number;
    referenceNumber?: string;
    processedBy: string;
  }) {
    const session = this.getTableSessionById(data.sessionId) as any;
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
    `).all(data.sessionId) as any[];

    if (orders.length === 0) {
      throw new Error('Nenhum pedido pendente para pagamento');
    }

    // Calcular total dos pedidos
    const totalOrders = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Gerar número de venda único - usar MAX para evitar duplicação após sync
    const saleNumber = this.generateUniqueSaleNumber();

    // Verificar se há cliente único cadastrado na mesa
    const customers = this.db.prepare(`
      SELECT DISTINCT customer_id 
      FROM table_customers 
      WHERE session_id = ? AND customer_id IS NOT NULL
    `).all(data.sessionId) as any[];
    
    const singleCustomerId = customers.length === 1 ? customers[0].customer_id : null;

    // Criar venda (SALE)
    const saleId = this.generateUUID();
    this.db.prepare(`
      INSERT INTO sales (
        id, sale_number, branch_id, type, table_id, customer_id, 
        cashier_id, status, subtotal, total, muntu_savings, 
        opened_at, closed_at
      ) VALUES (?, ?, ?, 'table', ?, ?, ?, 'paid', ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      saleId, 
      saleNumber, 
      session.branch_id, 
      session.table_id,
      singleCustomerId,
      data.processedBy,
      totalOrders,
      totalOrders,
      0 // será atualizado depois
    );

    // Adicionar itens da venda (SALE_ITEMS) e calcular economia Muntu
    let totalMuntuSavings = 0;
    const customerIds = new Set<string>();

    for (const order of orders) {
      const itemId = this.generateUUID();
      
      // Calcular economia Muntu
      let muntuSavings = 0;
      if (order.is_muntu) {
        const product: any = this.db.prepare('SELECT price_unit FROM products WHERE id = ?').get(order.product_id);
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
      `).run(
        itemId, 
        saleId, 
        order.product_id, 
        order.qty_units, 
        order.is_muntu ? 1 : 0,
        order.unit_price,
        order.unit_cost,
        order.subtotal,
        order.total,
        muntuSavings
      );

      // Adicionar item à fila de sincronização
      this.addToSyncQueue('create', 'sale_item', itemId, {
        saleId,
        productId: order.product_id,
        qtyUnits: order.qty_units,
        isMuntu: order.is_muntu ? true : false,
        unitPrice: order.unit_price,
        unitCost: order.unit_cost,
        subtotal: order.subtotal,
        total: order.total,
        muntuSavings: muntuSavings,
      }, 2); // Prioridade 2 (após a venda)

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

    // Adicionar pagamento à fila de sincronização
    this.addToSyncQueue('create', 'payment', paymentId, {
      saleId,
      method: data.method,
      amount: data.amount,
      referenceNumber: data.referenceNumber || null,
      status: 'completed',
    }, 3); // Prioridade 3 (após itens da venda)

    // Criar pagamento de mesa (table_payments)
    const tablePaymentId = this.generateUUID();
    this.db.prepare(`
      INSERT INTO table_payments (
        id, session_id, payment_id, method, amount, reference_number, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tablePaymentId, 
      data.sessionId, 
      paymentId,
      data.method, 
      data.amount, 
      data.referenceNumber || null, 
      data.processedBy
    );

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
    const currentCashBox: any = this.getCurrentCashBox();
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
        } catch (error) {
          console.error('[LOYALTY] Erro ao adicionar pontos:', error);
        }
      }
    }

    // Adicionar à fila de sincronização - DADOS COMPLETOS DA VENDA
    const saleData = this.getSaleById(saleId);
    this.addToSyncQueue('create', 'sale', saleId, {
      id: saleId,
      saleNumber,
      branchId: session.branch_id,
      type: 'table',
      tableId: session.table_id,
      customerId: singleCustomerId,
      cashierId: data.processedBy,
      status: 'paid',
      subtotal: totalOrders,
      total: totalOrders,
      muntuSavings: totalMuntuSavings,
      paymentMethod: data.method,
      ...saleData
    }, 1);

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
   * Limpar pedidos pagos de um cliente
   * Remove pedidos com status 'paid' do histórico da mesa, mantendo apenas pendentes
   */
  clearPaidOrders(data: {
    sessionId: string;
    tableCustomerId: string;
    clearedBy: string;
  }) {
    const session = this.getTableSessionById(data.sessionId);
    if (!session) {
      throw new Error('Sessão não encontrada');
    }

    const customer = this.db.prepare('SELECT * FROM table_customers WHERE id = ?').get(data.tableCustomerId) as any;
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // Contar pedidos pagos antes de deletar
    const paidOrders = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(total) as total
      FROM table_orders 
      WHERE table_customer_id = ? AND status = 'paid'
    `).get(data.tableCustomerId) as any;

    if (paidOrders.count === 0) {
      throw new Error('Cliente não possui pedidos pagos para limpar');
    }

    // Deletar pedidos pagos
    this.db.prepare(`
      DELETE FROM table_orders 
      WHERE table_customer_id = ? AND status = 'paid'
    `).run(data.tableCustomerId);

    // Recalcular totais do cliente baseado nos pedidos restantes (pendentes)
    const remainingOrders = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COALESCE(SUM(subtotal), 0) as subtotal
      FROM table_orders 
      WHERE table_customer_id = ? AND status NOT IN ('cancelled', 'paid')
    `).get(data.tableCustomerId) as any;

    // Atualizar totais do cliente
    this.db.prepare(`
      UPDATE table_customers 
      SET subtotal = ?,
          total = ?,
          paid_amount = 0,
          payment_status = CASE WHEN ? > 0 THEN 'pending' ELSE 'pending' END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      remainingOrders.subtotal || 0,
      remainingOrders.total || 0,
      remainingOrders.total || 0,
      data.tableCustomerId
    );

    // Recalcular totais da sessão
    const sessionTotals = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COALESCE(SUM(paid_amount), 0) as paid
      FROM table_customers 
      WHERE session_id = ?
    `).get(data.sessionId) as any;

    this.db.prepare(`
      UPDATE table_sessions 
      SET total_amount = ?,
          paid_amount = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(sessionTotals.total || 0, sessionTotals.paid || 0, data.sessionId);

    // Registrar ação
    this.logTableAction({
      sessionId: data.sessionId,
      actionType: 'clear_paid_orders',
      performedBy: data.clearedBy,
      description: `Limpeza de ${paidOrders.count} pedidos pagos (${paidOrders.total / 100} FCFA) - ${customer.customer_name}`,
      metadata: JSON.stringify({ 
        customerId: data.tableCustomerId,
        ordersCleared: paidOrders.count,
        totalCleared: paidOrders.total
      }),
    });

    return {
      success: true,
      ordersCleared: paidOrders.count,
      totalCleared: paidOrders.total,
      remainingTotal: remainingOrders.total || 0
    };
  }

  /**
   * Fechar sessão de mesa
   */
  closeTableSession(data: {
    sessionId: string;
    closedBy: string;
    notes?: string;
  }) {
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
  setCustomerLoyaltyPoints(customerCode: string, points: number) {
    // Buscar cliente
    const customer: any = this.db.prepare(`
      SELECT id, code, full_name, loyalty_points FROM customers WHERE code = ?
    `).get(customerCode);

    if (!customer) {
      throw new Error(`Cliente com código ${customerCode} não encontrado`);
    }

    const previousPoints = customer.loyalty_points || 0;

    // Se os pontos não mudaram, não fazer nada (evitar loop infinito)
    if (previousPoints === points) {
      return {
        success: true,
        customerName: customer.full_name,
        customerCode: customer.code,
        previousPoints,
        newPoints: points,
        difference: 0,
        skipped: true
      };
    }

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
  fixCustomerLoyaltyPoints(customerCode: string) {
    // Buscar cliente
    const customer: any = this.db.prepare(`
      SELECT id, code, full_name, loyalty_points FROM customers WHERE code = ?
    `).get(customerCode);

    if (!customer) {
      throw new Error(`Cliente com código ${customerCode} não encontrado`);
    }

    // Calcular total de vendas do cliente (em centavos)
    const salesTotal: any = this.db.prepare(`
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
  private updateTableCustomerTotals(tableCustomerId: string) {
    const totals = this.db.prepare(`
      SELECT 
        COALESCE(SUM(subtotal), 0) as subtotal,
        COALESCE(SUM(total), 0) as total
      FROM table_orders
      WHERE table_customer_id = ? AND status != 'cancelled'
    `).get(tableCustomerId) as TotalsRow;
    
    this.db.prepare(`
      UPDATE table_customers 
      SET subtotal = ?, total = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(totals.subtotal, totals.total, tableCustomerId);
  }

  /**
   * Registrar ação de auditoria
   */
  private logTableAction(data: {
    sessionId: string;
    actionType: string;
    performedBy: string;
    description: string;
    metadata?: string;
  }) {
    const id = this.generateUUID();
    
    this.db.prepare(`
      INSERT INTO table_actions (
        id, session_id, action_type, performed_by, description, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id, data.sessionId, data.actionType, data.performedBy, 
      data.description, data.metadata || null
    );
  }

  /**
   * Buscar histórico de ações de uma sessão
   */
  getTableSessionActions(sessionId: string) {
    return this.db.prepare(`
      SELECT * FROM table_actions 
      WHERE session_id = ? 
      ORDER BY performed_at DESC
    `).all(sessionId) as Record<string, any>[];
  }

  /**
   * Obter resumo de todas as mesas (dashboard)
   */
  getTablesOverview(branchId: string) {
    const tables = this.getTables({ branchId, isActive: true });
    
    return tables.map((table: any) => {
      const session = this.db.prepare(`
        SELECT * FROM table_sessions 
        WHERE table_id = ? AND status IN ('open', 'awaiting_payment')
        ORDER BY opened_at DESC LIMIT 1
      `).get(table.id) as SessionRow | undefined;
      
      if (session) {
        const customerCount = this.db.prepare(`
          SELECT COUNT(*) as count FROM table_customers WHERE session_id = ?
        `).get(session.id) as CountRow;
        
        const orderCount = this.db.prepare(`
          SELECT COUNT(*) as count FROM table_orders 
          WHERE session_id = ? AND status != 'cancelled'
        `).get(session.id) as CountRow;
        
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

  /**
   * Cria um backup completo do banco de dados
   */
  async createBackup(backupDir: string, backupType: string = 'manual', createdBy?: string): Promise<{ 
    success: boolean; 
    filePath?: string; 
    fileName?: string;
    fileSize?: number;
    error?: string;
  }> {
    try {
      // Garantir que o diretório de backup existe
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log('📁 Diretório de backup criado:', backupDir);
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const fileName = `barmanager-backup-${timestamp}.db`;
      const backupFile = path.join(backupDir, fileName);
      
      console.log('📦 Criando backup em:', backupFile);
      
      // Usar backup do better-sqlite3 - retorna Promise
      await this.db.backup(backupFile);
      
      // Verificar se o arquivo foi criado
      if (!fs.existsSync(backupFile)) {
        throw new Error(`Arquivo de backup não foi criado: ${backupFile}`);
      }
      
      // Obter tamanho do arquivo
      const stats = fs.statSync(backupFile);
      const fileSize = stats.size;
      
      // Registrar no histórico
      const historyId = this.generateUUID();
      this.db.prepare(`
        INSERT INTO backup_history (id, file_name, file_path, file_size, backup_type, status, created_by)
        VALUES (?, ?, ?, ?, ?, 'completed', ?)
      `).run(historyId, fileName, backupFile, fileSize, backupType, createdBy || 'system');
      
      console.log('✅ Backup criado:', backupFile, '- Tamanho:', Math.round(fileSize / 1024), 'KB');
      
      return { 
        success: true, 
        filePath: backupFile, 
        fileName,
        fileSize 
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar backup:', error);
      
      // Registrar falha no histórico
      try {
        const historyId = this.generateUUID();
        this.db.prepare(`
          INSERT INTO backup_history (id, file_name, file_path, backup_type, status, error_message, created_by)
          VALUES (?, ?, ?, ?, 'failed', ?, ?)
        `).run(historyId, 'failed', backupDir, backupType, error.message, createdBy || 'system');
      } catch (e) {
        // Ignorar erro ao registrar falha
      }
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Restaura o banco de dados a partir de um backup
   */
  async restoreBackup(backupFile: string): Promise<{ 
    success: boolean; 
    error?: string;
    requiresRestart?: boolean;
  }> {
    try {
      // Validar se o arquivo existe
      if (!fs.existsSync(backupFile)) {
        throw new Error('Arquivo de backup não encontrado');
      }
      
      // Validar se é um arquivo SQLite válido
      const header = Buffer.alloc(16);
      const fd = fs.openSync(backupFile, 'r');
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      
      // SQLite files start with "SQLite format 3\0"
      const sqliteHeader = 'SQLite format 3';
      if (!header.toString('ascii', 0, 15).startsWith(sqliteHeader)) {
        throw new Error('Arquivo não é um backup válido do BarManager');
      }
      
      // Verificar integridade do backup abrindo-o temporariamente
      let testDb: any = null;
      try {
        const Database = require('better-sqlite3');
        testDb = new Database(backupFile, { readonly: true });
        
        // Verificar se tem as tabelas essenciais
        const tables: any[] = testDb.pragma('table_list') as any[];
        const requiredTables = ['users', 'branches', 'products', 'sales'];
        const tableNames = tables.map((t: any) => t.name);
        
        for (const required of requiredTables) {
          if (!tableNames.includes(required)) {
            throw new Error(`Backup inválido: tabela '${required}' não encontrada`);
          }
        }
        
        testDb.close();
      } catch (error: any) {
        if (testDb) testDb.close();
        throw new Error(`Backup corrompido ou inválido: ${error.message}`);
      }
      
      // Criar backup do banco atual antes de restaurar
      const currentBackupDir = path.dirname(this.dbPath);
      const currentBackupFile = path.join(currentBackupDir, `pre-restore-backup-${Date.now()}.db`);
      
      try {
        // db.backup é assíncrono
        await this.db.backup(currentBackupFile);
        console.log('📦 Backup de segurança criado:', currentBackupFile);
      } catch (e) {
        console.warn('⚠️ Não foi possível criar backup de segurança antes da restauração');
      }
      
      // Fechar banco atual
      this.db.close();
      
      // Copiar arquivo de backup para o caminho do banco
      fs.copyFileSync(backupFile, this.dbPath);
      
      // Remover arquivos WAL e SHM se existirem (podem causar conflitos)
      const walFile = this.dbPath + '-wal';
      const shmFile = this.dbPath + '-shm';
      if (fs.existsSync(walFile)) {
        fs.unlinkSync(walFile);
        console.log('🗑️ Arquivo WAL removido');
      }
      if (fs.existsSync(shmFile)) {
        fs.unlinkSync(shmFile);
        console.log('🗑️ Arquivo SHM removido');
      }
      
      // Reabrir banco
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      
      // Verificar integridade do banco restaurado
      const integrityCheck = this.db.pragma('integrity_check');
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        throw new Error('Banco restaurado falhou na verificação de integridade');
      }
      
      // Registrar a restauração no histórico
      try {
        const historyId = this.generateUUID();
        const fileName = path.basename(backupFile);
        this.db.prepare(`
          INSERT INTO backup_history (id, file_name, file_path, backup_type, status, created_by)
          VALUES (?, ?, ?, 'restore', 'completed', 'system')
        `).run(historyId, fileName, backupFile);
      } catch (e) {
        console.warn('⚠️ Não foi possível registrar restauração no histórico');
      }
      
      console.log('✅ Banco de dados restaurado com sucesso!');
      
      return { 
        success: true,
        requiresRestart: true 
      };
    } catch (error: any) {
      console.error('❌ Erro ao restaurar backup:', error);
      
      // Tentar reabrir o banco original se a restauração falhar
      try {
        if (!this.db || !this.db.open) {
          const Database = require('better-sqlite3');
          this.db = new Database(this.dbPath);
          this.db.pragma('journal_mode = WAL');
        }
      } catch (reopenError) {
        console.error('❌ Falha crítica: não foi possível reabrir o banco de dados');
      }
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Lista histórico de backups
   */
  getBackupHistory(limit: number = 20): any[] {
    try {
      return this.db.prepare(`
        SELECT * FROM backup_history 
        ORDER BY created_at DESC 
        LIMIT ?
      `).all(limit);
    } catch (error) {
      console.error('Erro ao buscar histórico de backups:', error);
      return [];
    }
  }

  /**
   * Deleta um backup do histórico e opcionalmente o arquivo
   */
  deleteBackup(id: string, deleteFile: boolean = true): { success: boolean; error?: string } {
    try {
      const backup: any = this.db.prepare('SELECT * FROM backup_history WHERE id = ?').get(id);
      
      if (!backup) {
        throw new Error('Backup não encontrado no histórico');
      }
      
      // Deletar arquivo se solicitado
      if (deleteFile && backup.file_path && fs.existsSync(backup.file_path)) {
        fs.unlinkSync(backup.file_path);
        console.log('🗑️ Arquivo de backup deletado:', backup.file_path);
      }
      
      // Remover do histórico
      this.db.prepare('DELETE FROM backup_history WHERE id = ?').run(id);
      
      return { success: true };
    } catch (error: any) {
      console.error('Erro ao deletar backup:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Seed Data
  // ============================================

  private async seedInitialData() {
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
    const existingBranch = this.db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
    
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
      `).get() as { count: number };
      
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
        `).get() as { count: number };
        
        console.log(`[Migration] Sale items com unit_cost = 0 ou NULL após atualização: ${countAfter.count}`);
        
        return {
          success: true,
          recordsBefore: countBefore.count,
          recordsUpdated: result.changes,
          recordsAfter: countAfter.count
        };
      } else {
        console.log('[Migration] ✅ Todos os sale_items já têm unit_cost preenchido!');
        return {
          success: true,
          recordsBefore: 0,
          recordsUpdated: 0,
          recordsAfter: 0
        };
      }
    } catch (error) {
      console.error('[Migration] ❌ Erro ao corrigir unit_cost:', error);
      throw error;
    }
  }

  // ============================================
  // Utilities
  // ============================================

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Gera um número de venda único (SALE-XXXXXX)
   * Usa MAX para extrair o maior número existente, evitando duplicação após sync
   */
  private generateUniqueSaleNumber(): string {
    // Buscar TODOS os sale_numbers e encontrar o maior número
    const allSales: any[] = this.db.prepare(
      "SELECT sale_number FROM sales WHERE sale_number LIKE 'SALE-%'"
    ).all();
    
    let maxNumber = 0;
    for (const sale of allSales) {
      if (sale.sale_number) {
        const match = sale.sale_number.match(/SALE-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }
    
    return `SALE-${String(maxNumber + 1).padStart(6, '0')}`;
  }

  private generateSequentialNumber(lastNumber: string | null | undefined, prefix: string): string {
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
      const existingSales = this.db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count: number };
      
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
        `).run(
          saleId,
          saleNumber,
          branchId,
          cashierId,
          subtotal,
          total,
          muntuSavings,
          date.toISOString(),
          date.toISOString(),
          date.toISOString(),
          date.toISOString()
        );
      }
      
      console.log('[Seed] ✅ 20 vendas de exemplo criadas!');
    } catch (error) {
      console.error('[Seed] ❌ Erro ao criar vendas de exemplo:', error);
    }
  }

  // ============================================
  // Sync Helper Methods (for Railway sync)
  // ============================================

  /**
   * Obtém um valor de configuração genérico
   */
  getSetting(key: string): string | null {
    try {
      const result = this.db.prepare(
        "SELECT value FROM settings WHERE key = ?"
      ).get(key) as { value: string } | undefined;
      return result?.value || null;
    } catch (error) {
      console.error('Erro ao obter setting:', key, error);
      return null;
    }
  }

  /**
   * Define um valor de configuração genérico
   * 🔴 CORREÇÃO F5: Sincroniza configurações globais
   */
  setSetting(key: string, value: string, syncToServer: boolean = true) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, synced, updated_at)
        VALUES (?, ?, 0, datetime('now'))
      `).run(key, value);
      
      // Sincronizar para o servidor (exceto configurações locais)
      const localOnlySettings = ['device_id', 'last_sync_date', 'sync_token'];
      if (syncToServer && !localOnlySettings.includes(key)) {
        this.addToSyncQueue('update', 'setting', key, { key, value }, 3);
      }
    } catch (error) {
      console.error('Erro ao definir setting:', key, error);
    }
  }
  
  /**
   * Define um valor de configuração a partir do servidor (sem sincronizar de volta)
   */
  setSettingFromServer(key: string, value: string) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, synced, updated_at)
        VALUES (?, ?, 1, datetime('now'))
      `).run(key, value);
    } catch (error) {
      console.error('Erro ao definir setting do servidor:', key, error);
    }
  }
  
  /**
   * Obtém todas as configurações não sincronizadas
   */
  getUnsyncedSettings(): Array<{ key: string; value: string }> {
    try {
      const localOnlySettings = ['device_id', 'last_sync_date', 'sync_token'];
      const placeholders = localOnlySettings.map(() => '?').join(',');
      
      return this.db.prepare(`
        SELECT key, value FROM settings 
        WHERE synced = 0 AND key NOT IN (${placeholders})
      `).all(...localOnlySettings) as Array<{ key: string; value: string }>;
    } catch (error) {
      console.error('Erro ao obter settings não sincronizadas:', error);
      return [];
    }
  }
  
  /**
   * Marca uma configuração como sincronizada
   */
  markSettingSynced(key: string) {
    try {
      this.db.prepare('UPDATE settings SET synced = 1 WHERE key = ?').run(key);
    } catch (error) {
      console.error('Erro ao marcar setting como sincronizada:', key, error);
    }
  }
  
  /**
   * Obtém todas as configurações (para sincronização)
   */
  getAllSettings(): Array<{ key: string; value: string }> {
    try {
      const localOnlySettings = ['device_id', 'last_sync_date', 'sync_token'];
      const placeholders = localOnlySettings.map(() => '?').join(',');
      
      return this.db.prepare(`
        SELECT key, value FROM settings 
        WHERE key NOT IN (${placeholders})
      `).all(...localOnlySettings) as Array<{ key: string; value: string }>;
    } catch (error) {
      console.error('Erro ao obter todas settings:', error);
      return [];
    }
  }

  /**
   * Obtém ou gera um ID único para este dispositivo
   * O ID é persistido e reutilizado em todas as operações
   */
  getDeviceId(): string {
    try {
      const existingDeviceId = this.getSetting('device_id');
      
      if (existingDeviceId) {
        return existingDeviceId;
      }
      
      // Gerar um novo device_id único
      const os = require('os');
      const crypto = require('crypto');
      
      // Combinar informações do sistema para criar um ID único
      const machineInfo = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model || 'unknown',
        Date.now().toString(36),
        crypto.randomBytes(4).toString('hex')
      ].join('-');
      
      const newDeviceId = crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
      
      // Salvar para uso futuro
      this.setSetting('device_id', newDeviceId);
      console.log(`🆔 Device ID gerado: ${newDeviceId}`);
      
      return newDeviceId;
    } catch (error) {
      console.error('Erro ao obter/gerar device_id:', error);
      // Fallback: gerar um ID simples
      const fallbackId = `device-${Date.now().toString(36)}`;
      this.setSetting('device_id', fallbackId);
      return fallbackId;
    }
  }

  /**
   * Conta o número de registros em uma tabela
   */
  count(tableName: string): number {
    try {
      // Sanitizar nome da tabela para evitar SQL injection
      const validTables = [
        'customers', 'products', 'categories', 'suppliers', 'tables',
        'sales', 'purchases', 'cash_boxes', 'inventory_movements', 
        'settings', 'branches', 'users', 'inventory_items', 'sale_items',
        'purchase_items', 'debts', 'payments', 'loyalty_transactions'
      ];
      
      if (!validTables.includes(tableName)) {
        console.warn(`Tabela inválida para count: ${tableName}`);
        return 0;
      }
      
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
      return result?.count || 0;
    } catch (error) {
      console.error(`Erro ao contar registros em ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Conta itens pendentes na fila de sincronização para uma entidade específica
   */
  getPendingSyncCount(entity: string): number {
    try {
      const result = this.db.prepare(
        `SELECT COUNT(*) as count FROM sync_queue WHERE entity = ? AND status = 'pending'`
      ).get(entity) as { count: number } | undefined;
      return result?.count || 0;
    } catch (error) {
      console.error(`Erro ao contar sync pendente para ${entity}:`, error);
      return 0;
    }
  }

  /**
   * Obtém a última data de sincronização
   */
  getLastSyncDate(): Date | null {
    try {
      const result = this.db.prepare(
        "SELECT value FROM settings WHERE key = 'last_sync_date'"
      ).get() as { value: string } | undefined;
      
      if (result?.value) {
        return new Date(result.value);
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter última data de sincronização:', error);
      return null;
    }
  }

  /**
   * Define a última data de sincronização
   */
  setLastSyncDate(date: Date) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('last_sync_date', ?, datetime('now'))
      `).run(date.toISOString());
    } catch (error) {
      console.error('Erro ao definir última data de sincronização:', error);
    }
  }

  /**
   * Obtém uma filial pelo ID
   */
  getBranchById(id: string) {
    try {
      return this.db.prepare('SELECT * FROM branches WHERE id = ?').get(id);
    } catch (error) {
      console.error('Erro ao buscar branch por ID:', error);
      return null;
    }
  }

  /**
   * Obtém o ID da primeira filial disponível (útil como default)
   */
  getDefaultBranchId(): string | null {
    try {
      const branch = this.db.prepare('SELECT id FROM branches WHERE is_active = 1 ORDER BY is_main DESC, created_at ASC LIMIT 1').get() as { id: string } | undefined;
      return branch?.id || null;
    } catch (error) {
      console.error('Erro ao buscar branch default:', error);
      return null;
    }
  }

  /**
   * Cria uma nova filial
   */
  createBranch(data: any) {
    try {
      const id = data.id || this.generateUUID();
      this.db.prepare(`
        INSERT INTO branches (
          id, name, code, address, phone, is_main, is_active, synced, last_sync, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        data.name,
        data.code,
        data.address || null,
        data.phone || null,
        data.is_main || 0,
        data.is_active !== undefined ? data.is_active : 1,
        data.synced || 0,
        data.last_sync || null
      );
      return { id, ...data };
    } catch (error) {
      console.error('Erro ao criar branch:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma filial existente
   */
  updateBranch(id: string, data: any) {
    try {
      const fields = [];
      const values = [];

      if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
      if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
      if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.is_main !== undefined) { fields.push('is_main = ?'); values.push(data.is_main); }
      if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }
      if (data.synced !== undefined) { fields.push('synced = ?'); values.push(data.synced); }
      if (data.last_sync !== undefined) { fields.push('last_sync = ?'); values.push(data.last_sync); }

      if (fields.length > 0) {
        fields.push('updated_at = datetime(\'now\')');
        values.push(id);
        this.db.prepare(`UPDATE branches SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      return this.getBranchById(id);
    } catch (error) {
      console.error('Erro ao atualizar branch:', error);
      throw error;
    }
  }

  /**
   * Obtém um fornecedor pelo ID
   */
  getSupplierById(id: string) {
    try {
      return this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    } catch (error) {
      console.error('Erro ao buscar supplier por ID:', error);
      return null;
    }
  }

  /**
   * Obtém uma categoria pelo ID
   */
  getCategoryById(id: string) {
    try {
      return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    } catch (error) {
      console.error('Erro ao buscar category por ID:', error);
      return null;
    }
  }

  /**
   * Atualiza usuário a partir de dados do servidor (sem sobrescrever senha)
   */
  updateUserFromServer(id: string, data: any) {
    try {
      const fields = [];
      const values = [];

      if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username); }
      if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
      if (data.full_name !== undefined) { fields.push('full_name = ?'); values.push(data.full_name); }
      if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
      if (data.branch_id !== undefined) { fields.push('branch_id = ?'); values.push(data.branch_id); }
      if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
      if (data.allowed_tabs !== undefined) { 
        // Aceitar tanto array quanto string JSON
        const allowedTabsJson = Array.isArray(data.allowed_tabs) 
          ? JSON.stringify(data.allowed_tabs) 
          : data.allowed_tabs;
        fields.push('allowed_tabs = ?'); 
        values.push(allowedTabsJson); 
      }
      if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }
      if (data.synced !== undefined) { fields.push('synced = ?'); values.push(data.synced); }
      if (data.last_sync !== undefined) { fields.push('last_sync = ?'); values.push(data.last_sync); }
      
      // Atualizar campos de controle de sincronização
      fields.push('sync_status = ?'); values.push('SYNCED');
      fields.push('server_id = ?'); values.push(data.server_id || id);
      fields.push('sync_error = ?'); values.push(null);

      if (fields.length > 0) {
        fields.push('updated_at = datetime(\'now\')');
        values.push(id);
        this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      return this.getUserById(id);
    } catch (error) {
      console.error('Erro ao atualizar usuário do servidor:', error);
      throw error;
    }
  }

  // Métodos públicos para acesso ao banco de dados
  prepare(query: string): any {
    return this.db.prepare(query);
  }

  exec(query: string): any {
    return this.db.exec(query);
  }

  /**
   * Adiciona TODAS as entidades locais à fila de sincronização
   * na ordem correta de dependência (entidades base primeiro)
   * Use quando o Railway está vazio e precisa de uma sincronização completa
   */
  queueFullResync(): { total: number; byEntity: Record<string, number> } {
    console.log('🔄 Iniciando queue de ressincronização completa...');
    
    // Ordem de sincronização (entidades base primeiro)
    const SYNC_ORDER = [
      { table: 'categories', entity: 'category', priority: 0 },
      { table: 'suppliers', entity: 'supplier', priority: 5 },
      { table: 'customers', entity: 'customer', priority: 10 },
      { table: 'products', entity: 'product', priority: 15 },
      { table: 'debts', entity: 'debt', priority: 20 },
      { table: 'debt_payments', entity: 'debt_payment', priority: 30 },
      { table: 'purchases', entity: 'purchase', priority: 25 },
      { table: 'sales', entity: 'sale', priority: 35 },
    ];
    
    // Limpar fila atual para evitar duplicatas
    console.log('🗑️ Limpando fila de sincronização atual...');
    this.db.prepare('DELETE FROM sync_queue').run();
    
    const insertQueue = this.db.prepare(`
      INSERT INTO sync_queue (id, entity, entity_id, operation, data, status, priority, created_at)
      VALUES (?, ?, ?, 'create', ?, 'pending', ?, datetime('now'))
    `);
    
    let totalAdded = 0;
    const byEntity: Record<string, number> = {};
    
    for (const { table, entity, priority } of SYNC_ORDER) {
      try {
        const rows = this.db.prepare(`SELECT * FROM ${table}`).all() as any[];
        
        for (const row of rows) {
          const queueId = this.generateUUID(); // Gerar ID único para cada item da fila
          insertQueue.run(queueId, entity, row.id, JSON.stringify(row), priority);
          totalAdded++;
        }
        
        byEntity[entity] = rows.length;
        console.log(`  ✅ ${entity}: ${rows.length} adicionados (prioridade ${priority})`);
      } catch (e: any) {
        console.log(`  ⏭️ ${table}: ${e.message}`);
        byEntity[entity] = 0;
      }
    }
    
    console.log(`\n📋 Total de itens na fila: ${totalAdded}`);
    return { total: totalAdded, byEntity };
  }

  /**
   * 🔍 VALIDAÇÃO PÓS-SYNC: Compara produtos locais com Railway
   * Retorna lista de inconsistências encontradas
   */
  getProductSyncValidation(): {
    localOnly: any[];
    mismatch: any[];
    totalLocal: number;
    lastCheck: string;
  } {
    // Buscar produtos locais ativos
    const localProducts = this.db.prepare(`
      SELECT id, sku, name, price_unit, is_active, synced, last_sync
      FROM products 
      WHERE is_active = 1
      ORDER BY name
    `).all() as any[];
    
    // Verificar quais NÃO foram sincronizados
    const localOnly = localProducts.filter(p => !p.synced || p.synced === 0);
    
    // Verificar itens na fila pendentes para produtos
    const pendingProductSync = this.db.prepare(`
      SELECT entity_id, operation, status, last_error, retry_count, created_at
      FROM sync_queue 
      WHERE entity = 'product' AND status IN ('pending', 'failed')
      ORDER BY created_at DESC
    `).all() as any[];
    
    return {
      localOnly,
      mismatch: pendingProductSync,
      totalLocal: localProducts.length,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * 🔍 Marca um produto como sincronizado após confirmação do servidor
   */
  markProductSynced(id: string, serverTimestamp?: string) {
    this.db.prepare(`
      UPDATE products 
      SET synced = 1, last_sync = ? 
      WHERE id = ?
    `).run(serverTimestamp || new Date().toISOString(), id);
  }

  /**
   * 🔍 Marca um produto como falha de sincronização
   */
  markProductSyncFailed(id: string, error: string) {
    this.db.prepare(`
      UPDATE products 
      SET synced = 0, sync_error = ? 
      WHERE id = ?
    `).run(error, id);
  }

  /**
   * 📊 Retorna resumo do estado de sincronização de todas as entidades
   */
  getSyncHealthReport(): {
    products: { total: number; synced: number; pending: number; failed: number };
    categories: { total: number; synced: number; pending: number; failed: number };
    suppliers: { total: number; synced: number; pending: number; failed: number };
    queue: { pending: number; failed: number; completed: number };
    lastSync: string | null;
  } {
    // Produtos
    const productStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM products WHERE is_active = 1
    `).get() as any;
    
    // Categorias
    const categoryStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM categories WHERE is_active = 1
    `).get() as any;
    
    // Fornecedores
    const supplierStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN synced = 1 THEN 1 ELSE 0 END) as synced
      FROM suppliers WHERE is_active = 1
    `).get() as any;
    
    // Fila
    const queueStats = this.getSyncQueueStats();
    
    // Última sincronização
    const lastSync = this.getSetting('last_sync_date');
    
    return {
      products: {
        total: productStats?.total || 0,
        synced: productStats?.synced || 0,
        pending: (productStats?.total || 0) - (productStats?.synced || 0),
        failed: queueStats.byEntity.find((e: any) => e.entity === 'product' && e.status === 'failed')?.count || 0,
      },
      categories: {
        total: categoryStats?.total || 0,
        synced: categoryStats?.synced || 0,
        pending: (categoryStats?.total || 0) - (categoryStats?.synced || 0),
        failed: queueStats.byEntity.find((e: any) => e.entity === 'category' && e.status === 'failed')?.count || 0,
      },
      suppliers: {
        total: supplierStats?.total || 0,
        synced: supplierStats?.synced || 0,
        pending: (supplierStats?.total || 0) - (supplierStats?.synced || 0),
        failed: queueStats.byEntity.find((e: any) => e.entity === 'supplier' && e.status === 'failed')?.count || 0,
      },
      queue: {
        pending: queueStats.pending,
        failed: queueStats.failed,
        completed: queueStats.completed,
      },
      lastSync,
    };
  }

  /**
   * Retorna estatísticas da fila de sincronização
   */
  getSyncQueueStats(): { pending: number; failed: number; completed: number; byEntity: any[] } {
    const stats = this.db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY status
    `).all() as any[];
    
    const byEntity = this.db.prepare(`
      SELECT 
        entity,
        status,
        COUNT(*) as count
      FROM sync_queue
      GROUP BY entity, status
      ORDER BY entity
    `).all() as any[];
    
    return {
      pending: stats.find(s => s.status === 'pending')?.count || 0,
      failed: stats.find(s => s.status === 'failed')?.count || 0,
      completed: stats.find(s => s.status === 'completed')?.count || 0,
      byEntity,
    };
  }

  /**
   * Retorna contagem total de itens de sync pendentes (sem filtro de entidade)
   */
  getTotalPendingSyncCount(): number {
    const result = this.db.prepare(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'"
    ).get() as any;
    return result?.count || 0;
  }

  /**
   * Retorna contagem de itens de sync com falha
   */
  getFailedSyncCount(): number {
    const result = this.db.prepare(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'"
    ).get() as any;
    return result?.count || 0;
  }

  /**
   * Retorna contagem de itens na Dead Letter Queue
   */
  getDlqCount(): number {
    const result = this.db.prepare(
      "SELECT COUNT(*) as count FROM sync_dead_letter WHERE resolved_at IS NULL"
    ).get() as any;
    return result?.count || 0;
  }

  /**
   * Retorna IDs de itens sincronizados recentemente (para ACK)
   */
  getRecentlySyncedIds(): string[] {
    const results = this.db.prepare(`
      SELECT entity_id FROM sync_queue 
      WHERE status = 'pending' 
        AND synced = 0 
        AND updated_at > datetime('now', '-1 minute')
      LIMIT 50
    `).all() as any[];
    return results.map((r: any) => r.entity_id);
  }

  // ============================================
  // FASE 3: Sync Audit, Conflicts & Device Registry
  // ============================================

  /**
   * Registra uma entrada no log de auditoria de sync
   */
  logSyncAudit(params: {
    action: string;
    entity: string;
    entityId?: string;
    direction: 'push' | 'pull';
    status: 'success' | 'error' | 'conflict';
    details?: any;
    errorMessage?: string;
  }) {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const deviceId = this.getDeviceId();
    
    this.db.prepare(`
      INSERT INTO sync_audit_log (id, device_id, action, entity, entity_id, direction, status, details, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      deviceId,
      params.action,
      params.entity,
      params.entityId || null,
      params.direction,
      params.status,
      params.details ? JSON.stringify(params.details) : null,
      params.errorMessage || null
    );
    
    return id;
  }

  /**
   * Obtém log de auditoria de sync
   */
  getSyncAuditLog(options?: { limit?: number; entity?: string; status?: string }): any[] {
    let query = 'SELECT * FROM sync_audit_log WHERE 1=1';
    const params: any[] = [];
    
    if (options?.entity) {
      query += ' AND entity = ?';
      params.push(options.entity);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    return this.db.prepare(query).all(...params);
  }

  /**
   * Limpa logs antigos de auditoria (mantém últimos 7 dias)
   */
  cleanOldAuditLogs(daysToKeep: number = 7) {
    const result = this.db.prepare(`
      DELETE FROM sync_audit_log 
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(daysToKeep);
    
    console.log(`🧹 ${result.changes} logs de auditoria antigos removidos`);
    return result.changes;
  }

  /**
   * Registra um conflito de sincronização
   */
  registerSyncConflict(params: {
    entity: string;
    entityId: string;
    localData: any;
    serverData: any;
    serverDeviceId?: string;
    localTimestamp: Date;
    serverTimestamp: Date;
  }) {
    const id = `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const deviceId = this.getDeviceId();
    
    this.db.prepare(`
      INSERT INTO sync_conflicts (id, entity, entity_id, local_data, server_data, local_device_id, server_device_id, local_timestamp, server_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.entity,
      params.entityId,
      JSON.stringify(params.localData),
      JSON.stringify(params.serverData),
      deviceId,
      params.serverDeviceId || null,
      params.localTimestamp.toISOString(),
      params.serverTimestamp.toISOString()
    );
    
    console.log(`⚠️ Conflito registrado: ${params.entity}/${params.entityId}`);
    return id;
  }

  /**
   * Obtém conflitos pendentes de resolução
   */
  getPendingConflicts(): any[] {
    return this.db.prepare(`
      SELECT * FROM sync_conflicts 
      WHERE resolution IS NULL 
      ORDER BY created_at DESC
    `).all();
  }

  /**
   * Resolve um conflito
   */
  resolveConflict(conflictId: string, resolution: 'keep_local' | 'keep_server' | 'merge', resolvedBy?: string) {
    this.db.prepare(`
      UPDATE sync_conflicts 
      SET resolution = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE id = ?
    `).run(resolution, resolvedBy || 'system', conflictId);
    
    console.log(`✅ Conflito ${conflictId} resolvido: ${resolution}`);
  }

  /**
   * Detecta conflito comparando timestamps
   * Retorna true se houver conflito (ambos modificados após último sync)
   */
  detectConflict(entity: string, entityId: string, serverUpdatedAt: Date): { hasConflict: boolean; localData?: any; serverTimestamp: Date } {
    try {
      // Buscar dados locais
      const localData = this.db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(entityId) as any;
      
      if (!localData) {
        return { hasConflict: false, serverTimestamp: serverUpdatedAt };
      }
      
      const localUpdatedAt = new Date(localData.updated_at);
      const lastSync = this.getLastSyncDate();
      
      // Se ambos foram modificados após o último sync, há conflito
      if (lastSync && localUpdatedAt > lastSync && serverUpdatedAt > lastSync) {
        return { 
          hasConflict: true, 
          localData, 
          serverTimestamp: serverUpdatedAt 
        };
      }
      
      return { hasConflict: false, serverTimestamp: serverUpdatedAt };
    } catch (error) {
      console.error(`Erro ao detectar conflito para ${entity}/${entityId}:`, error);
      return { hasConflict: false, serverTimestamp: serverUpdatedAt };
    }
  }

  /**
   * Atualiza heartbeat do dispositivo atual
   */
  updateDeviceHeartbeat() {
    const deviceId = this.getDeviceId();
    const os = require('os');
    const deviceName = os.hostname();
    
    this.db.prepare(`
      INSERT INTO device_registry (device_id, device_name, last_heartbeat, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(device_id) DO UPDATE SET
        device_name = excluded.device_name,
        last_heartbeat = CURRENT_TIMESTAMP,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(deviceId, deviceName);
  }

  /**
   * Atualiza última sincronização do dispositivo
   */
  updateDeviceLastSync() {
    const deviceId = this.getDeviceId();
    
    this.db.prepare(`
      UPDATE device_registry 
      SET last_sync = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE device_id = ?
    `).run(deviceId);
  }

  /**
   * Obtém lista de dispositivos ativos (heartbeat nos últimos 5 minutos)
   */
  getActiveDevices(): any[] {
    return this.db.prepare(`
      SELECT * FROM device_registry 
      WHERE last_heartbeat > datetime('now', '-5 minutes')
      AND is_active = 1
      ORDER BY last_heartbeat DESC
    `).all();
  }

  /**
   * Obtém todos os dispositivos registrados
   */
  getAllDevices(): any[] {
    return this.db.prepare(`
      SELECT *,
        CASE 
          WHEN last_heartbeat > datetime('now', '-5 minutes') THEN 'online'
          WHEN last_heartbeat > datetime('now', '-1 hour') THEN 'away'
          ELSE 'offline'
        END as connection_status
      FROM device_registry 
      ORDER BY last_heartbeat DESC
    `).all();
  }

  /**
   * Marca dispositivos inativos (sem heartbeat por mais de 1 hora)
   */
  markInactiveDevices() {
    const result = this.db.prepare(`
      UPDATE device_registry 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE last_heartbeat < datetime('now', '-1 hour')
      AND is_active = 1
    `).run();
    
    if (result.changes > 0) {
      console.log(`📴 ${result.changes} dispositivo(s) marcado(s) como inativo(s)`);
    }
    return result.changes;
  }

  /**
   * Obtém estatísticas de sync por dispositivo
   */
  getDeviceSyncStats(deviceId?: string): any {
    const targetDevice = deviceId || this.getDeviceId();
    
    return {
      auditLogs: this.db.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM sync_audit_log 
        WHERE device_id = ?
        GROUP BY status
      `).all(targetDevice),
      lastSync: this.db.prepare(`
        SELECT last_sync FROM device_registry WHERE device_id = ?
      `).get(targetDevice),
      pendingItems: this.getPendingSyncCount(''),
    };
  }

  // ============================================
  // RESET DE DADOS ADMINISTRATIVO
  // ============================================

  /**
   * Zera todos os dados do banco local, EXCETO usuários, branches e configurações essenciais
   * @param adminUserId - ID do usuário admin que está executando a operação
   * @returns Resultado da operação com estatísticas
   */
  resetLocalData(adminUserId: string): { 
    success: boolean; 
    error?: string; 
    stats?: Record<string, number>;
    backupPath?: string;
  } {
    console.log('🗑️ INICIANDO RESET DE DADOS LOCAIS...');
    console.log(`   Executado por: ${adminUserId}`);
    console.log(`   Data/Hora: ${new Date().toISOString()}`);

    try {
      // 1. Criar backup antes de resetar
      const backupDir = path.dirname(this.dbPath);
      const backupFile = path.join(backupDir, `pre-reset-backup-${Date.now()}.db`);
      
      try {
        this.db.backup(backupFile);
        console.log(`📦 Backup de segurança criado: ${backupFile}`);
      } catch (backupError) {
        console.warn('⚠️ Não foi possível criar backup de segurança');
      }

      const stats: Record<string, number> = {};

      // 2. Desabilitar foreign keys temporariamente para evitar erros de constraint
      this.db.pragma('foreign_keys = OFF');
      console.log('🔓 Foreign keys desabilitadas temporariamente');

      try {
        // 3. Executar dentro de uma transação
        const transaction = this.db.transaction(() => {
          // Tabelas de sincronização e logs
          stats['sync_queue'] = this.db.prepare('DELETE FROM sync_queue').run().changes;
          stats['sync_audit_log'] = this.db.prepare('DELETE FROM sync_audit_log').run().changes;
          
          try {
            stats['sync_conflicts'] = this.db.prepare('DELETE FROM sync_conflicts').run().changes;
          } catch (e) { stats['sync_conflicts'] = 0; }

          // Pagamentos
          stats['payments'] = this.db.prepare('DELETE FROM payments').run().changes;
          
          try {
            stats['debt_payments'] = this.db.prepare('DELETE FROM debt_payments').run().changes;
          } catch (e) { stats['debt_payments'] = 0; }

          // Itens de vendas e compras
          stats['sale_items'] = this.db.prepare('DELETE FROM sale_items').run().changes;
          
          try {
            stats['purchase_items'] = this.db.prepare('DELETE FROM purchase_items').run().changes;
          } catch (e) { stats['purchase_items'] = 0; }

          // Vendas, compras e caixas
          stats['sales'] = this.db.prepare('DELETE FROM sales').run().changes;
          
          try {
            stats['purchases'] = this.db.prepare('DELETE FROM purchases').run().changes;
          } catch (e) { stats['purchases'] = 0; }
          
          try {
            stats['cash_boxes'] = this.db.prepare('DELETE FROM cash_boxes').run().changes;
          } catch (e) { stats['cash_boxes'] = 0; }

          // Dívidas
          try {
            stats['debts'] = this.db.prepare('DELETE FROM debts').run().changes;
          } catch (e) { stats['debts'] = 0; }

          // Movimentações de estoque
          try {
            stats['stock_movements'] = this.db.prepare('DELETE FROM stock_movements').run().changes;
          } catch (e) { stats['stock_movements'] = 0; }

          // Inventário
          try {
            stats['inventory_items'] = this.db.prepare('DELETE FROM inventory_items').run().changes;
          } catch (e) { stats['inventory_items'] = 0; }

          // Mesas e sessões (deletar em ordem: orders -> customers -> sessions -> tables)
          try {
            stats['table_orders'] = this.db.prepare('DELETE FROM table_orders').run().changes;
          } catch (e) { stats['table_orders'] = 0; }
          
          try {
            stats['table_customers'] = this.db.prepare('DELETE FROM table_customers').run().changes;
          } catch (e) { stats['table_customers'] = 0; }
          
          try {
            stats['table_sessions'] = this.db.prepare('DELETE FROM table_sessions').run().changes;
          } catch (e) { stats['table_sessions'] = 0; }
          
          try {
            stats['tables'] = this.db.prepare('DELETE FROM tables').run().changes;
          } catch (e) { stats['tables'] = 0; }

          // Produtos e categorias
          stats['products'] = this.db.prepare('DELETE FROM products').run().changes;
          stats['categories'] = this.db.prepare('DELETE FROM categories').run().changes;

          // Fornecedores
          try {
            stats['suppliers'] = this.db.prepare('DELETE FROM suppliers').run().changes;
          } catch (e) { stats['suppliers'] = 0; }

          // Clientes
          stats['customers'] = this.db.prepare('DELETE FROM customers').run().changes;

          // CORREÇÃO CRÍTICA: Limpar last_sync_date para forçar sync completo
          // Sem isso, o sync usa updatedAfter=<data antiga> e servidor retorna vazio
          try {
            this.db.prepare("DELETE FROM settings WHERE key = 'last_sync_date'").run();
            console.log('🗑️ last_sync_date removido - próximo sync será completo');
          } catch (e) {
            console.warn('⚠️ Não foi possível limpar last_sync_date');
          }

          // Registrar a operação de reset no log
          // Colunas da tabela: id, device_id, action, entity, entity_id, direction, status, details, error_message, created_at
          const auditId = this.generateUUID();
          this.db.prepare(`
            INSERT INTO sync_audit_log (id, device_id, action, entity, entity_id, direction, status, details, created_at)
            VALUES (?, ?, 'RESET_LOCAL_DATA', 'system', ?, 'local', 'completed', ?, datetime('now'))
          `).run(auditId, this.getDeviceId(), adminUserId, JSON.stringify(stats));
        });

        // Executar transação
        transaction();

      } finally {
        // 4. Reabilitar foreign keys
        this.db.pragma('foreign_keys = ON');
        console.log('🔒 Foreign keys reabilitadas');
      }

      console.log('✅ RESET DE DADOS LOCAIS CONCLUÍDO!');
      console.log('📊 Estatísticas de deleção:');
      for (const [table, count] of Object.entries(stats)) {
        if (count > 0) {
          console.log(`   ${table}: ${count} registros deletados`);
        }
      }

      return { 
        success: true, 
        stats,
        backupPath: backupFile 
      };

    } catch (error: any) {
      console.error('❌ ERRO NO RESET DE DADOS LOCAIS:', error);
      // Garantir que foreign keys são reabilitadas mesmo em caso de erro
      try {
        this.db.pragma('foreign_keys = ON');
      } catch (e) {}
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Obtém contagem de registros por tabela para preview do reset
   */
  getDataCountsForReset(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    const tables = [
      'sales', 'sale_items', 'payments',
      'purchases', 'purchase_items',
      'products', 'categories', 'suppliers',
      'customers', 'debts', 'debt_payments',
      'inventory_items', 'stock_movements',
      'tables', 'table_sessions', 'table_customers', 'table_orders',
      'cash_boxes',
      'sync_queue', 'sync_audit_log', 'sync_conflicts'
    ];

    for (const table of tables) {
      try {
        const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
        counts[table] = result?.count || 0;
      } catch (e) {
        counts[table] = 0;
      }
    }

    // Adicionar contagem de preservados
    try {
      counts['_preserved_users'] = (this.db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
      counts['_preserved_branches'] = (this.db.prepare('SELECT COUNT(*) as count FROM branches').get() as any)?.count || 0;
    } catch (e) {
      // Ignorar
    }

    return counts;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
