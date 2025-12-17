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

      // Sincronizar mesas e suas sessões ativas
      final tables = await _api.getTables();
      for (final table in tables) {
        await _upsertIfNotModified('tables', table);

        // Se a mesa veio com sessão ativa, sincronizar também
        if (table['currentSession'] != null) {
          await _upsertTableSession(table['currentSession']);
        }
      }

      // Tentar buscar overview para mesas com sessões completas
      try {
        // Usar o primeiro branchId disponível das mesas
        String? branchId;
        if (tables.isNotEmpty) {
          branchId = tables.first['branchId']?.toString() ??
              tables.first['branch_id']?.toString();
        }

        if (branchId != null) {
          final tablesOverview = await _api.getTablesOverview(branchId);
          for (final tableData in tablesOverview) {
            if (tableData['currentSession'] != null) {
              await _upsertTableSession(tableData['currentSession']);
            }
          }
        }
      } catch (e) {
        debugPrint('Aviso: Não foi possível buscar overview das mesas: $e');
      }
    } catch (e) {
      debugPrint('Erro ao baixar dados: $e');
    }
  }

  /// Sincroniza uma sessão de mesa e seus dados relacionados
  Future<void> _upsertTableSession(Map<String, dynamic> sessionData) async {
    final sessionId = sessionData['id']?.toString();
    if (sessionId == null) return;

    // Mapear e salvar sessão
    final mappedSession = {
      'id': sessionId,
      'table_id': sessionData['tableId'] ?? sessionData['table_id'],
      'branch_id': sessionData['branchId'] ?? sessionData['branch_id'],
      'session_number':
          sessionData['sessionNumber'] ?? sessionData['session_number'],
      'status': sessionData['status'] ?? 'open',
      'opened_by': sessionData['openedBy'] ?? sessionData['opened_by'],
      'closed_by': sessionData['closedBy'] ?? sessionData['closed_by'],
      'total_amount':
          sessionData['totalAmount'] ?? sessionData['total_amount'] ?? 0,
      'paid_amount':
          sessionData['paidAmount'] ?? sessionData['paid_amount'] ?? 0,
      'opened_at': sessionData['openedAt'] ?? sessionData['opened_at'],
      'closed_at': sessionData['closedAt'] ?? sessionData['closed_at'],
      'synced': 1,
    };

    await _upsertIfNotModified('table_sessions', mappedSession);

    // Sincronizar clientes da sessão
    final customers = sessionData['customers'] as List<dynamic>? ?? [];
    for (final customer in customers) {
      if (customer is! Map<String, dynamic>) continue;

      final mappedCustomer = {
        'id': customer['id'],
        'session_id': sessionId,
        'customer_id': customer['customerId'] ?? customer['customer_id'],
        'customer_name':
            customer['customerName'] ?? customer['customer_name'] ?? 'Cliente',
        'order_sequence':
            customer['orderSequence'] ?? customer['order_sequence'] ?? 0,
        'subtotal': customer['subtotal'] ?? 0,
        'total': customer['total'] ?? 0,
        'paid_amount': customer['paidAmount'] ?? customer['paid_amount'] ?? 0,
        'payment_status': customer['paymentStatus'] ??
            customer['payment_status'] ??
            'pending',
        'synced': 1,
      };

      await _upsertIfNotModified('table_customers', mappedCustomer);

      // Sincronizar pedidos do cliente
      final orders = customer['orders'] as List<dynamic>? ?? [];
      for (final order in orders) {
        if (order is! Map<String, dynamic>) continue;

        final mappedOrder = {
          'id': order['id'],
          'session_id': sessionId,
          'table_customer_id': customer['id'],
          'product_id': order['productId'] ?? order['product_id'],
          'qty_units': order['qtyUnits'] ?? order['qty_units'] ?? 1,
          'is_muntu':
              (order['isMuntu'] == true || order['is_muntu'] == 1) ? 1 : 0,
          'unit_price': order['unitPrice'] ?? order['unit_price'] ?? 0,
          'subtotal': order['subtotal'] ?? 0,
          'total': order['total'] ?? 0,
          'status': order['status'] ?? 'pending',
          'ordered_by': order['orderedBy'] ?? order['ordered_by'],
          'ordered_at': order['orderedAt'] ?? order['ordered_at'],
          'synced': 1,
        };

        await _upsertIfNotModified('table_orders', mappedOrder);
      }
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
      'table_sessions': {
        'id',
        'table_id',
        'branch_id',
        'session_number',
        'status',
        'opened_by',
        'closed_by',
        'total_amount',
        'paid_amount',
        'notes',
        'opened_at',
        'closed_at',
        'synced'
      },
      'table_customers': {
        'id',
        'session_id',
        'customer_id',
        'customer_name',
        'order_sequence',
        'subtotal',
        'total',
        'paid_amount',
        'payment_status',
        'created_at',
        'updated_at',
        'synced'
      },
      'table_orders': {
        'id',
        'session_id',
        'table_customer_id',
        'product_id',
        'qty_units',
        'is_muntu',
        'unit_price',
        'unit_cost',
        'subtotal',
        'total',
        'status',
        'notes',
        'ordered_by',
        'ordered_at',
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
      // Mapeamentos para mesas
      'tableId': 'table_id',
      'sessionId': 'session_id',
      'sessionNumber': 'session_number',
      'openedBy': 'opened_by',
      'closedBy': 'closed_by',
      'totalAmount': 'total_amount',
      'paidAmount': 'paid_amount',
      'openedAt': 'opened_at',
      'closedAt': 'closed_at',
      'customerId': 'customer_id',
      'customerName': 'customer_name',
      'orderSequence': 'order_sequence',
      'paymentStatus': 'payment_status',
      'tableCustomerId': 'table_customer_id',
      'isMuntu': 'is_muntu',
      'unitPrice': 'unit_price',
      'unitCost': 'unit_cost',
      'orderedBy': 'ordered_by',
      'orderedAt': 'ordered_at',
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
