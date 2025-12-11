import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';

class DatabaseService {
  static final DatabaseService instance = DatabaseService._init();
  static Database? _database;

  DatabaseService._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('vendas_manager.db');
    return _database!;
  }

  Future<void> init() async {
    await database;
  }

  Future<Database> _initDB(String fileName) async {
    final directory = await getApplicationDocumentsDirectory();
    final path = join(directory.path, fileName);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
      onUpgrade: _upgradeDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    // Tabela de usuários/auth
    await db.execute('''
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        branch_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');

    // Tabela de categorias
    await db.execute('''
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');

    // Tabela de produtos
    await db.execute('''
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        category_id TEXT,
        price_unit INTEGER DEFAULT 0,
        price_box INTEGER,
        cost_unit INTEGER DEFAULT 0,
        cost_box INTEGER,
        units_per_box INTEGER DEFAULT 1,
        is_muntu_eligible INTEGER DEFAULT 0,
        muntu_quantity INTEGER,
        muntu_price INTEGER,
        is_active INTEGER DEFAULT 1,
        barcode TEXT,
        image_url TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    ''');

    // Tabela de estoque/inventário
    await db.execute('''
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        qty_units INTEGER DEFAULT 0,
        low_stock_alert INTEGER DEFAULT 10,
        batch_number TEXT,
        expiry_date TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    ''');

    // Tabela de clientes
    await db.execute('''
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        credit_limit INTEGER DEFAULT 0,
        current_debt INTEGER DEFAULT 0,
        loyalty_points INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');

    // Tabela de caixa
    await db.execute('''
      CREATE TABLE IF NOT EXISTS cash_boxes (
        id TEXT PRIMARY KEY,
        box_number TEXT NOT NULL,
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
        opened_at TEXT,
        closed_at TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');

    // Tabela de mesas
    await db.execute('''
      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        number TEXT NOT NULL,
        seats INTEGER DEFAULT 4,
        area TEXT,
        status TEXT DEFAULT 'available',
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0
      )
    ''');

    // Tabela de sessões de mesa
    await db.execute('''
      CREATE TABLE IF NOT EXISTS table_sessions (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        session_number TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        opened_by TEXT NOT NULL,
        closed_by TEXT,
        total_amount INTEGER DEFAULT 0,
        paid_amount INTEGER DEFAULT 0,
        notes TEXT,
        opened_at TEXT,
        closed_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (table_id) REFERENCES tables(id)
      )
    ''');

    // Tabela de clientes da mesa
    await db.execute('''
      CREATE TABLE IF NOT EXISTS table_customers (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        order_sequence INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        paid_amount INTEGER DEFAULT 0,
        payment_status TEXT DEFAULT 'pending',
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES table_sessions(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    ''');

    // Tabela de pedidos da mesa
    await db.execute('''
      CREATE TABLE IF NOT EXISTS table_orders (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        table_customer_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        qty_units INTEGER DEFAULT 1,
        is_muntu INTEGER DEFAULT 0,
        unit_price INTEGER DEFAULT 0,
        unit_cost INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        ordered_by TEXT,
        ordered_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES table_sessions(id),
        FOREIGN KEY (table_customer_id) REFERENCES table_customers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    ''');

    // Tabela de vendas
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        sale_number TEXT NOT NULL UNIQUE,
        branch_id TEXT NOT NULL,
        type TEXT DEFAULT 'counter',
        table_id TEXT,
        customer_id TEXT,
        cashier_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        subtotal INTEGER DEFAULT 0,
        tax_amount INTEGER DEFAULT 0,
        discount INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        muntu_savings INTEGER DEFAULT 0,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        opened_at TEXT,
        closed_at TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    ''');

    // Tabela de itens da venda
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        qty_units INTEGER DEFAULT 1,
        is_muntu INTEGER DEFAULT 0,
        unit_price INTEGER DEFAULT 0,
        unit_cost INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        tax_amount INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        muntu_savings INTEGER DEFAULT 0,
        created_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    ''');

    // Tabela de pagamentos
    await db.execute('''
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        method TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reference_number TEXT,
        status TEXT DEFAULT 'completed',
        processed_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      )
    ''');

    // Tabela de débitos (vales)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        sale_id TEXT,
        branch_id TEXT NOT NULL,
        original_amount INTEGER NOT NULL,
        balance INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        due_date TEXT,
        created_by TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      )
    ''');

    // Tabela de fila de sincronização
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT NOT NULL,
        priority INTEGER DEFAULT 10,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        last_error TEXT,
        created_at TEXT,
        processed_at TEXT,
        status TEXT DEFAULT 'pending'
      )
    ''');

    // Criar índices para melhor performance
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id)');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_table_orders_session ON table_orders(session_id)');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)');
  }

  Future<void> _upgradeDB(Database db, int oldVersion, int newVersion) async {
    // Migrações futuras aqui
  }

  // Métodos genéricos CRUD
  Future<int> insert(String table, Map<String, dynamic> data) async {
    final db = await database;
    return await db.insert(table, data,
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> query(
    String table, {
    String? where,
    List<dynamic>? whereArgs,
    String? orderBy,
    int? limit,
  }) async {
    final db = await database;
    return await db.query(
      table,
      where: where,
      whereArgs: whereArgs,
      orderBy: orderBy,
      limit: limit,
    );
  }

  Future<int> update(
    String table,
    Map<String, dynamic> data, {
    String? where,
    List<dynamic>? whereArgs,
  }) async {
    final db = await database;
    return await db.update(table, data, where: where, whereArgs: whereArgs);
  }

  Future<int> delete(
    String table, {
    String? where,
    List<dynamic>? whereArgs,
  }) async {
    final db = await database;
    return await db.delete(table, where: where, whereArgs: whereArgs);
  }

  Future<List<Map<String, dynamic>>> rawQuery(String sql,
      [List<dynamic>? arguments]) async {
    final db = await database;
    return await db.rawQuery(sql, arguments);
  }

  Future<int> rawInsert(String sql, [List<dynamic>? arguments]) async {
    final db = await database;
    return await db.rawInsert(sql, arguments);
  }

  Future<int> rawUpdate(String sql, [List<dynamic>? arguments]) async {
    final db = await database;
    return await db.rawUpdate(sql, arguments);
  }

  // Métodos de sincronização
  Future<void> addToSyncQueue({
    required String entityType,
    required String entityId,
    required String action,
    required Map<String, dynamic> data,
    int priority = 10,
  }) async {
    // Converter data para JSON string válido
    String dataJson;
    try {
      dataJson = jsonEncode(data);
    } catch (e) {
      dataJson = '{}';
    }

    await insert('sync_queue', {
      'entity_type': entityType,
      'entity_id': entityId,
      'action': action,
      'data': dataJson,
      'priority': priority,
      'created_at': DateTime.now().toIso8601String(),
      'status': 'pending',
    });
  }

  Future<List<Map<String, dynamic>>> getPendingSyncItems() async {
    return await query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['pending'],
      orderBy: 'priority ASC, created_at ASC',
    );
  }

  Future<void> markSyncItemProcessed(int id) async {
    await update(
      'sync_queue',
      {
        'status': 'processed',
        'processed_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> markSyncItemFailed(int id, String error) async {
    await rawUpdate('''
      UPDATE sync_queue 
      SET attempts = attempts + 1, 
          last_error = ?,
          status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END
      WHERE id = ?
    ''', [error, id]);
  }

  // Métodos adicionais para sincronização
  Future<List<Map<String, dynamic>>> getSyncQueue() async {
    return await query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['pending'],
      orderBy: 'priority ASC, created_at ASC',
    );
  }

  Future<void> removeSyncQueueItem(int id) async {
    await delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  Future<Map<String, dynamic>?> getById(String table, String id) async {
    final results =
        await query(table, where: 'id = ?', whereArgs: [id], limit: 1);
    return results.isNotEmpty ? results.first : null;
  }

  Future<void> markAsSynced(String table, String id) async {
    await update(table, {'synced': 1}, where: 'id = ?', whereArgs: [id]);
  }

  // Limpar banco (para debug)
  Future<void> clearAllData() async {
    final db = await database;
    await db.delete('sync_queue');
    await db.delete('payments');
    await db.delete('sale_items');
    await db.delete('sales');
    await db.delete('table_orders');
    await db.delete('table_customers');
    await db.delete('table_sessions');
    await db.delete('tables');
    await db.delete('debts');
    await db.delete('cash_boxes');
    await db.delete('inventory');
    await db.delete('customers');
    await db.delete('products');
    await db.delete('categories');
    await db.delete('users');
  }
}
