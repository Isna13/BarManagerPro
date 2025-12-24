import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
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
      version: 7,
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
        created_at TEXT,
        updated_at TEXT,
        source TEXT,
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
        product_name TEXT,
        qty_units INTEGER DEFAULT 1,
        display_qty INTEGER DEFAULT 1,
        is_muntu INTEGER DEFAULT 0,
        muntu_quantity INTEGER DEFAULT 3,
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

    // Tabela de pagamentos de mesa
    await db.execute('''
      CREATE TABLE IF NOT EXISTS table_payments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        table_customer_id TEXT,
        method TEXT NOT NULL,
        amount INTEGER NOT NULL,
        processed_by TEXT,
        processed_at TEXT,
        is_session_payment INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES table_sessions(id),
        FOREIGN KEY (table_customer_id) REFERENCES table_customers(id)
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
        customer_name TEXT,
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
    // 🔴 CORREÇÃO CRÍTICA: max_attempts aumentado de 3 para 10
    // Vendas não podem ser perdidas por falhas temporárias de rede
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT NOT NULL,
        priority INTEGER DEFAULT 10,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 10,
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
    // Migração da versão 1 para 2: adicionar colunas à table_sessions
    if (oldVersion < 2) {
      await db.execute('ALTER TABLE table_sessions ADD COLUMN created_at TEXT');
      await db.execute('ALTER TABLE table_sessions ADD COLUMN updated_at TEXT');
      await db.execute('ALTER TABLE table_sessions ADD COLUMN source TEXT');
    }

    // Migração da versão 2 para 3: adicionar product_name em table_orders
    if (oldVersion < 3) {
      try {
        await db
            .execute('ALTER TABLE table_orders ADD COLUMN product_name TEXT');
      } catch (_) {
        // Coluna já existe ou tabela não existe; ignorar.
      }
    }

    // Migração da versão 3 para 4: adicionar tabela table_payments
    if (oldVersion < 4) {
      try {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS table_payments (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            table_customer_id TEXT,
            method TEXT NOT NULL,
            amount INTEGER NOT NULL,
            processed_by TEXT,
            processed_at TEXT,
            is_session_payment INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES table_sessions(id),
            FOREIGN KEY (table_customer_id) REFERENCES table_customers(id)
          )
        ''');
      } catch (_) {
        // Tabela já existe; ignorar.
      }
    }

    // Migração da versão 4 para 5: adicionar customer_name em sales
    if (oldVersion < 5) {
      try {
        await db.execute('ALTER TABLE sales ADD COLUMN customer_name TEXT');
      } catch (_) {
        // Coluna já existe; ignorar.
      }
    }

    // Migração da versão 5 para 6: adicionar display_qty e muntu_quantity em table_orders
    if (oldVersion < 6) {
      try {
        await db.execute(
            'ALTER TABLE table_orders ADD COLUMN display_qty INTEGER DEFAULT 1');
      } catch (_) {
        // Coluna já existe; ignorar.
      }
      try {
        await db.execute(
            'ALTER TABLE table_orders ADD COLUMN muntu_quantity INTEGER DEFAULT 3');
      } catch (_) {
        // Coluna já existe; ignorar.
      }
    }

    // Migração da versão 6 para 7: garantir display_qty existe
    if (oldVersion < 7) {
      try {
        await db.execute(
            'ALTER TABLE table_orders ADD COLUMN display_qty INTEGER DEFAULT 1');
      } catch (_) {
        // Coluna já existe; ignorar.
      }
    }
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

  /// 🔴 CORREÇÃO CRÍTICA: Criar venda de forma ATÔMICA (transacional)
  /// Garante que venda + itens são salvos juntos ou nenhum é salvo
  Future<void> createSaleAtomically({
    required Map<String, dynamic> saleData,
    required List<Map<String, dynamic>> saleItems,
  }) async {
    final db = await database;
    await db.transaction((txn) async {
      // 1. Inserir venda
      await txn.insert('sales', saleData,
          conflictAlgorithm: ConflictAlgorithm.replace);
      debugPrint('💾 [TX] Venda inserida: ${saleData['id']}');

      // 2. Inserir todos os itens
      for (final item in saleItems) {
        await txn.insert('sale_items', item,
            conflictAlgorithm: ConflictAlgorithm.replace);
      }
      debugPrint('💾 [TX] ${saleItems.length} itens inseridos');

      // 3. Adicionar à fila de sync (prioridade máxima)
      final syncQueueData = {
        'entity_type': 'sales',
        'entity_id': saleData['id'],
        'action': 'create',
        'data': jsonEncode(saleData),
        'priority': 1, // Prioridade máxima para vendas
        'created_at': DateTime.now().toIso8601String(),
        'status': 'pending',
      };
      await txn.insert('sync_queue', syncQueueData,
          conflictAlgorithm: ConflictAlgorithm.replace);
      debugPrint('💾 [TX] Venda adicionada à fila de sync');
    });

    debugPrint('✅ Venda criada atomicamente: ${saleData['id']}');
  }

  /// 🔴 CORREÇÃO CRÍTICA: Criar venda de mesa de forma ATÔMICA
  /// Inclui: venda + itens + table_payment + sync_queue (tudo na mesma transação)
  /// Isso garante que NENHUMA venda seja perdida, mesmo com crash ou perda de conexão
  Future<void> createTableSaleAtomically({
    required Map<String, dynamic> saleData,
    required List<Map<String, dynamic>> saleItems,
    Map<String, dynamic>? tablePaymentData,
  }) async {
    final db = await database;
    await db.transaction((txn) async {
      // 1. Inserir venda
      await txn.insert('sales', saleData,
          conflictAlgorithm: ConflictAlgorithm.replace);
      debugPrint('💾 [TX-MESA] Venda inserida: ${saleData['id']}');

      // 2. Inserir todos os itens
      for (final item in saleItems) {
        await txn.insert('sale_items', item,
            conflictAlgorithm: ConflictAlgorithm.replace);
      }
      debugPrint('💾 [TX-MESA] ${saleItems.length} itens inseridos');

      // 3. Inserir TablePayment se fornecido
      if (tablePaymentData != null) {
        await txn.insert('table_payments', tablePaymentData,
            conflictAlgorithm: ConflictAlgorithm.replace);
        debugPrint(
            '💾 [TX-MESA] TablePayment inserido: ${tablePaymentData['id']}');

        // Adicionar TablePayment à fila de sync
        final tpSyncData = {
          'entity_type': 'table_payments',
          'entity_id': tablePaymentData['id'],
          'action': 'create',
          'data': jsonEncode(tablePaymentData),
          'priority': 1, // Prioridade máxima
          'created_at': DateTime.now().toIso8601String(),
          'status': 'pending',
        };
        await txn.insert('sync_queue', tpSyncData,
            conflictAlgorithm: ConflictAlgorithm.replace);
        debugPrint('💾 [TX-MESA] TablePayment adicionado à fila de sync');
      }

      // 4. Adicionar venda à fila de sync (prioridade máxima)
      final syncQueueData = {
        'entity_type': 'sales',
        'entity_id': saleData['id'],
        'action': 'create',
        'data': jsonEncode(saleData), // 🔴 CRÍTICO: Salvar dados para retry
        'priority': 1, // Prioridade máxima para vendas
        'created_at': DateTime.now().toIso8601String(),
        'status': 'pending',
      };
      await txn.insert('sync_queue', syncQueueData,
          conflictAlgorithm: ConflictAlgorithm.replace);
      debugPrint('💾 [TX-MESA] Venda adicionada à fila de sync');
    });

    debugPrint('✅ Venda de mesa criada atomicamente: ${saleData['id']}');
  }

  // Métodos de sincronização
  Future<void> addToSyncQueue({
    required String entityType,
    required String entityId,
    required String action,
    required Map<String, dynamic> data,
    int priority = 10,
  }) async {
    // 🔴 VALIDAÇÃO CRÍTICA: entityId não pode ser vazio
    if (entityId.isEmpty) {
      debugPrint('❌ ERRO CRÍTICO: entityId vazio para $entityType/$action');
      debugPrint(
          '   Data: ${data.toString().substring(0, data.toString().length.clamp(0, 200))}');
      throw ArgumentError('entityId não pode ser vazio para sincronização');
    }

    // 🔴 VALIDAÇÃO: entityType também é obrigatório
    if (entityType.isEmpty) {
      debugPrint('❌ ERRO CRÍTICO: entityType vazio para $entityId/$action');
      throw ArgumentError('entityType não pode ser vazio para sincronização');
    }

    // Converter data para JSON string válido
    String dataJson;
    try {
      dataJson = jsonEncode(data);
      if (dataJson == '{}' || dataJson == 'null') {
        debugPrint(
            '⚠️ AVISO: data vazio para $entityType/$entityId - pode causar problemas de sync');
      }
    } catch (e) {
      debugPrint('❌ ERRO ao serializar data para sync: $e');
      // Tentar serialização mais segura
      final sanitizedData = <String, dynamic>{};
      data.forEach((key, value) {
        if (value is String || value is num || value is bool || value == null) {
          sanitizedData[key] = value;
        } else {
          sanitizedData[key] = value.toString();
        }
      });
      dataJson = jsonEncode(sanitizedData);
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

    debugPrint(
        '📤 Adicionado à fila: $entityType/$entityId ($action) priority=$priority');
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
    // 🔴 CORREÇÃO: max_attempts aumentado para 10, vendas nunca são abandonadas
    await rawUpdate('''
      UPDATE sync_queue 
      SET attempts = attempts + 1, 
          last_error = ?,
          status = CASE WHEN attempts >= 10 THEN 'failed' ELSE 'pending' END
      WHERE id = ?
    ''', [error, id]);
  }

  /// 🔴 CORREÇÃO CRÍTICA: Reprocessar vendas que falharam
  /// Vendas são muito importantes para serem abandonadas
  Future<void> retryFailedSalesSync() async {
    await rawUpdate('''
      UPDATE sync_queue 
      SET status = 'pending', attempts = 0 
      WHERE status = 'failed' AND entity_type = 'sales'
    ''');
  }

  /// Obter contagem de itens pendentes por tipo
  Future<Map<String, int>> getPendingSyncCounts() async {
    final result = await rawQuery('''
      SELECT entity_type, COUNT(*) as count 
      FROM sync_queue 
      WHERE status = 'pending' 
      GROUP BY entity_type
    ''');
    return Map.fromEntries(
      result
          .map((r) => MapEntry(r['entity_type'] as String, r['count'] as int)),
    );
  }

  /// Obter vendas não sincronizadas (crítico!)
  Future<List<Map<String, dynamic>>> getUnsyncedSales() async {
    return await query(
      'sales',
      where: 'synced = 0',
      orderBy: 'created_at ASC',
    );
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

  Future<void> remapTableSessionId({
    required String oldSessionId,
    required String newSessionId,
  }) async {
    if (oldSessionId == newSessionId) return;

    final db = await database;
    await db.transaction((txn) async {
      final existing = await txn.query(
        'table_sessions',
        columns: ['id'],
        where: 'id = ?',
        whereArgs: [newSessionId],
        limit: 1,
      );
      if (existing.isNotEmpty) {
        // Já existe sessão local com esse ID; não sobrescrever.
        return;
      }

      await txn.update(
        'table_customers',
        {'session_id': newSessionId},
        where: 'session_id = ?',
        whereArgs: [oldSessionId],
      );

      await txn.update(
        'table_orders',
        {'session_id': newSessionId},
        where: 'session_id = ?',
        whereArgs: [oldSessionId],
      );

      // Se existir tabela de pagamentos de mesa no SQLite, remapear também.
      try {
        await txn.update(
          'table_payments',
          {'session_id': newSessionId},
          where: 'session_id = ?',
          whereArgs: [oldSessionId],
        );
      } catch (_) {
        // tabela não existe neste build; ignorar
      }

      // Por último, trocar o ID da sessão.
      await txn.update(
        'table_sessions',
        {'id': newSessionId},
        where: 'id = ?',
        whereArgs: [oldSessionId],
      );
    });
  }

  // 🔴 CORREÇÃO: Criar backup local antes de operações destrutivas
  Future<String?> createLocalBackup() async {
    try {
      final db = await database;
      final dbPath = await getDatabasesPath();
      final sourceFile = File(join(dbPath, 'barmanager_vendas.db'));

      if (!await sourceFile.exists()) {
        debugPrint('⚠️ Arquivo de banco não encontrado para backup');
        return null;
      }

      // Criar diretório de backup
      final backupDir = Directory(join(dbPath, 'backups'));
      if (!await backupDir.exists()) {
        await backupDir.create(recursive: true);
      }

      // Nome do backup com timestamp
      final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-');
      final backupPath = join(backupDir.path, 'backup-$timestamp.db');

      // Fechar conexões antes de copiar
      await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');

      // Copiar arquivo
      await sourceFile.copy(backupPath);

      debugPrint('✅ Backup local criado: $backupPath');
      return backupPath;
    } catch (e) {
      debugPrint('❌ Erro ao criar backup local: $e');
      return null;
    }
  }

  // Limpar banco (para debug ou reset remoto)
  // 🔴 CORREÇÃO: Agora cria backup automático antes de limpar
  Future<void> clearAllData({bool createBackup = true}) async {
    if (createBackup) {
      debugPrint('📦 Criando backup de segurança antes de limpar dados...');
      final backupPath = await createLocalBackup();
      if (backupPath != null) {
        debugPrint('✅ Backup de segurança: $backupPath');
      } else {
        debugPrint('⚠️ Backup não foi criado, mas continuando com o reset...');
      }
    }

    final db = await database;
    await db.delete('sync_queue');
    await db.delete('payments');
    await db.delete('table_payments'); // Tabela de pagamentos de mesa
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
    // NÃO limpa 'users' para manter login ativo

    debugPrint('🗑️ Todos os dados locais foram limpos');
  }
}
