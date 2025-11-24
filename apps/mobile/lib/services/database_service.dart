import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseService {
  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'barmanager.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Products
    await db.execute('''
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,
        categoryId TEXT,
        priceUnit REAL NOT NULL,
        priceBox REAL,
        unitsPerBox INTEGER,
        stock INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        syncStatus TEXT DEFAULT 'synced',
        updatedAt TEXT
      )
    ''');

    // Sales
    await db.execute('''
      CREATE TABLE sales (
        id TEXT PRIMARY KEY,
        saleNumber TEXT NOT NULL,
        branchId TEXT NOT NULL,
        userId TEXT NOT NULL,
        customerId TEXT,
        status TEXT DEFAULT 'open',
        subtotal REAL DEFAULT 0,
        taxTotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        muntuSavings REAL DEFAULT 0,
        syncStatus TEXT DEFAULT 'pending',
        createdAt TEXT,
        updatedAt TEXT
      )
    ''');

    // Sale Items
    await db.execute('''
      CREATE TABLE sale_items (
        id TEXT PRIMARY KEY,
        saleId TEXT NOT NULL,
        productId TEXT NOT NULL,
        productName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        qtyUnits INTEGER NOT NULL,
        unitPrice REAL NOT NULL,
        boxPrice REAL,
        subtotal REAL NOT NULL,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        muntuSavings REAL DEFAULT 0,
        syncStatus TEXT DEFAULT 'pending',
        FOREIGN KEY (saleId) REFERENCES sales (id)
      )
    ''');

    // Sync Queue
    await db.execute('''
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        createdAt TEXT
      )
    ''');
  }

  // Products
  Future<List<Map<String, dynamic>>> getProducts({String? search}) async {
    final db = await database;
    if (search != null && search.isNotEmpty) {
      return await db.query(
        'products',
        where: 'name LIKE ? AND isActive = 1',
        whereArgs: ['%$search%'],
        orderBy: 'name ASC',
      );
    }
    return await db.query(
      'products',
      where: 'isActive = 1',
      orderBy: 'name ASC',
    );
  }

  Future<int> insertProduct(Map<String, dynamic> product) async {
    final db = await database;
    return await db.insert('products', product,
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<int> updateProduct(String id, Map<String, dynamic> product) async {
    final db = await database;
    return await db.update('products', product, where: 'id = ?', whereArgs: [id]);
  }

  // Sales
  Future<List<Map<String, dynamic>>> getSales({String? status}) async {
    final db = await database;
    if (status != null) {
      return await db.query(
        'sales',
        where: 'status = ?',
        whereArgs: [status],
        orderBy: 'createdAt DESC',
      );
    }
    return await db.query('sales', orderBy: 'createdAt DESC', limit: 50);
  }

  Future<String> insertSale(Map<String, dynamic> sale) async {
    final db = await database;
    await db.insert('sales', sale);
    return sale['id'];
  }

  Future<int> updateSale(String id, Map<String, dynamic> sale) async {
    final db = await database;
    return await db.update('sales', sale, where: 'id = ?', whereArgs: [id]);
  }

  // Sale Items
  Future<List<Map<String, dynamic>>> getSaleItems(String saleId) async {
    final db = await database;
    return await db.query('sale_items', where: 'saleId = ?', whereArgs: [saleId]);
  }

  Future<void> insertSaleItem(Map<String, dynamic> item) async {
    final db = await database;
    await db.insert('sale_items', item);
  }

  Future<int> deleteSaleItem(String id) async {
    final db = await database;
    return await db.delete('sale_items', where: 'id = ?', whereArgs: [id]);
  }

  // Sync Queue
  Future<List<Map<String, dynamic>>> getPendingSync() async {
    final db = await database;
    return await db.query(
      'sync_queue',
      orderBy: 'createdAt ASC',
      limit: 50,
    );
  }

  Future<void> addToSyncQueue(Map<String, dynamic> item) async {
    final db = await database;
    await db.insert('sync_queue', item);
  }

  Future<int> removeSyncItem(String id) async {
    final db = await database;
    return await db.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  // Clear all data
  Future<void> clearDatabase() async {
    final db = await database;
    await db.delete('products');
    await db.delete('sales');
    await db.delete('sale_items');
    await db.delete('sync_queue');
  }
}
