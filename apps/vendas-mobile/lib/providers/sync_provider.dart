import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../services/database_service.dart';
import '../services/api_service.dart';

enum SyncStatus { idle, syncing, success, error, offline }

class SyncProvider extends ChangeNotifier {
  final DatabaseService _db = DatabaseService.instance;
  final ApiService _api = ApiService.instance;

  SyncStatus _status = SyncStatus.idle;
  bool _isOnline = true;
  String? _lastError;
  DateTime? _lastSyncTime;
  int _pendingChanges = 0;
  Timer? _autoSyncTimer;
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;

  // Getters
  SyncStatus get status => _status;
  bool get isOnline => _isOnline;
  bool get isSyncing => _status == SyncStatus.syncing;
  String? get lastError => _lastError;
  DateTime? get lastSyncTime => _lastSyncTime;
  int get pendingChanges => _pendingChanges;
  bool get hasPendingChanges => _pendingChanges > 0;

  SyncProvider() {
    _initConnectivity();
    _startAutoSync();
  }

  /// Inicializa monitoramento de conectividade
  void _initConnectivity() {
    _connectivitySubscription = Connectivity()
        .onConnectivityChanged
        .listen((ConnectivityResult result) {
      final wasOffline = !_isOnline;
      _isOnline = result != ConnectivityResult.none;

      notifyListeners();

      // Sincronizar automaticamente quando voltar online
      if (wasOffline && _isOnline) {
        syncAll();
      }
    });

    // Verificar status inicial
    _checkInitialConnectivity();
  }

  Future<void> _checkInitialConnectivity() async {
    final result = await Connectivity().checkConnectivity();
    _isOnline = result != ConnectivityResult.none;
    notifyListeners();
  }

  /// Inicia timer de sincronização automática
  void _startAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _autoSyncTick(),
    );
  }

  void _autoSyncTick() async {
    if (_isOnline && _status != SyncStatus.syncing) {
      await _updatePendingCount();
      if (_pendingChanges > 0) {
        await syncAll();
      }
    }
  }

  /// Atualiza contagem de mudanças pendentes
  Future<void> _updatePendingCount() async {
    try {
      final queue = await _db.getSyncQueue();
      _pendingChanges = queue.length;
      notifyListeners();
    } catch (e) {
      debugPrint('Erro ao contar pendências: $e');
    }
  }

  /// Sincroniza todos os dados
  Future<bool> syncAll() async {
    if (_status == SyncStatus.syncing) return false;
    if (!_isOnline) {
      _status = SyncStatus.offline;
      notifyListeners();
      return false;
    }

    _status = SyncStatus.syncing;
    _lastError = null;
    notifyListeners();

    try {
      // 1. Enviar mudanças locais
      await _pushLocalChanges();

      // 2. Baixar dados do servidor
      await _pullServerData();

      _status = SyncStatus.success;
      _lastSyncTime = DateTime.now();
      await _updatePendingCount();
      notifyListeners();
      return true;
    } catch (e) {
      _status = SyncStatus.error;
      _lastError = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Envia mudanças locais para o servidor
  Future<void> _pushLocalChanges() async {
    final queue = await _db.getSyncQueue();

    for (final item in queue) {
      try {
        final tableName = item['entity_type'] as String? ?? '';
        final operation = item['action'] as String? ?? '';
        final recordId = item['entity_id'] as String? ?? '';

        if (tableName.isEmpty || recordId.isEmpty) continue;

        switch (operation) {
          case 'INSERT':
          case 'UPDATE':
            await _syncRecord(tableName, recordId);
            break;
          case 'DELETE':
            await _deleteRecord(tableName, recordId);
            break;
        }

        // Remover da fila após sucesso
        final itemId = item['id'];
        if (itemId is int) {
          await _db.removeSyncQueueItem(itemId);
        }
      } catch (e) {
        debugPrint('Erro ao sincronizar item: $e');
        // Continuar com próximo item
      }
    }
  }

  /// Sincroniza um registro específico
  Future<void> _syncRecord(String tableName, String recordId) async {
    final record = await _db.getById(tableName, recordId);
    if (record == null) return;

    // Remover campos de controle local
    final data = Map<String, dynamic>.from(record);
    data.remove('synced');
    data.remove('local_id');

    // Marcar como sincronizado
    await _db.markAsSynced(tableName, recordId);
  }

  /// Deleta um registro no servidor
  Future<void> _deleteRecord(String tableName, String recordId) async {
    // Implementar delete via API específica
    debugPrint('Delete $tableName/$recordId');
  }

  /// Baixa dados do servidor
  Future<void> _pullServerData() async {
    try {
      // Sincronizar categorias
      final categories = await _api.getCategories();
      for (final cat in categories) {
        await _upsertIfNotModified('categories', cat);
      }

      // Sincronizar produtos
      final products = await _api.getProducts();
      for (final prod in products) {
        await _upsertIfNotModified('products', prod);
      }

      // Sincronizar clientes
      final customers = await _api.getCustomers();
      for (final cust in customers) {
        await _upsertIfNotModified('customers', cust);
      }

      // Sincronizar mesas
      final tables = await _api.getTables();
      for (final table in tables) {
        await _upsertIfNotModified('tables', table);
      }
    } catch (e) {
      debugPrint('Erro ao baixar dados: $e');
    }
  }

  /// Insere/atualiza apenas se não foi modificado localmente
  Future<void> _upsertIfNotModified(
      String tableName, Map<String, dynamic> data) async {
    final id = data['id']?.toString();
    if (id == null) return;

    // Filtrar campos para corresponder ao schema do banco local
    final filteredData = _filterFieldsForTable(tableName, data);

    final existing = await _db.getById(tableName, id);

    if (existing == null) {
      // Não existe, inserir
      filteredData['synced'] = 1;
      try {
        await _db.insert(tableName, filteredData);
      } catch (e) {
        debugPrint('Erro ao inserir $tableName: $e');
      }
    } else {
      // Existe - verificar se tem mudanças locais não sincronizadas
      final synced = existing['synced'] as int? ?? 1;
      if (synced == 1) {
        // Sem mudanças locais, pode atualizar
        filteredData['synced'] = 1;
        try {
          await _db.update(tableName, filteredData,
              where: 'id = ?', whereArgs: [id]);
        } catch (e) {
          debugPrint('Erro ao atualizar $tableName: $e');
        }
      }
      // Se synced == 0, manter versão local
    }
  }

  /// Filtra campos para corresponder ao schema do banco local
  Map<String, dynamic> _filterFieldsForTable(
      String tableName, Map<String, dynamic> data) {
    // Campos permitidos por tabela (baseado no schema do database_service.dart)
    // IMPORTANTE: Só incluir campos que EXISTEM no banco SQLite local
    final allowedFields = {
      'categories': {
        'id', 'name', 'description', 'color', 'is_active', 'created_at',
        'updated_at', 'synced'
        // NÃO incluir: name_kriol, name_fr, parent_id, sort_order (não existem no schema local)
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
        'total_purchases',
        'is_active',
        'created_at',
        'updated_at',
        'synced'
      },
      'tables': {
        'id',
        'number',
        'name',
        'capacity',
        'status',
        'branch_id',
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

    final fields = allowedFields[tableName];
    if (fields == null) return Map<String, dynamic>.from(data);

    final filtered = <String, dynamic>{};

    // Mapeamento de nomes de campos (camelCase -> snake_case)
    final fieldMappings = {
      'categoryId': 'category_id',
      'priceUnit': 'price_unit',
      'priceBox': 'price_box',
      'costUnit': 'cost_unit',
      'costBox': 'cost_box',
      'unitsPerBox': 'units_per_box',
      'isMuntuEligible': 'is_muntu_eligible',
      'muntuQuantity': 'muntu_quantity',
      'muntuPrice': 'muntu_price',
      'isActive': 'is_active',
      'imageUrl': 'image_url',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'creditLimit': 'credit_limit',
      'currentDebt': 'current_debt',
      'totalPurchases': 'total_purchases',
      'branchId': 'branch_id',
      'productId': 'product_id',
      'qtyUnits': 'qty_units',
      'lowStockAlert': 'low_stock_alert',
      'batchNumber': 'batch_number',
      'expiryDate': 'expiry_date',
    };

    for (final entry in data.entries) {
      var key = entry.key;
      // Converter camelCase para snake_case se necessário
      if (fieldMappings.containsKey(key)) {
        key = fieldMappings[key]!;
      }
      // Só adicionar se o campo é permitido
      if (fields.contains(key)) {
        filtered[key] = entry.value;
      }
    }

    return filtered;
  }

  /// Força sincronização imediata
  Future<void> forceSync() async {
    await syncAll();
  }

  /// Adiciona item à fila de sincronização
  Future<void> queueSync(
      String tableName, String operation, String recordId) async {
    await _db.addToSyncQueue(
      entityType: tableName,
      entityId: recordId,
      action: operation,
      data: {},
    );
    await _updatePendingCount();
  }

  @override
  void dispose() {
    _autoSyncTimer?.cancel();
    _connectivitySubscription?.cancel();
    super.dispose();
  }
}
