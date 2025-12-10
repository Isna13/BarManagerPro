import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'database_service.dart';
import '../config/app_config.dart';

class SyncService {
  static final SyncService instance = SyncService._init();

  final DatabaseService _db = DatabaseService.instance;
  final ApiService _api = ApiService.instance;

  bool _isSyncing = false;
  bool _isOnline = true;
  Timer? _syncTimer;
  StreamSubscription? _connectivitySubscription;

  final _syncStatusController = StreamController<SyncStatus>.broadcast();
  Stream<SyncStatus> get syncStatusStream => _syncStatusController.stream;

  SyncService._init();

  Future<void> init() async {
    // Verificar conectividade inicial
    final connectivity = await Connectivity().checkConnectivity();
    _isOnline = connectivity != ConnectivityResult.none;

    // Ouvir mudanças de conectividade
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen((ConnectivityResult result) {
      final wasOnline = _isOnline;
      _isOnline = result != ConnectivityResult.none;

      if (!wasOnline && _isOnline) {
        // Voltou a ficar online - sincronizar imediatamente
        syncAll();
      }
    });

    // Iniciar timer de sincronização periódica
    _startPeriodicSync();
  }

  void _startPeriodicSync() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(
      Duration(seconds: AppConfig.syncIntervalSeconds),
      (_) => syncAll(),
    );
  }

  void dispose() {
    _syncTimer?.cancel();
    _connectivitySubscription?.cancel();
    _syncStatusController.close();
  }

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;

  // Sincronizar tudo
  Future<void> syncAll() async {
    if (_isSyncing || !_isOnline) return;

    _isSyncing = true;
    _syncStatusController
        .add(SyncStatus(isSyncing: true, message: 'Sincronizando...'));

    try {
      // 1. Primeiro, enviar dados locais pendentes
      await _uploadPendingChanges();

      // 2. Baixar dados do servidor
      await _downloadServerData();

      // Atualizar última sincronização
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('last_sync', DateTime.now().toIso8601String());

      _syncStatusController.add(
          SyncStatus(isSyncing: false, message: 'Sincronizado', success: true));
    } catch (e) {
      _syncStatusController.add(
          SyncStatus(isSyncing: false, message: 'Erro: $e', success: false));
    } finally {
      _isSyncing = false;
    }
  }

  // Enviar mudanças locais para o servidor
  Future<void> _uploadPendingChanges() async {
    final pendingItems = await _db.getPendingSyncItems();

    for (final item in pendingItems) {
      try {
        final entityType = item['entity_type'] as String;
        final entityId = item['entity_id'] as String;
        final action = item['action'] as String;

        // Buscar dados atuais da entidade local
        final entityData = await _getLocalEntity(entityType, entityId);
        if (entityData == null && action != 'delete') continue;

        // Enviar para o servidor baseado no tipo de ação
        await _sendToServer(entityType, action, entityData ?? {'id': entityId});

        // Marcar como processado
        await _db.markSyncItemProcessed(item['id'] as int);
      } catch (e) {
        await _db.markSyncItemFailed(item['id'] as int, e.toString());
      }
    }
  }

  Future<Map<String, dynamic>?> _getLocalEntity(
      String entityType, String entityId) async {
    final results = await _db.query(
      entityType,
      where: 'id = ?',
      whereArgs: [entityId],
    );
    return results.isNotEmpty ? results.first : null;
  }

  Future<void> _sendToServer(
      String entityType, String action, Map<String, dynamic> data) async {
    // Implementar envio baseado no tipo de entidade e ação
    // Por enquanto, apenas marcamos como sincronizado localmente
    switch (entityType) {
      case 'sales':
        if (action == 'create') {
          await _api.createSale(data);
        }
        break;
      // Adicionar outros casos conforme necessário
    }
  }

  // Baixar dados do servidor
  Future<void> _downloadServerData() async {
    try {
      // Baixar categorias
      final categories = await _api.getCategories();
      await _mergeData('categories', categories);

      // Baixar produtos
      final products = await _api.getProducts();
      await _mergeData('products', products);

      // Baixar clientes
      final customers = await _api.getCustomers();
      await _mergeData('customers', customers);

      // Baixar estoque
      final inventory = await _api.getInventory();
      await _mergeData('inventory', inventory);

      // Baixar mesas
      final tables = await _api.getTables();
      await _mergeData('tables', tables);

      // Baixar caixa atual
      final currentCashBox = await _api.getCurrentCashBox();
      if (currentCashBox != null) {
        await _mergeCashBox(currentCashBox);
      }

      // Baixar histórico de caixas
      final cashBoxHistory = await _api.getCashBoxHistory(limit: 50);
      for (final cashBox in cashBoxHistory) {
        if (cashBox is Map<String, dynamic>) {
          await _mergeCashBox(cashBox);
        }
      }
    } catch (e) {
      print('Erro ao baixar dados: $e');
      rethrow;
    }
  }

  // Mesclar dados do caixa do servidor com local
  Future<void> _mergeCashBox(Map<String, dynamic> serverCashBox) async {
    final id = serverCashBox['id'] as String?;
    if (id == null) return;

    final localItems =
        await _db.query('cash_boxes', where: 'id = ?', whereArgs: [id]);
    final mappedData = _mapCashBoxToLocal(serverCashBox);
    mappedData['synced'] = 1;

    if (localItems.isEmpty) {
      await _db.insert('cash_boxes', mappedData);
    } else {
      final localItem = localItems.first;
      final localSynced = localItem['synced'] as int? ?? 0;
      if (localSynced == 1) {
        await _db
            .update('cash_boxes', mappedData, where: 'id = ?', whereArgs: [id]);
      }
    }
  }

  // Mapear dados do caixa do servidor para o formato local
  Map<String, dynamic> _mapCashBoxToLocal(Map<String, dynamic> serverData) {
    // Os totais podem vir diretamente ou dentro do objeto 'stats'
    final stats = serverData['stats'] as Map<String, dynamic>? ?? {};

    return {
      'id': serverData['id'],
      'box_number': serverData['boxNumber'] ?? serverData['box_number'],
      'branch_id': serverData['branchId'] ?? serverData['branch_id'],
      'opened_by': serverData['openedBy'] ?? serverData['opened_by'],
      'closed_by': serverData['closedBy'] ?? serverData['closed_by'],
      'status': serverData['status'],
      'opening_cash':
          serverData['openingCash'] ?? serverData['opening_cash'] ?? 0,
      'total_sales': serverData['totalSales'] ??
          serverData['total_sales'] ??
          stats['totalSales'] ??
          0,
      'total_cash': serverData['totalCash'] ??
          serverData['total_cash'] ??
          stats['cashPayments'] ??
          0,
      'total_card': serverData['totalCard'] ??
          serverData['total_card'] ??
          stats['cardPayments'] ??
          0,
      'total_mobile_money': serverData['totalMobileMoney'] ??
          serverData['total_mobile_money'] ??
          stats['mobileMoneyPayments'] ??
          0,
      'total_debt': serverData['totalDebt'] ??
          serverData['total_debt'] ??
          stats['debtPayments'] ??
          0,
      'closing_cash': serverData['closingCash'] ?? serverData['closing_cash'],
      'difference': serverData['difference'],
      'notes': serverData['notes'],
      'opened_at': serverData['openedAt'] ?? serverData['opened_at'],
      'closed_at': serverData['closedAt'] ?? serverData['closed_at'],
    };
  }

  // Mesclar dados do servidor com locais (preservando mudanças não sincronizadas)
  Future<void> _mergeData(String table, List<dynamic> serverData) async {
    for (final item in serverData) {
      if (item is! Map<String, dynamic>) continue;

      final id = item['id'] as String?;
      if (id == null) continue;

      // Verificar se existe local e se está pendente de sincronização
      final localItems =
          await _db.query(table, where: 'id = ?', whereArgs: [id]);

      if (localItems.isEmpty) {
        // Não existe localmente - inserir
        final mappedData = _mapServerToLocal(table, item);
        mappedData['synced'] = 1;
        await _db.insert(table, mappedData);
      } else {
        final localItem = localItems.first;
        final localSynced = localItem['synced'] as int? ?? 0;

        // Se item local está sincronizado, podemos sobrescrever
        if (localSynced == 1) {
          final mappedData = _mapServerToLocal(table, item);
          mappedData['synced'] = 1;
          await _db.update(table, mappedData, where: 'id = ?', whereArgs: [id]);
        }
        // Se não está sincronizado, manter versão local
      }
    }
  }

  // Mapear dados do servidor para formato local (com filtragem de campos)
  Map<String, dynamic> _mapServerToLocal(
      String table, Map<String, dynamic> serverData) {
    // Campos permitidos por tabela (baseado no schema do database_service.dart)
    final allowedFields = {
      'categories': {
        'id',
        'name',
        'description',
        'color',
        'is_active',
        'created_at',
        'updated_at',
        'synced'
      },
      'products': {
        'id',
        'name',
        'sku',
        'category_id',
        'price_unit',
        'price_box',
        'cost_unit',
        'cost_box',
        'units_per_box',
        'is_muntu_eligible',
        'muntu_quantity',
        'muntu_price',
        'is_active',
        'barcode',
        'image_url',
        'created_at',
        'updated_at',
        'synced'
      },
      'customers': {
        'id',
        'name',
        'phone',
        'email',
        'address',
        'credit_limit',
        'current_debt',
        'loyalty_points',
        'is_active',
        'created_at',
        'updated_at',
        'synced'
      },
      'tables': {
        'id',
        'branch_id',
        'number',
        'seats',
        'area',
        'status',
        'is_active',
        'created_at',
        'updated_at',
        'synced'
      },
      'inventory': {
        'id',
        'product_id',
        'branch_id',
        'qty_units',
        'low_stock_alert',
        'batch_number',
        'expiry_date',
        'created_at',
        'updated_at',
        'synced'
      },
    };

    final fields = allowedFields[table];
    final mapped = <String, dynamic>{};

    serverData.forEach((key, value) {
      final snakeKey = _camelToSnake(key);

      // Só adicionar se o campo é permitido para esta tabela
      if (fields == null || fields.contains(snakeKey)) {
        // Converter booleanos para int
        if (value is bool) {
          mapped[snakeKey] = value ? 1 : 0;
        } else if (value is DateTime) {
          mapped[snakeKey] = value.toIso8601String();
        } else {
          mapped[snakeKey] = value;
        }
      }
    });

    return mapped;
  }

  String _camelToSnake(String camelCase) {
    return camelCase.replaceAllMapped(
      RegExp(r'[A-Z]'),
      (match) => '_${match.group(0)!.toLowerCase()}',
    );
  }

  // Marcar item para sincronização
  Future<void> markForSync({
    required String entityType,
    required String entityId,
    required String action,
    Map<String, dynamic>? data,
  }) async {
    await _db.addToSyncQueue(
      entityType: entityType,
      entityId: entityId,
      action: action,
      data: data ?? {},
    );

    // Tentar sincronizar imediatamente se online
    if (_isOnline) {
      syncAll();
    }
  }

  // Obter data da última sincronização
  Future<DateTime?> getLastSyncTime() async {
    final prefs = await SharedPreferences.getInstance();
    final lastSync = prefs.getString('last_sync');
    return lastSync != null ? DateTime.tryParse(lastSync) : null;
  }
}

class SyncStatus {
  final bool isSyncing;
  final String message;
  final bool? success;

  SyncStatus({
    required this.isSyncing,
    required this.message,
    this.success,
  });
}
