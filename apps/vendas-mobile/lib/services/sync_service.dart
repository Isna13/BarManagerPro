import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'database_service.dart';
import '../config/app_config.dart';
import '../config/payment_methods.dart';

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
    if (_isSyncing) {
      debugPrint('⚠️ Sincronização já em andamento, ignorando...');
      return;
    }
    if (!_isOnline) {
      debugPrint('📴 Offline, sincronização adiada');
      return;
    }

    debugPrint('🔄 Iniciando sincronização completa...');
    _isSyncing = true;
    _syncStatusController
        .add(SyncStatus(isSyncing: true, message: 'Sincronizando...'));

    try {
      // 1. Primeiro, enviar dados locais pendentes
      debugPrint('📤 Etapa 1: Enviando dados pendentes...');
      await _uploadPendingChanges();

      // 2. Baixar dados do servidor
      debugPrint('📥 Etapa 2: Baixando dados do servidor...');
      await _downloadServerData();

      // Atualizar última sincronização
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('last_sync', DateTime.now().toIso8601String());

      debugPrint('✅ Sincronização completa!');
      _syncStatusController.add(
          SyncStatus(isSyncing: false, message: 'Sincronizado', success: true));
    } catch (e) {
      debugPrint('❌ Erro na sincronização: $e');
      _syncStatusController.add(
          SyncStatus(isSyncing: false, message: 'Erro: $e', success: false));
    } finally {
      _isSyncing = false;
    }
  }

  // Enviar mudanças locais para o servidor
  Future<void> _uploadPendingChanges() async {
    final pendingItems = await _db.getPendingSyncItems();
    debugPrint('🔄 Itens pendentes para sincronização: ${pendingItems.length}');

    for (final item in pendingItems) {
      final entityType = item['entity_type'] as String;
      final entityId = item['entity_id'] as String;
      final action = item['action'] as String;

      try {
        debugPrint('📤 Sincronizando: $entityType/$entityId ($action)');

        // Dados salvos no sync_queue (para ajustes de estoque, etc)
        Map<String, dynamic>? syncData;
        final syncDataStr = item['data'] as String?;
        if (syncDataStr != null &&
            syncDataStr.isNotEmpty &&
            syncDataStr != '{}') {
          try {
            syncData = Map<String, dynamic>.from(jsonDecode(syncDataStr));
          } catch (_) {}
        }

        // Para ajustes de estoque, usar dados do sync_queue
        if (entityType == 'inventory' &&
            action == 'adjust' &&
            syncData != null) {
          await _sendToServer(entityType, action, syncData);
          await _db.markSyncItemProcessed(item['id'] as int);
          continue;
        }

        // Buscar dados atuais da entidade local
        final entityData = await _getLocalEntity(entityType, entityId);
        if (entityData == null && action != 'delete') {
          debugPrint('⚠️ Entidade não encontrada: $entityType/$entityId');
          await _db.markSyncItemProcessed(item['id'] as int);
          continue;
        }

        // Enviar para o servidor baseado no tipo de ação
        await _sendToServer(entityType, action, entityData ?? {'id': entityId});

        // Marcar entidade como sincronizada no banco local
        if (entityType == 'sales') {
          await _db.update(
            'sales',
            {'synced': 1},
            where: 'id = ?',
            whereArgs: [entityId],
          );
          debugPrint('✅ Venda marcada como sincronizada: $entityId');
        }

        // Marcar item da fila como processado
        await _db.markSyncItemProcessed(item['id'] as int);
      } catch (e) {
        debugPrint('❌ Erro ao sincronizar $entityType/$entityId: $e');
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
    switch (entityType) {
      case 'sales':
        if (action == 'create') {
          // Mapear dados da venda para formato do servidor (camelCase)
          final saleData = _mapSaleToServer(data);
          debugPrint('📤 Enviando venda para servidor: $saleData');

          try {
            await _api.createSale(saleData);
            debugPrint('✅ Venda criada no servidor: ${data['id']}');
          } catch (e) {
            debugPrint('❌ Erro ao criar venda no servidor: $e');
            rethrow;
          }

          // Buscar e enviar itens da venda
          final saleItems = await _db.query(
            'sale_items',
            where: 'sale_id = ?',
            whereArgs: [data['id']],
          );

          debugPrint('📦 Enviando ${saleItems.length} itens da venda');

          for (final item in saleItems) {
            try {
              await _api.addSaleItem(data['id'], {
                'productId': item['product_id'],
                'qtyUnits': item['qty_units'],
                'isMuntu': item['is_muntu'] == 1,
              });
              debugPrint('✅ Item adicionado: ${item['product_id']}');
            } catch (e) {
              debugPrint('Erro ao sincronizar item: $e');
            }
          }

          // Processar pagamento - VALE também precisa de Payment para sincronização correta
          // VALE tem payment_status='pending' mas precisa de registro de Payment
          final paymentMethod = data['payment_method'];
          final shouldCreatePayment = paymentMethod != null &&
              (data['payment_status'] == 'paid' ||
                  paymentMethod.toString().toUpperCase() == 'VALE');

          if (shouldCreatePayment) {
            try {
              await _api.addSalePayment(data['id'], {
                'method': _mapPaymentMethod(paymentMethod),
                'amount': data['total'] ?? 0,
              });
              debugPrint('✅ Pagamento sincronizado: $paymentMethod');
            } catch (e) {
              debugPrint('Erro ao sincronizar pagamento: $e');
            }
          }

          // Fechar a venda se está completada
          if (data['status'] == 'completed') {
            try {
              // Chamamos diretamente o endpoint de fechar
              await _api.closeSale(data['id']);
            } catch (e) {
              debugPrint('Erro ao fechar venda: $e');
            }
          }
        }
        break;

      case 'inventory':
        if (action == 'adjust') {
          // Sincronizar ajuste de estoque
          final productId = data['productId'];
          final branchId = data['branchId'];
          final adjustment = data['adjustment'] ?? 0;

          if (productId != null && branchId != null && adjustment != 0) {
            debugPrint(
                '═══════════════════════════════════════════════════════');
            debugPrint('📤 ENVIANDO AJUSTE DE ESTOQUE PARA SERVIDOR');
            debugPrint('   Product ID: $productId');
            debugPrint('   Branch ID: $branchId');
            debugPrint('   Adjustment: $adjustment');
            debugPrint(
                '═══════════════════════════════════════════════════════');

            await _api.adjustStockByProduct(
              productId: productId,
              branchId: branchId,
              adjustment: adjustment,
              reason: data['reason'] ?? 'Venda mobile',
            );

            debugPrint('✅ AJUSTE ENVIADO COM SUCESSO!');

            // Marcar inventário como sincronizado
            await _db.update(
              'inventory',
              {'synced': 1},
              where: 'product_id = ?',
              whereArgs: [productId],
            );
            debugPrint('📝 Inventário marcado como synced=1');
          }
        } else if (action == 'update') {
          debugPrint('📦 Sincronizando estoque (update): ${data['id']}');
        }
        break;

      case 'cash_boxes':
        if (action == 'create' || action == 'update') {
          debugPrint('📦 Sincronizando caixa: ${data['id']}');
        }
        break;

      // ==================== ENTIDADES DE MESAS ====================
      case 'tables':
        if (action == 'create') {
          debugPrint('📋 Sincronizando mesa: ${data['id']}');
          await _api.createTable(
            branchId: data['branch_id'] ?? data['branchId'] ?? '',
            number: data['number']?.toString() ?? '',
            seats: data['seats'] ?? 4,
            area: data['area'],
          );
          debugPrint('✅ Mesa sincronizada: ${data['id']}');

          // Marcar mesa como sincronizada
          await _db.update(
            'tables',
            {'synced': 1},
            where: 'id = ?',
            whereArgs: [data['id']],
          );
        } else if (action == 'update') {
          debugPrint('📋 Atualizando mesa: ${data['id']}');
          await _api.updateTable(
            id: data['id'],
            status: data['status'],
            seats: data['seats'],
            area: data['area'],
            isActive: data['is_active'] == 1,
          );
          debugPrint('✅ Mesa atualizada: ${data['id']}');
        }
        break;

      case 'table_sessions':
        if (action == 'create') {
          debugPrint('📋 Sincronizando sessão de mesa: ${data['id']}');
          await _api.openTable(
            tableId: data['table_id'] ?? data['tableId'] ?? '',
            branchId: data['branch_id'] ?? data['branchId'] ?? '',
            openedBy: data['opened_by'] ?? data['openedBy'] ?? 'mobile',
          );
          debugPrint('✅ Sessão de mesa sincronizada: ${data['id']}');

          // Marcar sessão como sincronizada
          await _db.update(
            'table_sessions',
            {'synced': 1},
            where: 'id = ?',
            whereArgs: [data['id']],
          );
        } else if (action == 'update' &&
            (data['status'] == 'closed' || data['closed_by'] != null)) {
          debugPrint('📋 Fechando sessão de mesa: ${data['id']}');
          await _api.closeTableSession(
            sessionId: data['id'],
            closedBy: data['closed_by'] ?? data['closedBy'] ?? 'mobile',
          );
          debugPrint('✅ Sessão de mesa fechada: ${data['id']}');
        }
        break;

      case 'table_customers':
        if (action == 'create') {
          debugPrint('📋 Sincronizando cliente de mesa: ${data['id']}');
          await _api.addCustomerToTable(
            sessionId: data['session_id'] ?? data['sessionId'] ?? '',
            customerName:
                data['customer_name'] ?? data['customerName'] ?? 'Cliente',
            customerId: data['customer_id'] ?? data['customerId'],
            addedBy: data['added_by'] ?? data['addedBy'] ?? 'mobile',
          );
          debugPrint('✅ Cliente de mesa sincronizado: ${data['id']}');

          // Marcar cliente como sincronizado
          await _db.update(
            'table_customers',
            {'synced': 1},
            where: 'id = ?',
            whereArgs: [data['id']],
          );
        }
        break;

      case 'table_orders':
        if (action == 'create') {
          debugPrint('📋 Sincronizando pedido de mesa: ${data['id']}');
          await _api.addOrderToTable(
            sessionId: data['session_id'] ?? data['sessionId'] ?? '',
            tableCustomerId:
                data['table_customer_id'] ?? data['tableCustomerId'] ?? '',
            productId: data['product_id'] ?? data['productId'] ?? '',
            qtyUnits: data['qty_units'] ?? data['qtyUnits'] ?? 1,
            isMuntu: (data['is_muntu'] == 1 || data['isMuntu'] == true),
            orderedBy: data['ordered_by'] ?? data['orderedBy'] ?? 'mobile',
          );
          debugPrint('✅ Pedido de mesa sincronizado: ${data['id']}');

          // Marcar pedido como sincronizado
          await _db.update(
            'table_orders',
            {'synced': 1},
            where: 'id = ?',
            whereArgs: [data['id']],
          );
        } else if (action == 'update' && data['status'] == 'cancelled') {
          debugPrint('📋 Cancelando pedido de mesa: ${data['id']}');
          await _api.cancelTableOrder(
            orderId: data['id'],
            cancelledBy: data['cancelled_by'] ?? 'mobile',
          );
          debugPrint('✅ Pedido de mesa cancelado: ${data['id']}');
        }
        break;

      case 'table_payments':
        if (action == 'create') {
          debugPrint('📋 Sincronizando pagamento de mesa: ${data['id']}');
          await _api.processTablePayment(
            sessionId: data['session_id'] ?? data['sessionId'] ?? '',
            tableCustomerId:
                data['table_customer_id'] ?? data['tableCustomerId'],
            method: data['method'] ?? 'CASH',
            amount: data['amount'] ?? 0,
            processedBy:
                data['processed_by'] ?? data['processedBy'] ?? 'mobile',
            isSessionPayment: data['is_session_payment'] == 1 ||
                data['isSessionPayment'] == true,
          );
          debugPrint('✅ Pagamento de mesa sincronizado: ${data['id']}');
        }
        break;
    }
  }

  /// Mapeia dados da venda local para formato do servidor
  Map<String, dynamic> _mapSaleToServer(Map<String, dynamic> data) {
    // Obter método de pagamento de forma robusta
    final rawPaymentMethod = data['payment_method'] ?? data['paymentMethod'];
    String? normalizedPaymentMethod;

    if (rawPaymentMethod != null && rawPaymentMethod.toString().isNotEmpty) {
      try {
        normalizedPaymentMethod =
            PaymentMethod.normalize(rawPaymentMethod.toString());
        debugPrint(
            '✅ Método de pagamento normalizado: $rawPaymentMethod -> $normalizedPaymentMethod');
      } catch (e) {
        debugPrint(
            '⚠️ Erro ao normalizar método de pagamento: $rawPaymentMethod - $e');
        // NÃO usar fallback - deixar null para que o servidor rejeite
        normalizedPaymentMethod = null;
      }
    }

    return {
      'id': data['id'],
      'branchId': data['branch_id'] ?? data['branchId'],
      'cashierId': data['cashier_id'] ?? data['cashierId'],
      'type': data['type'] ?? 'counter',
      'customerId': data['customer_id'] ?? data['customerId'],
      'saleNumber': data['sale_number'] ?? data['saleNumber'],
      'subtotal': data['subtotal'],
      'total': data['total'],
      'status': data['status'],
      'paymentMethod': normalizedPaymentMethod, // Método normalizado
      'paymentStatus':
          data['payment_status'] ?? data['paymentStatus'] ?? 'paid',
      'notes': data['notes'],
    };
  }

  /// Mapeia método de pagamento local para formato do servidor
  /// NUNCA retorna valor padrão - lança exceção se inválido
  String _mapPaymentMethod(String method) {
    return PaymentMethod.normalize(method);
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
      debugPrint('🍽️ SyncService: Baixando mesas...');
      final tables = await _api.getTables();
      debugPrint('🍽️ SyncService: Mesas recebidas: ${tables.length}');
      await _mergeData('tables', tables);
      debugPrint('🍽️ SyncService: Mesas mescladas no banco local');

      // Baixar mesas com sessões ativas (overview)
      try {
        // Usar o primeiro branchId disponível das mesas
        String? branchId;
        if (tables.isNotEmpty) {
          branchId = (tables.first['branchId'] ?? tables.first['branch_id'])
              ?.toString();
        }

        if (branchId != null) {
          final tablesOverview = await _api.getTablesOverview(branchId);
          for (final tableData in tablesOverview) {
            if (tableData is Map<String, dynamic> &&
                tableData['currentSession'] != null) {
              await _mergeTableSession(tableData['currentSession']);
            }
          }
        }
      } catch (e) {
        debugPrint('Aviso: Não foi possível buscar sessões ativas: $e');
      }

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

  // Mesclar sessão de mesa do servidor com local
  Future<void> _mergeTableSession(Map<String, dynamic> sessionData) async {
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

    final existingSessions = await _db.query(
      'table_sessions',
      where: 'id = ?',
      whereArgs: [sessionId],
    );

    if (existingSessions.isEmpty) {
      await _db.insert('table_sessions', mappedSession);
    } else {
      final localSynced = existingSessions.first['synced'] as int? ?? 1;
      if (localSynced == 1) {
        await _db.update('table_sessions', mappedSession,
            where: 'id = ?', whereArgs: [sessionId]);
      }
    }

    // Sincronizar clientes da sessão
    final customers = sessionData['customers'] as List<dynamic>? ?? [];
    for (final customer in customers) {
      if (customer is! Map<String, dynamic>) continue;
      await _mergeTableCustomer(sessionId, customer);
    }
  }

  // Mesclar cliente de mesa do servidor com local
  Future<void> _mergeTableCustomer(
      String sessionId, Map<String, dynamic> customer) async {
    final customerId = customer['id']?.toString();
    if (customerId == null) return;

    final mappedCustomer = {
      'id': customerId,
      'session_id': sessionId,
      'customer_id': customer['customerId'] ?? customer['customer_id'],
      'customer_name':
          customer['customerName'] ?? customer['customer_name'] ?? 'Cliente',
      'order_sequence':
          customer['orderSequence'] ?? customer['order_sequence'] ?? 0,
      'subtotal': customer['subtotal'] ?? 0,
      'total': customer['total'] ?? 0,
      'paid_amount': customer['paidAmount'] ?? customer['paid_amount'] ?? 0,
      'payment_status':
          customer['paymentStatus'] ?? customer['payment_status'] ?? 'pending',
      'synced': 1,
    };

    final existingCustomers = await _db.query(
      'table_customers',
      where: 'id = ?',
      whereArgs: [customerId],
    );

    if (existingCustomers.isEmpty) {
      await _db.insert('table_customers', mappedCustomer);
    } else {
      final localSynced = existingCustomers.first['synced'] as int? ?? 1;
      if (localSynced == 1) {
        await _db.update('table_customers', mappedCustomer,
            where: 'id = ?', whereArgs: [customerId]);
      }
    }

    // Sincronizar pedidos do cliente
    final orders = customer['orders'] as List<dynamic>? ?? [];
    for (final order in orders) {
      if (order is! Map<String, dynamic>) continue;
      await _mergeTableOrder(sessionId, customerId, order);
    }
  }

  // Mesclar pedido de mesa do servidor com local
  Future<void> _mergeTableOrder(String sessionId, String tableCustomerId,
      Map<String, dynamic> order) async {
    final orderId = order['id']?.toString();
    if (orderId == null) return;

    final mappedOrder = {
      'id': orderId,
      'session_id': sessionId,
      'table_customer_id': tableCustomerId,
      'product_id': order['productId'] ?? order['product_id'],
      'qty_units': order['qtyUnits'] ?? order['qty_units'] ?? 1,
      'is_muntu': (order['isMuntu'] == true || order['is_muntu'] == 1) ? 1 : 0,
      'unit_price': order['unitPrice'] ?? order['unit_price'] ?? 0,
      'subtotal': order['subtotal'] ?? 0,
      'total': order['total'] ?? 0,
      'status': order['status'] ?? 'pending',
      'ordered_by': order['orderedBy'] ?? order['ordered_by'],
      'ordered_at': order['orderedAt'] ?? order['ordered_at'],
      'synced': 1,
    };

    final existingOrders = await _db.query(
      'table_orders',
      where: 'id = ?',
      whereArgs: [orderId],
    );

    if (existingOrders.isEmpty) {
      await _db.insert('table_orders', mappedOrder);
    } else {
      final localSynced = existingOrders.first['synced'] as int? ?? 1;
      if (localSynced == 1) {
        await _db.update('table_orders', mappedOrder,
            where: 'id = ?', whereArgs: [orderId]);
      }
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

      // Para inventory, comparar por product_id ao invés de id
      // porque o ID local pode ser diferente do servidor
      List<Map<String, dynamic>> localItems;
      if (table == 'inventory') {
        final productId = item['productId'] ?? item['product_id'];
        final serverQty = item['qtyUnits'] ?? item['qty_units'] ?? 0;
        if (productId == null) continue;
        localItems = await _db.query(
          table,
          where: 'product_id = ?',
          whereArgs: [productId],
        );
        debugPrint('═══════════════════════════════════════════════════════');
        debugPrint('🔄 MERGE INVENTORY - Servidor → Local');
        debugPrint('   Product ID: $productId');
        debugPrint('   Servidor qty: $serverQty');
        debugPrint('   Encontrado localmente: ${localItems.isNotEmpty}');
        if (localItems.isNotEmpty) {
          final localQty = localItems.first['qty_units'];
          final localSynced = localItems.first['synced'];
          debugPrint('   Local qty: $localQty');
          debugPrint('   Local synced: $localSynced');
        }
        debugPrint('═══════════════════════════════════════════════════════');
      } else {
        localItems = await _db.query(table, where: 'id = ?', whereArgs: [id]);
      }

      if (localItems.isEmpty) {
        // Não existe localmente - inserir
        final mappedData = _mapServerToLocal(table, item);
        mappedData['synced'] = 1;
        await _db.insert(table, mappedData);
      } else {
        final localItem = localItems.first;
        final localSynced = localItem['synced'];
        // Comparar synced como int ou string (SQLite pode retornar ambos)
        final isNotSynced =
            localSynced == 0 || localSynced == '0' || localSynced == false;

        // Se item local está sincronizado, podemos sobrescrever
        if (!isNotSynced) {
          final mappedData = _mapServerToLocal(table, item);
          mappedData['synced'] = 1;
          // Para inventory, atualizar pelo ID local, não do servidor
          final localId = localItem['id'];
          // IMPORTANTE: Remover o ID do mapeamento para não tentar alterar a PK
          if (table == 'inventory') {
            mappedData.remove('id');
          }
          await _db
              .update(table, mappedData, where: 'id = ?', whereArgs: [localId]);
          if (table == 'inventory') {
            debugPrint(
                '✅ INVENTORY ATUALIZADO do servidor (synced=1, sobrescrevendo)');
          }
        } else {
          debugPrint('═══════════════════════════════════════════════════════');
          debugPrint('⚠️ PRESERVANDO $table LOCAL NÃO SINCRONIZADO');
          debugPrint('   ID: ${localItem['id']}');
          if (table == 'inventory') {
            debugPrint('   Local qty: ${localItem['qty_units']}');
            debugPrint('   Motivo: synced=0 (alteração local pendente)');
          }
          debugPrint('═══════════════════════════════════════════════════════');
        }
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

    // Garantir que customers tenha name (campo obrigatório)
    if (table == 'customers' &&
        (mapped['name'] == null || mapped['name'] == '')) {
      mapped['name'] = serverData['fullName'] ??
          serverData['full_name'] ??
          serverData['email']?.toString().split('@').first ??
          'Cliente';
    }

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
    debugPrint('📝 Marcando para sync: $entityType/$entityId ($action)');

    await _db.addToSyncQueue(
      entityType: entityType,
      entityId: entityId,
      action: action,
      data: data ?? {},
    );

    // Tentar sincronizar imediatamente se online
    if (_isOnline) {
      debugPrint('🌐 Online - iniciando sincronização imediata');
      // Usar Future.delayed para não bloquear a UI
      Future.delayed(const Duration(milliseconds: 500), () => syncAll());
    } else {
      debugPrint(
          '📴 Offline - item ficará na fila para sincronização posterior');
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
