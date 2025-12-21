import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/payment_methods.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';
import 'package:uuid/uuid.dart';

class TablesProvider extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final DatabaseService _db = DatabaseService.instance;
  final SyncService _sync = SyncService.instance;
  final _uuid = const Uuid();

  List<Map<String, dynamic>> _tables = [];
  List<Map<String, dynamic>> _sessions = [];
  Map<String, dynamic>? _currentSession;
  List<Map<String, dynamic>> _currentCustomers = [];
  List<Map<String, dynamic>> _currentOrders = [];
  List<Map<String, dynamic>> _sessionHistory = [];
  Map<String, Map<String, dynamic>> _customerCreditInfo = {};
  List<Map<String, dynamic>> _customerDebts = [];
  bool _isLoading = false;
  String? _error;

  List<Map<String, dynamic>> get tables => _tables;
  List<Map<String, dynamic>> get sessions => _sessions;
  Map<String, dynamic>? get currentSession => _currentSession;
  List<Map<String, dynamic>> get currentCustomers => _currentCustomers;
  List<Map<String, dynamic>> get currentOrders => _currentOrders;
  List<Map<String, dynamic>> get sessionHistory => _sessionHistory;
  Map<String, Map<String, dynamic>> get customerCreditInfo =>
      _customerCreditInfo;
  List<Map<String, dynamic>> get customerDebts => _customerDebts;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int _asInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  Future<Map<String, int>?> _getLocalProductPricing(String productId) async {
    try {
      final rows = await _db.rawQuery(
        'SELECT price_unit, muntu_quantity, muntu_price FROM products WHERE id = ? LIMIT 1',
        [productId],
      );
      if (rows.isEmpty) return null;

      final row = rows.first;
      return {
        'price_unit': _asInt(row['price_unit']),
        'muntu_quantity': _asInt(row['muntu_quantity']),
        'muntu_price': _asInt(row['muntu_price']),
      };
    } catch (_) {
      return null;
    }
  }

  Future<int> _computeOrderTotal({
    required String productId,
    required int qtyUnits,
    required int fallbackUnitPrice,
    required bool isMuntu,
  }) async {
    final pricing = await _getLocalProductPricing(productId);
    final unitPrice = pricing?['price_unit'] ?? fallbackUnitPrice;

    if (!isMuntu) {
      return unitPrice * qtyUnits;
    }

    final muntuQty = pricing?['muntu_quantity'] ?? 0;
    final muntuPrice = pricing?['muntu_price'] ?? 0;
    if (muntuQty <= 0 || muntuPrice <= 0) {
      return unitPrice * qtyUnits;
    }

    final sets = qtyUnits ~/ muntuQty;
    final remainder = qtyUnits % muntuQty;
    return (sets * muntuPrice) + (remainder * unitPrice);
  }

  /// Decrementa o estoque local de um produto (usado em pedidos offline de mesas)
  /// NOTA: NÃO faz markForSync porque o servidor já decrementa ao receber o table_orders
  Future<void> _decrementLocalStock(String productId, int quantity) async {
    try {
      // Buscar inventário do produto
      final invRows = await _db.rawQuery(
        'SELECT id, branch_id, qty_units FROM inventory WHERE product_id = ? LIMIT 1',
        [productId],
      );

      if (invRows.isEmpty) {
        debugPrint('⚠️ Inventário não encontrado para produto: $productId');
        return;
      }

      final inv = invRows.first;
      final invId = inv['id'];
      final currentQty = _asInt(inv['qty_units']);
      final newQty = currentQty - quantity;

      debugPrint('═══════════════════════════════════════════════════════');
      debugPrint('📦 DECREMENTO DE ESTOQUE LOCAL (MESA)');
      debugPrint('   Produto ID: $productId');
      debugPrint('   Inventário ID: $invId');
      debugPrint('   Quantidade anterior: $currentQty');
      debugPrint('   Quantidade vendida: $quantity');
      debugPrint('   Nova quantidade: $newQty');
      debugPrint('   ⚠️ Servidor decrementará via table_orders sync');
      debugPrint('═══════════════════════════════════════════════════════');

      // Atualizar APENAS no banco local - NÃO marcar para sync
      // O servidor já vai decrementar quando receber o table_orders
      await _db.update(
        'inventory',
        {'qty_units': newQty},
        where: 'id = ?',
        whereArgs: [invId],
      );

      debugPrint('💾 Estoque local decrementado: $productId, novo qty=$newQty');
    } catch (e) {
      debugPrint('❌ Erro ao decrementar estoque local: $e');
    }
  }

  Future<void> _recalculateSessionAndCustomersTotals(
    String sessionId, {
    required String now,
  }) async {
    // Recalcular total da sessão
    final sessionSum = await _db.rawQuery(
      'SELECT COALESCE(SUM(total), 0) as total_amount FROM table_orders WHERE session_id = ?',
      [sessionId],
    );
    final totalAmount =
        sessionSum.isNotEmpty ? _asInt(sessionSum.first['total_amount']) : 0;

    await _db.update(
      'table_sessions',
      {
        'total_amount': totalAmount,
        'updated_at': now,
        'synced': 0,
      },
      where: 'id = ?',
      whereArgs: [sessionId],
    );

    // Recalcular totais por cliente
    // Zerar primeiro para evitar sobras quando cliente fica sem pedidos
    await _db.update(
      'table_customers',
      {
        'subtotal': 0,
        'total': 0,
        'updated_at': now,
        'synced': 0,
      },
      where: 'session_id = ?',
      whereArgs: [sessionId],
    );

    final customerSums = await _db.rawQuery(
      'SELECT table_customer_id, COALESCE(SUM(total), 0) as total_amount '
      'FROM table_orders WHERE session_id = ? GROUP BY table_customer_id',
      [sessionId],
    );

    for (final row in customerSums) {
      final tableCustomerId = row['table_customer_id']?.toString();
      if (tableCustomerId == null) continue;
      final customerTotal = _asInt(row['total_amount']);

      await _db.update(
        'table_customers',
        {
          'subtotal': customerTotal,
          'total': customerTotal,
          'updated_at': now,
          'synced': 0,
        },
        where: 'id = ?',
        whereArgs: [tableCustomerId],
      );
    }
  }

  Future<List<Map<String, dynamic>>> _loadTablesFromLocalDb({
    String? branchId,
  }) async {
    final results = await _db.query(
      'tables',
      where: branchId != null ? 'branch_id = ?' : null,
      whereArgs: branchId != null ? [branchId] : null,
      orderBy: 'number ASC',
    );

    final tables = results.map((e) => Map<String, dynamic>.from(e)).toList();

    for (int i = 0; i < tables.length; i++) {
      final tableId = tables[i]['id'];
      final sessions = await _db.query(
        'table_sessions',
        where: 'table_id = ? AND status = ?',
        whereArgs: [tableId, 'open'],
        limit: 1,
      );

      if (sessions.isNotEmpty) {
        tables[i]['current_session'] =
            Map<String, dynamic>.from(sessions.first);
      } else {
        tables[i].remove('current_session');
      }
    }

    return tables;
  }

  Future<void> _reconcileLocalSyncedOpenSessionsAgainstServerOverview(
    List<Map<String, dynamic>> overviewTables, {
    required String now,
    String? branchId,
  }) async {
    final serverOpenSessionIds = <String>{};
    for (final t in overviewTables) {
      final currentSession = t['currentSession'];
      if (currentSession is Map<String, dynamic>) {
        final sid = currentSession['id']?.toString();
        if (sid != null && sid.isNotEmpty) {
          serverOpenSessionIds.add(sid);
        }
      }
    }

    final localOpenSyncedSessions = await _db.query(
      'table_sessions',
      where: branchId != null
          ? "branch_id = ? AND status = 'open' AND synced = 1"
          : "status = 'open' AND synced = 1",
      whereArgs: branchId != null ? [branchId] : null,
    );

    for (final s in localOpenSyncedSessions) {
      final sid = s['id']?.toString();
      if (sid == null || sid.isEmpty) continue;
      if (serverOpenSessionIds.contains(sid)) continue;

      await _db.update(
        'table_sessions',
        {
          'status': 'closed',
          'closed_at': s['closed_at'] ?? now,
          'updated_at': now,
          'synced': 1,
        },
        where: 'id = ?',
        whereArgs: [sid],
      );
    }
  }

  Future<void> loadTables({String? branchId}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    if (branchId == null || branchId.isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final savedBranchId = prefs.getString('branch_id');
        if (savedBranchId != null && savedBranchId.isNotEmpty) {
          branchId = savedBranchId;
          debugPrint(
              '🍽️ loadTables: branchId carregado do SharedPreferences: $branchId');
        }
      } catch (_) {
        // Sem branchId persistido; segue com null.
      }
    }

    debugPrint(
        '🍽️ loadTables chamado - branchId: $branchId, isOnline: ${_sync.isOnline}');

    try {
      if (_sync.isOnline) {
        debugPrint('🍽️ Online - buscando mesas da API...');
        final now = DateTime.now().toIso8601String();

        // Primeiro, buscar todas as mesas da API (não requer branchId)
        final allTables = await _api.getTables(branchId: branchId);
        debugPrint('🍽️ Mesas recebidas da API: ${allTables.length}');
        final fetchedTables =
            allTables.map((e) => Map<String, dynamic>.from(e)).toList();

        // Fallback adicional: se ainda não temos branchId, inferir pelo payload das mesas.
        if ((branchId == null || branchId.isEmpty) &&
            fetchedTables.isNotEmpty) {
          final inferred = (fetchedTables.first['branchId'] ??
                  fetchedTables.first['branch_id'])
              ?.toString();
          if (inferred != null && inferred.isNotEmpty) {
            branchId = inferred;
            debugPrint(
                '🍽️ loadTables: branchId inferido do payload das mesas: $branchId');

            // Persistir para chamadas futuras (ex.: usuário pode vir sem branchId)
            try {
              final prefs = await SharedPreferences.getInstance();
              final existing = prefs.getString('branch_id');
              if (existing == null || existing.isEmpty) {
                await prefs.setString('branch_id', branchId);
                debugPrint(
                    '🍽️ loadTables: branchId persistido no SharedPreferences: $branchId');
              }
            } catch (_) {
              // Ignorar falha de persistência
            }
          }
        }

        // Salvar localmente
        for (final table in fetchedTables) {
          await _saveTableLocally(table);

          // Se mesa tem sessão ativa, salvar também
          if (table['currentSession'] != null) {
            await _saveSessionLocally(table['currentSession']);
          }
        }

        // Se temos branchId, tentar buscar overview com sessões detalhadas
        List<Map<String, dynamic>>? overviewTables;
        if (branchId != null && branchId.isNotEmpty) {
          debugPrint(
              '🍽️ loadTables: buscando overview para branchId=$branchId');
          try {
            final results = await _api.getTablesOverview(branchId);
            if (results.isNotEmpty) {
              overviewTables =
                  results.map((e) => Map<String, dynamic>.from(e)).toList();

              for (final table in overviewTables) {
                await _saveTableLocally(table);
                if (table['currentSession'] != null) {
                  await _saveSessionLocally(table['currentSession']);
                }
              }

              await _reconcileLocalSyncedOpenSessionsAgainstServerOverview(
                overviewTables,
                now: now,
                branchId: branchId,
              );
            }
          } catch (e) {
            // Ignorar erro no overview, já temos as mesas básicas
            debugPrint('Aviso: Não foi possível buscar overview: $e');
          }
        } else {
          debugPrint('🍽️ loadTables: sem branchId, pulando overview');
        }

        // Fonte única para UI: banco local (com sessões abertas anexadas)
        _tables = await _loadTablesFromLocalDb(branchId: branchId);
      } else {
        debugPrint('🍽️ Offline - carregando do banco local...');
        _tables = await _loadTablesFromLocalDb(branchId: branchId);
        debugPrint('🍽️ Mesas do banco local: ${_tables.length}');
      }
    } catch (e) {
      _error = e.toString();

      // Fallback para banco local
      try {
        _tables = await _loadTablesFromLocalDb(branchId: branchId);
      } catch (_) {}
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> openTable({
    required String tableId,
    required String branchId,
    required String openedBy,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    // Garantir persistência do branchId para outras telas/serviços (overview, sync, etc)
    try {
      final prefs = await SharedPreferences.getInstance();
      final existing = prefs.getString('branch_id');
      if (existing == null || existing.isEmpty || existing != branchId) {
        await prefs.setString('branch_id', branchId);
      }
    } catch (_) {
      // Ignorar falha de persistência
    }

    try {
      final now = DateTime.now().toIso8601String();
      final sessionId = _uuid.v4();
      final sessionNumber = 'S${DateTime.now().millisecondsSinceEpoch}';

      if (_sync.isOnline) {
        final result = await _api.openTable(
          tableId: tableId,
          branchId: branchId,
          openedBy: openedBy,
        );
        _currentSession = Map<String, dynamic>.from(result);
        await _saveSessionLocally(_currentSession!);
      } else {
        _currentSession = {
          'id': sessionId,
          'table_id': tableId,
          'branch_id': branchId,
          'session_number': sessionNumber,
          'status': 'open',
          'opened_by': openedBy,
          'total_amount': 0,
          'paid_amount': 0,
          'opened_at': now,
          'created_at': now,
          'updated_at': now,
          'synced': 0,
        };

        await _db.insert('table_sessions', _currentSession!);

        await _sync.markForSync(
          entityType: 'table_sessions',
          entityId: sessionId,
          action: 'create',
          data: _currentSession,
        );
      }

      // Atualizar status da mesa em memória e no banco local
      final tableIndex = _tables.indexWhere((t) => t['id'] == tableId);
      if (tableIndex >= 0) {
        // Garantir que o mapa é mutável
        _tables[tableIndex] = Map<String, dynamic>.from(_tables[tableIndex]);
        _tables[tableIndex]['status'] = 'occupied';
        _tables[tableIndex]['current_session'] = _currentSession;

        // CORREÇÃO: Persistir status da mesa no banco local
        await _db.update(
          'tables',
          {'status': 'occupied'},
          where: 'id = ?',
          whereArgs: [tableId],
        );
      }

      // Limpar clientes e pedidos anteriores para nova sessão
      _currentCustomers = [];
      _currentOrders = [];

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('❌ Erro ao abrir mesa: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> loadSession(String sessionId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      if (_sync.isOnline) {
        final result = await _api.getTableSession(sessionId);
        _currentSession = Map<String, dynamic>.from(result);

        // Extrair clientes e pedidos
        if (_currentSession!['customers'] != null) {
          _currentCustomers = List<Map<String, dynamic>>.from(
              _currentSession!['customers']
                  .map((c) => Map<String, dynamic>.from(c)));
        }

        // Coletar todos os pedidos de todos os clientes
        _currentOrders = [];
        for (final customer in _currentCustomers) {
          if (customer['orders'] != null) {
            for (final order in customer['orders']) {
              final orderMap = Map<String, dynamic>.from(order);

              // Buscar dados do banco local se não existirem na resposta da API
              if (orderMap['id'] != null) {
                final localOrders = await _db.query(
                  'table_orders',
                  where: 'id = ?',
                  whereArgs: [orderMap['id']],
                );
                if (localOrders.isNotEmpty) {
                  final localOrder = localOrders.first;
                  // CORREÇÃO: Preservar qty_units do banco local se não vier da API
                  if (orderMap['qtyUnits'] == null &&
                      orderMap['qty_units'] == null) {
                    final localQtyUnits = localOrder['qty_units'];
                    if (localQtyUnits != null) {
                      orderMap['qty_units'] = localQtyUnits;
                    }
                  }
                  // Preservar display_qty do banco local
                  if (orderMap['display_qty'] == null) {
                    orderMap['display_qty'] =
                        localOrder['display_qty'] ?? orderMap['qty_units'] ?? 1;
                  }
                  // CORREÇÃO: Preservar product_name do banco local se não vier da API
                  final apiProductName =
                      orderMap['productName'] ?? orderMap['product_name'];
                  if (apiProductName == null || apiProductName.isEmpty) {
                    final localProductName = localOrder['product_name'];
                    if (localProductName != null &&
                        localProductName.isNotEmpty &&
                        localProductName != 'Produto') {
                      orderMap['product_name'] = localProductName;
                    }
                  }
                }
              }

              // Buscar product_name da tabela de produtos se ainda não existir
              final currentProductName =
                  orderMap['productName'] ?? orderMap['product_name'];
              if ((currentProductName == null ||
                      currentProductName.isEmpty ||
                      currentProductName == 'Produto') &&
                  (orderMap['product_id'] ?? orderMap['productId']) != null) {
                final productId =
                    orderMap['product_id'] ?? orderMap['productId'];
                final products = await _db.query(
                  'products',
                  where: 'id = ?',
                  whereArgs: [productId],
                );
                if (products.isNotEmpty && products.first['name'] != null) {
                  orderMap['product_name'] = products.first['name'];
                }
              }

              // Enriquecer com muntu_quantity se não existir
              if (orderMap['muntu_quantity'] == null &&
                  orderMap['product_id'] != null) {
                final pricing = await _getLocalProductPricing(
                    orderMap['product_id'] ?? orderMap['productId']);
                if (pricing != null) {
                  orderMap['muntu_quantity'] = pricing['muntu_quantity'] ?? 3;
                }
              }
              _currentOrders.add(orderMap);
            }
          }
        }

        // Salvar localmente
        await _saveSessionLocally(_currentSession!);
        for (final customer in _currentCustomers) {
          await _saveCustomerLocally(customer);
        }
        for (final order in _currentOrders) {
          await _saveOrderLocally(order);
        }
      } else {
        // Carregar do banco local
        final sessions = await _db.query(
          'table_sessions',
          where: 'id = ?',
          whereArgs: [sessionId],
        );
        _currentSession = sessions.isNotEmpty
            ? Map<String, dynamic>.from(sessions.first)
            : null;

        if (_currentSession != null) {
          // CORREÇÃO: Converter para mapas mutáveis para evitar problemas de estado
          final rawCustomers = await _db.query(
            'table_customers',
            where: 'session_id = ?',
            whereArgs: [sessionId],
          );
          _currentCustomers =
              rawCustomers.map((c) => Map<String, dynamic>.from(c)).toList();

          final rawOrders = await _db.query(
            'table_orders',
            where: 'session_id = ?',
            whereArgs: [sessionId],
          );
          _currentOrders =
              rawOrders.map((o) => Map<String, dynamic>.from(o)).toList();

          // Converter para Map mutável e enriquecer pedidos
          for (int i = 0; i < _currentOrders.length; i++) {
            final order = Map<String, dynamic>.from(_currentOrders[i]);

            // Garantir display_qty está presente
            if (order['display_qty'] == null) {
              order['display_qty'] = order['qty_units'] ?? 1;
            }

            // Enriquecer com muntu_quantity do produto se não existir
            if (order['muntu_quantity'] == null &&
                order['product_id'] != null) {
              final pricing =
                  await _getLocalProductPricing(order['product_id']);
              if (pricing != null) {
                order['muntu_quantity'] = pricing['muntu_quantity'] ?? 3;
              }
            }
            _currentOrders[i] = order;
          }
        }
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addCustomer({
    required String sessionId,
    required String customerName,
    String? customerId,
    required String addedBy,
  }) async {
    try {
      final now = DateTime.now().toIso8601String();
      final id = _uuid.v4();

      Map<String, dynamic> customer;

      if (_sync.isOnline) {
        final result = await _api.addCustomerToTable(
          sessionId: sessionId,
          customerName: customerName,
          customerId: customerId,
          addedBy: addedBy,
        );
        customer = Map<String, dynamic>.from(result);
        await _saveCustomerLocally(customer);
      } else {
        customer = {
          'id': id,
          'session_id': sessionId,
          'customer_id': customerId,
          'customer_name': customerName,
          'order_sequence': _currentCustomers.length,
          'subtotal': 0,
          'total': 0,
          'paid_amount': 0,
          'payment_status': 'pending',
          'created_at': now,
          'updated_at': now,
          'synced': 0,
        };

        await _db.insert('table_customers', customer);

        await _sync.markForSync(
          entityType: 'table_customers',
          entityId: id,
          action: 'create',
          data: customer,
        );
      }

      _currentCustomers.add(customer);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> addOrder({
    required String sessionId,
    required String tableCustomerId,
    required String productId,
    required String productName,
    required int quantity,
    required int unitPrice,
    required bool isMuntu,
    required String orderedBy,
    int? displayQty, // Quantidade do carrinho para exibição
  }) async {
    try {
      final now = DateTime.now().toIso8601String();
      final id = _uuid.v4();
      final total = await _computeOrderTotal(
        productId: productId,
        qtyUnits: quantity,
        fallbackUnitPrice: unitPrice,
        isMuntu: isMuntu,
      );

      final localPricing = await _getLocalProductPricing(productId);
      final storedUnitPrice = localPricing?['price_unit'] ?? unitPrice;
      final storedMuntuQuantity = localPricing?['muntu_quantity'] ?? 3;

      Map<String, dynamic> order;

      debugPrint('═══════════════════════════════════════════════════════');
      debugPrint('📋 ADD ORDER - Parâmetros recebidos:');
      debugPrint('   quantity (qtyUnits): $quantity');
      debugPrint('   displayQty: $displayQty');
      debugPrint('   isMuntu: $isMuntu');
      debugPrint('   storedMuntuQuantity: $storedMuntuQuantity');
      debugPrint('═══════════════════════════════════════════════════════');

      if (_sync.isOnline) {
        final result = await _api.addOrderToTable(
          sessionId: sessionId,
          tableCustomerId: tableCustomerId,
          productId: productId,
          qtyUnits: quantity,
          isMuntu: isMuntu,
          orderedBy: orderedBy,
        );
        order = Map<String, dynamic>.from(result);
        debugPrint('📋 API Response keys: ${order.keys.toList()}');
        debugPrint('📋 API qtyUnits: ${order['qtyUnits']}');
        debugPrint('📋 API qty_units: ${order['qty_units']}');

        // Garantir que product_name, muntu_quantity, qty_units e display_qty estão na ordem
        order['product_name'] = productName;
        order['muntu_quantity'] = storedMuntuQuantity;
        order['display_qty'] = displayQty ?? 1; // Quantidade do carrinho
        // IMPORTANTE: Preservar qty_units passado como parâmetro caso API não retorne
        if (order['qtyUnits'] == null && order['qty_units'] == null) {
          order['qty_units'] = quantity;
          debugPrint('📋 DEFININDO qty_units = $quantity (API não retornou)');
        }

        debugPrint('📋 Order final qty_units: ${order['qty_units']}');
        await _saveOrderLocally(order);

        // Atualizar totais mesmo quando online
        final orderTotal =
            order['total'] != null ? _asInt(order['total']) : total;
        final customerIndex =
            _currentCustomers.indexWhere((c) => c['id'] == tableCustomerId);
        if (customerIndex >= 0) {
          _currentCustomers[customerIndex]['subtotal'] =
              (_currentCustomers[customerIndex]['subtotal'] ?? 0) + orderTotal;
          _currentCustomers[customerIndex]['total'] =
              (_currentCustomers[customerIndex]['total'] ?? 0) + orderTotal;
        }

        if (_currentSession != null) {
          _currentSession!['total_amount'] =
              (_currentSession!['total_amount'] ?? 0) + orderTotal;
        }
      } else {
        order = {
          'id': id,
          'session_id': sessionId,
          'table_customer_id': tableCustomerId,
          'product_id': productId,
          'product_name': productName,
          'qty_units': quantity,
          'display_qty':
              displayQty ?? 1, // Quantidade do carrinho para exibição
          'is_muntu': isMuntu ? 1 : 0,
          'muntu_quantity': storedMuntuQuantity,
          'unit_price': storedUnitPrice,
          'subtotal': total,
          'total': total,
          'status': 'pending',
          'ordered_by': orderedBy,
          'ordered_at': now,
          'updated_at': now,
          'synced': 0,
        };

        await _db.insert('table_orders', order);

        await _sync.markForSync(
          entityType: 'table_orders',
          entityId: id,
          action: 'create',
          data: order,
        );

        // ===== DECREMENTAR ESTOQUE LOCAL (OFFLINE) =====
        await _decrementLocalStock(productId, quantity);

        // Atualizar total do cliente
        final customerIndex =
            _currentCustomers.indexWhere((c) => c['id'] == tableCustomerId);
        if (customerIndex >= 0) {
          _currentCustomers[customerIndex]['subtotal'] =
              (_currentCustomers[customerIndex]['subtotal'] ?? 0) + total;
          _currentCustomers[customerIndex]['total'] =
              (_currentCustomers[customerIndex]['total'] ?? 0) + total;
          _currentCustomers[customerIndex]['updated_at'] = now;

          await _db.update(
            'table_customers',
            _currentCustomers[customerIndex],
            where: 'id = ?',
            whereArgs: [tableCustomerId],
          );
        }

        // Atualizar total da sessão
        if (_currentSession != null) {
          _currentSession!['total_amount'] =
              (_currentSession!['total_amount'] ?? 0) + total;
          _currentSession!['updated_at'] = now;

          await _db.update(
            'table_sessions',
            _currentSession!,
            where: 'id = ?',
            whereArgs: [sessionId],
          );
        }
      }

      _currentOrders.add(order);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> processPayment({
    required String sessionId,
    String? tableCustomerId,
    required String method,
    required int amount,
    required String processedBy,
    required bool isSessionPayment,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();
      final paymentId = _uuid.v4();

      // 🔴 LOG FASE 1: Valor ORIGINAL recebido do botão
      debugPrint('\n═══════════════════════════════════════════════════════');
      debugPrint('🔴 [MESAS][PROCESS_PAYMENT] ENTRADA');
      debugPrint('   method ORIGINAL: "$method"');
      debugPrint('   method.runtimeType: ${method.runtimeType}');
      debugPrint('═══════════════════════════════════════════════════════\n');

      // Normalizar método de pagamento para garantir consistência
      final normalizedMethod = PaymentMethod.normalize(method);

      // 🔴 LOG FASE 2: Após normalização
      debugPrint('🔴 [MESAS][AFTER_NORMALIZE]');
      debugPrint('   method ORIGINAL: "$method"');
      debugPrint('   normalizedMethod: "$normalizedMethod"');
      debugPrint('   São iguais? ${method == normalizedMethod}');

      // ⚠️ VALIDAÇÃO CRÍTICA: VALE requer cliente cadastrado
      String? registeredCustomerId;
      if (tableCustomerId != null) {
        final tableCustomer = _currentCustomers.firstWhere(
          (c) => c['id'] == tableCustomerId,
          orElse: () => <String, dynamic>{},
        );
        // 🔧 CORREÇÃO: Verificar ambos formatos (snake_case do banco local e camelCase da API)
        registeredCustomerId = tableCustomer['customer_id'] as String? ??
            tableCustomer['customerId'] as String?;

        // 🔴 DEBUG: Log para diagnóstico
        debugPrint('🔍 [VALE VALIDATION] tableCustomerId: $tableCustomerId');
        debugPrint('   tableCustomer keys: ${tableCustomer.keys.toList()}');
        debugPrint('   customer_id: ${tableCustomer['customer_id']}');
        debugPrint('   customerId: ${tableCustomer['customerId']}');
        debugPrint('   registeredCustomerId: $registeredCustomerId');
      }

      if (normalizedMethod == 'VALE' && registeredCustomerId == null) {
        _error = 'Vale só disponível para clientes cadastrados!';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (_sync.isOnline) {
        await _api.processTablePayment(
          sessionId: sessionId,
          tableCustomerId: tableCustomerId,
          method: normalizedMethod, // ✅ Método normalizado
          amount: amount,
          processedBy: processedBy,
          isSessionPayment: isSessionPayment,
        );
      } else {
        // ===== OFFLINE: Salvar pagamento localmente e enfileirar =====
        final payment = {
          'id': paymentId,
          'session_id': sessionId,
          'table_customer_id': tableCustomerId,
          'method':
              normalizedMethod, // ✅ Método normalizado (já definido acima)
          'amount': amount,
          'processed_by': processedBy,
          'processed_at': now,
          'is_session_payment': isSessionPayment ? 1 : 0,
          'synced': 0,
        };

        await _db.insert('table_payments', payment);

        await _sync.markForSync(
          entityType: 'table_payments',
          entityId: paymentId,
          action: 'create',
          data: payment,
        );
        debugPrint(
            '💾 Pagamento salvo offline: $paymentId, method: $normalizedMethod');
      }

      // ===== Atualizar estado local (online e offline) =====
      if (isSessionPayment) {
        // Pagamento da sessão inteira
        if (_currentSession != null) {
          _currentSession!['paid_amount'] =
              (_currentSession!['paid_amount'] ?? 0) + amount;

          final totalAmount = _currentSession!['total_amount'] ?? 0;
          if (_currentSession!['paid_amount'] >= totalAmount) {
            _currentSession!['status'] = 'closed';
          }

          // Atualizar no banco local
          await _db.update(
            'table_sessions',
            {
              'paid_amount': _currentSession!['paid_amount'],
              'updated_at': now,
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [sessionId],
          );
        }
      } else {
        // Pagamento de cliente específico
        final customerIndex =
            _currentCustomers.indexWhere((c) => c['id'] == tableCustomerId);
        if (customerIndex >= 0) {
          _currentCustomers[customerIndex]['paid_amount'] =
              (_currentCustomers[customerIndex]['paid_amount'] ?? 0) + amount;

          // ✅ CORREÇÃO: Marcar pedidos PENDENTES como pagos quando o valor é igual ao pendente
          // Calcular total pendente antes de marcar
          int pendingAmount = 0;
          final pendingOrders = <Map<String, dynamic>>[];
          for (final order in _currentOrders) {
            final orderCustomerId =
                order['table_customer_id'] ?? order['tableCustomerId'];
            final status = order['status'] ?? 'pending';
            if (orderCustomerId == tableCustomerId &&
                status != 'paid' &&
                status != 'cancelled') {
              pendingAmount += (order['total'] as num? ?? 0).toInt();
              pendingOrders.add(order);
            }
          }

          // Se o valor pago cobre os pedidos pendentes, marcar como pagos
          if (amount >= pendingAmount && pendingOrders.isNotEmpty) {
            for (final order in pendingOrders) {
              order['status'] = 'paid';
              // Atualizar no banco local também
              await _db.update(
                'table_orders',
                {'status': 'paid', 'updated_at': now, 'synced': 0},
                where: 'id = ?',
                whereArgs: [order['id']],
              );
            }
            debugPrint('✅ ${pendingOrders.length} pedidos marcados como pagos');
          }

          // Verificar se TODOS os pedidos estão pagos para atualizar status do cliente
          final hasAnyPending = _currentOrders.any((o) {
            final orderCustomerId =
                o['table_customer_id'] ?? o['tableCustomerId'];
            final status = o['status'] ?? 'pending';
            return orderCustomerId == tableCustomerId &&
                status != 'paid' &&
                status != 'cancelled';
          });

          if (!hasAnyPending) {
            _currentCustomers[customerIndex]['payment_status'] = 'paid';
          }

          // Atualizar cliente no banco local
          await _db.update(
            'table_customers',
            {
              'paid_amount': _currentCustomers[customerIndex]['paid_amount'],
              'payment_status': _currentCustomers[customerIndex]
                  ['payment_status'],
              'updated_at': now,
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [tableCustomerId],
          );
        }

        // Atualizar total pago da sessão também
        if (_currentSession != null) {
          _currentSession!['paid_amount'] =
              (_currentSession!['paid_amount'] ?? 0) + amount;

          await _db.update(
            'table_sessions',
            {
              'paid_amount': _currentSession!['paid_amount'],
              'updated_at': now,
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [sessionId],
          );
        }
      }

      // ===== CRIAR REGISTRO DE VENDA PARA SINCRONIZAÇÃO =====
      // Isso garante que a venda de mesa apareça nos relatórios e sincronize com Railway/Electron
      final saleId = _uuid.v4();
      final saleNumber =
          'M${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}';
      final branchId = _currentSession?['branch_id'] ?? 'main-branch';
      final tableId = _currentSession?['table_id'];

      // Buscar dados do cliente de mesa para obter customer_id e customer_name
      String? customerId;
      String? customerName;
      if (tableCustomerId != null) {
        debugPrint('🔍 Buscando cliente com ID: $tableCustomerId');
        debugPrint(
            '🔍 _currentCustomers tem ${_currentCustomers.length} clientes');

        final tableCustomer = _currentCustomers.firstWhere(
          (c) => c['id'] == tableCustomerId,
          orElse: () => <String, dynamic>{},
        );

        debugPrint('🔍 tableCustomer encontrado: $tableCustomer');

        // 🔧 CORREÇÃO: Verificar ambos formatos (snake_case do banco local e camelCase da API)
        customerId = tableCustomer['customer_id'] as String? ??
            tableCustomer['customerId'] as String?;
        customerName = tableCustomer['customer_name'] as String? ??
            tableCustomer['customerName'] as String?;

        debugPrint('🔍 customer_id (snake): ${tableCustomer['customer_id']}');
        debugPrint('🔍 customerId (camel): ${tableCustomer['customerId']}');
        debugPrint('🔍 customerId FINAL: $customerId');
        debugPrint('🔍 customerName: $customerName');
      }

      debugPrint('═══════════════════════════════════════════════════════');
      debugPrint('📝 CRIANDO VENDA DE MESA');
      debugPrint('   Sale ID: $saleId');
      debugPrint('   Customer ID: $customerId');
      debugPrint('   Customer Name: $customerName');
      debugPrint('   Payment Method: $normalizedMethod');
      // 🔴 LOG FASE 3: ANTES de salvar venda no banco local
      debugPrint('\n🔴 [MESAS][LOCAL_SAVE] ANTES DE SALVAR VENDA');
      debugPrint('   saleId: $saleId');
      debugPrint('   payment_method A SER SALVO: "$normalizedMethod"');
      debugPrint(
          '   payment_method.runtimeType: ${normalizedMethod.runtimeType}');

      // Criar venda COM customer_name para garantir identificação correta
      await _db.insert('sales', {
        'id': saleId,
        'sale_number': saleNumber,
        'branch_id': branchId,
        'type': 'table',
        'table_id': tableId,
        'customer_id': customerId,
        'customer_name': customerName, // ✅ Adicionado para evitar "avulso"
        'cashier_id': processedBy,
        'status': 'completed',
        'subtotal': amount,
        'total': amount,
        'payment_method': normalizedMethod, // ✅ Método normalizado
        'payment_status': 'paid',
        'created_at': now,
        'synced': 0,
      });

      // 🔴 LOG FASE 4: APÓS salvar venda - verificar o que foi salvo
      debugPrint('🔴 [MESAS][LOCAL_SAVE] VENDA SALVA COM SUCESSO');

      // Criar itens da venda (baseado nos pedidos do cliente)
      if (tableCustomerId != null) {
        final customerOrders = _currentOrders
            .where((o) =>
                o['table_customer_id'] == tableCustomerId &&
                o['status'] == 'paid')
            .toList();

        for (final order in customerOrders) {
          await _db.insert('sale_items', {
            'id': _uuid.v4(),
            'sale_id': saleId,
            'product_id': order['product_id'],
            'qty_units': order['qty_units'] ?? 1,
            'is_muntu': order['is_muntu'] ?? 0,
            'unit_price': order['unit_price'] ?? 0,
            'total': order['total'] ?? 0,
            'created_at': now,
            'synced': 0,
          });
        }
      }

      // Marcar venda para sincronização
      await _sync.markForSync(
        entityType: 'sales',
        entityId: saleId,
        action: 'create',
      );
      debugPrint('💾 Venda de mesa criada: $saleId, total: $amount');

      // ═══════════════════════════════════════════════════════════════════
      // 🚫 REMOVIDO: Criação de dívida aqui causava DUPLICAÇÃO!
      // A dívida agora é criada APENAS no backend (sales.service.ts)
      // quando a venda é sincronizada. Isso garante idempotência.
      // ═══════════════════════════════════════════════════════════════════
      if (normalizedMethod == 'VALE' && customerId != null) {
        debugPrint(
            '💳 [VALE] Venda marcada para sync - dívida será criada pelo backend');
        debugPrint('   Cliente: $customerId ($customerName)');
        debugPrint('   Valor: $amount');
        debugPrint('   SaleId: $saleId');
        // Dívida será criada automaticamente pelo backend quando a venda for sincronizada
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  List<Map<String, dynamic>> getOrdersForCustomer(String customerId) {
    return _currentOrders.where((o) {
      final orderCustomerId = o['table_customer_id'] ?? o['tableCustomerId'];
      return orderCustomerId == customerId;
    }).toList();
  }

  List<Map<String, dynamic>> getPendingOrdersForCustomer(String customerId) {
    return _currentOrders.where((o) {
      final orderCustomerId = o['table_customer_id'] ?? o['tableCustomerId'];
      final status = o['status'] ?? 'pending';
      return orderCustomerId == customerId &&
          status != 'paid' &&
          status != 'cancelled';
    }).toList();
  }

  /// Calcular total pendente da sessão atual (soma de todos os pedidos pendentes)
  int get sessionPendingTotal {
    int total = 0;
    for (final order in _currentOrders) {
      final status = order['status'] ?? 'pending';
      if (status != 'paid' && status != 'cancelled') {
        total += (order['total'] as num? ?? 0).toInt();
      }
    }
    return total;
  }

  /// Calcular total pendente para uma mesa específica (baseado em pedidos)
  int getPendingTotalForTable(String tableId) {
    // Buscar sessão ativa da mesa
    final table = _tables.firstWhere(
      (t) => t['id'] == tableId,
      orElse: () => <String, dynamic>{},
    );
    final session = table['current_session'] ?? table['currentSession'];
    if (session == null) return 0;

    final sessionId = session['id'];

    // Somar pedidos pendentes desta sessão
    int total = 0;
    for (final order in _currentOrders) {
      final orderSessionId = order['session_id'] ?? order['sessionId'];
      final status = order['status'] ?? 'pending';
      if (orderSessionId == sessionId &&
          status != 'paid' &&
          status != 'cancelled') {
        total += (order['total'] as num? ?? 0).toInt();
      }
    }
    return total;
  }

  Future<void> _saveTableLocally(Map<String, dynamic> table) async {
    final mappedData = <String, dynamic>{
      'id': table['id'],
      'branch_id': table['branchId'] ?? table['branch_id'],
      'number': table['number'],
      'seats': table['seats'] ?? 4,
      'area': table['area'],
      'status': table['status'] ?? 'available',
      'is_active': 1,
      'synced': 1,
    };

    await _db.insert('tables', mappedData);
  }

  Future<void> _saveSessionLocally(Map<String, dynamic> session) async {
    final mappedData = <String, dynamic>{
      'id': session['id'],
      'table_id': session['tableId'] ?? session['table_id'],
      'branch_id': session['branchId'] ?? session['branch_id'],
      'session_number': session['sessionNumber'] ?? session['session_number'],
      'status': session['status'] ?? 'open',
      'opened_by': session['openedBy'] ?? session['opened_by'],
      'closed_by': session['closedBy'] ?? session['closed_by'],
      'total_amount': session['totalAmount'] ?? session['total_amount'] ?? 0,
      'paid_amount': session['paidAmount'] ?? session['paid_amount'] ?? 0,
      'opened_at': session['openedAt'] ?? session['opened_at'],
      'closed_at': session['closedAt'] ?? session['closed_at'],
      'created_at': session['createdAt'] ?? session['created_at'],
      'updated_at': session['updatedAt'] ?? session['updated_at'],
      'source': session['source'],
      'synced': 1,
    };

    await _db.insert('table_sessions', mappedData);
  }

  Future<void> _saveCustomerLocally(Map<String, dynamic> customer) async {
    final mappedData = <String, dynamic>{
      'id': customer['id'],
      'session_id': customer['sessionId'] ?? customer['session_id'],
      'customer_id': customer['customerId'] ?? customer['customer_id'],
      'customer_name': customer['customerName'] ?? customer['customer_name'],
      'subtotal': customer['subtotal'] ?? 0,
      'total': customer['total'] ?? 0,
      'paid_amount': customer['paidAmount'] ?? customer['paid_amount'] ?? 0,
      'payment_status':
          customer['paymentStatus'] ?? customer['payment_status'] ?? 'pending',
      'synced': 1,
    };

    await _db.insert('table_customers', mappedData);
  }

  Future<void> _saveOrderLocally(Map<String, dynamic> order) async {
    // Determinar o product_name correto
    String? productName = order['productName'] ?? order['product_name'];
    final productId = order['productId'] ?? order['product_id'];

    // Se não temos um nome válido, buscar do banco local
    if (productName == null ||
        productName.isEmpty ||
        productName == 'Produto') {
      // Primeiro, tentar obter do pedido existente no banco
      if (order['id'] != null) {
        final existingOrders = await _db.query(
          'table_orders',
          where: 'id = ?',
          whereArgs: [order['id']],
        );
        if (existingOrders.isNotEmpty) {
          final existingName = existingOrders.first['product_name']?.toString();
          if (existingName != null &&
              existingName.isNotEmpty &&
              existingName != 'Produto') {
            productName = existingName;
          }
        }
      }

      // Se ainda não temos nome, buscar da tabela de produtos
      if ((productName == null ||
              productName.isEmpty ||
              productName == 'Produto') &&
          productId != null) {
        final products = await _db.query(
          'products',
          where: 'id = ?',
          whereArgs: [productId],
        );
        if (products.isNotEmpty && products.first['name'] != null) {
          productName = products.first['name'].toString();
        }
      }
    }

    // Fallback final apenas se realmente não encontramos nada
    productName ??= 'Produto';

    final mappedData = <String, dynamic>{
      'id': order['id'],
      'session_id': order['sessionId'] ?? order['session_id'],
      'table_customer_id':
          order['tableCustomerId'] ?? order['table_customer_id'],
      'product_id': productId,
      'product_name': productName,
      'qty_units': order['qtyUnits'] ?? order['qty_units'] ?? 1,
      'display_qty': order['displayQty'] ??
          order['display_qty'] ??
          1, // Quantidade do carrinho
      'is_muntu': (order['isMuntu'] ?? order['is_muntu']) == true ? 1 : 0,
      'muntu_quantity': order['muntuQuantity'] ??
          order['muntu_quantity'], // Unidades por Muntu
      'unit_price': order['unitPrice'] ?? order['unit_price'] ?? 0,
      'subtotal': order['subtotal'] ?? 0,
      'total': order['total'] ?? 0,
      'status': order['status'] ?? 'pending',
      'ordered_by': order['orderedBy'] ?? order['ordered_by'],
      'ordered_at': order['orderedAt'] ?? order['ordered_at'],
      'synced': 1,
    };

    await _db.insert('table_orders', mappedData);
  }

  void clearSession() {
    _currentSession = null;
    _currentCustomers = [];
    _currentOrders = [];
    _sessionHistory = [];
    _customerCreditInfo = {};
    _customerDebts = [];
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  // ==================== NOVAS FUNCIONALIDADES ====================

  /// Fechar sessão da mesa
  Future<bool> closeTable({
    required String sessionId,
    required String closedBy,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Verificar se há valor pendente
      if (_currentSession != null) {
        final totalAmount = _currentSession!['total_amount'] ??
            _currentSession!['totalAmount'] ??
            0;
        final paidAmount = _currentSession!['paid_amount'] ??
            _currentSession!['paidAmount'] ??
            0;
        if (totalAmount > paidAmount) {
          _error = 'Há valor pendente de pagamento!';
          _isLoading = false;
          notifyListeners();
          return false;
        }
      }

      if (_sync.isOnline) {
        await _api.closeTableSession(
          sessionId: sessionId,
          closedBy: closedBy,
        );
      } else {
        // Atualizar localmente
        if (_currentSession != null) {
          _currentSession!['status'] = 'closed';
          _currentSession!['closed_by'] = closedBy;
          _currentSession!['closed_at'] = DateTime.now().toIso8601String();
          _currentSession!['synced'] = 0;

          await _db.update(
            'table_sessions',
            _currentSession!,
            where: 'id = ?',
            whereArgs: [sessionId],
          );

          await _sync.markForSync(
            entityType: 'table_sessions',
            entityId: sessionId,
            action: 'update',
            data: _currentSession,
          );
        }
      }

      // Atualizar mesa para disponível
      final tableId =
          _currentSession?['table_id'] ?? _currentSession?['tableId'];
      if (tableId != null) {
        final tableIndex = _tables.indexWhere((t) => t['id'] == tableId);
        if (tableIndex >= 0) {
          _tables[tableIndex] = Map<String, dynamic>.from(_tables[tableIndex]);
          _tables[tableIndex]['status'] = 'available';
          _tables[tableIndex]['current_session'] = null;
          _tables[tableIndex]['currentSession'] = null;
        }

        // ✅ CORREÇÃO BUG 4: Persistir status da mesa no banco local
        await _db.update(
          'tables',
          {'status': 'available', 'synced': 0},
          where: 'id = ?',
          whereArgs: [tableId],
        );
        debugPrint('💾 Mesa $tableId atualizada para available no banco local');
      }

      _currentSession = null;
      _currentCustomers = [];
      _currentOrders = [];

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Cancelar pedido
  Future<bool> cancelOrder({
    required String orderId,
    required String cancelledBy,
  }) async {
    try {
      // Buscar o pedido ANTES de qualquer operação para poder atualizar totais
      final orderIndex = _currentOrders.indexWhere((o) => o['id'] == orderId);
      Map<String, dynamic>? orderToCancel;
      if (orderIndex >= 0) {
        orderToCancel = Map<String, dynamic>.from(_currentOrders[orderIndex]);
      }

      if (_sync.isOnline) {
        await _api.cancelTableOrder(
          orderId: orderId,
          cancelledBy: cancelledBy,
        );
      } else {
        // Atualizar localmente
        if (orderIndex >= 0) {
          final order = _currentOrders[orderIndex];
          order['status'] = 'cancelled';
          order['synced'] = 0;

          await _db.update(
            'table_orders',
            order,
            where: 'id = ?',
            whereArgs: [orderId],
          );

          await _sync.markForSync(
            entityType: 'table_orders',
            entityId: orderId,
            action: 'update',
            data: order,
          );
        }
      }

      // ✅ SEMPRE atualizar totais locais (online e offline) para atualização em tempo real
      if (orderToCancel != null) {
        final customerId = orderToCancel['table_customer_id'] ??
            orderToCancel['tableCustomerId'];
        final orderTotal = orderToCancel['total'] ?? 0;
        final customerIndex =
            _currentCustomers.indexWhere((c) => c['id'] == customerId);
        if (customerIndex >= 0) {
          _currentCustomers[customerIndex]['total'] =
              (_currentCustomers[customerIndex]['total'] ?? 0) - orderTotal;
        }

        // Atualizar total da sessão
        if (_currentSession != null) {
          _currentSession!['total_amount'] =
              (_currentSession!['total_amount'] ?? 0) - orderTotal;
        }
      }

      // Remover da lista local
      _currentOrders.removeWhere((o) => o['id'] == orderId);
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Limpar pedidos pagos
  Future<bool> clearPaidOrders({
    required String sessionId,
    required String tableCustomerId,
    required String clearedBy,
  }) async {
    try {
      if (_sync.isOnline) {
        await _api.clearPaidOrders(
          sessionId: sessionId,
          tableCustomerId: tableCustomerId,
          clearedBy: clearedBy,
        );
      }

      // Remover pedidos pagos da lista local
      _currentOrders.removeWhere((o) {
        final customerId = o['table_customer_id'] ?? o['tableCustomerId'];
        final status = o['status'] ?? 'pending';
        return customerId == tableCustomerId && status == 'paid';
      });

      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Transferir item entre clientes
  Future<bool> transferOrder({
    required String orderId,
    required String fromCustomerId,
    required String toCustomerId,
    required int qtyUnits,
    required String transferredBy,
    int? displayQty, // Quantidade para exibição (Muntus ou unidades)
    String? productName, // Nome do produto
    bool? isMuntu, // Se é Muntu
    int? muntuQuantity, // Unidades por Muntu
  }) async {
    try {
      if (qtyUnits <= 0) {
        throw Exception('Quantidade inválida');
      }

      if (_sync.isOnline) {
        await _api.transferTableOrder(
          orderId: orderId,
          fromCustomerId: fromCustomerId,
          toCustomerId: toCustomerId,
          qtyUnits: qtyUnits,
          transferredBy: transferredBy,
        );

        // Recarregar sessão para refletir mudanças
        if (_currentSession != null) {
          await loadSession(_currentSession!['id']);
        }
      } else {
        final now = DateTime.now().toIso8601String();

        final orders = await _db.query(
          'table_orders',
          where: 'id = ?',
          whereArgs: [orderId],
          limit: 1,
        );
        if (orders.isEmpty) {
          throw Exception('Pedido não encontrado');
        }

        final order = orders.first;
        final sessionId = (order['session_id'] ?? '').toString();
        final currentQty = _asInt(order['qty_units']);
        if (qtyUnits > currentQty) {
          throw Exception('Quantidade maior que disponível');
        }

        final productId = (order['product_id'] ?? '').toString();
        final isMuntuOrder = isMuntu ?? (order['is_muntu'] == 1);
        final unitPricePerUnit = _asInt(order['unit_price']);

        final pricing = await _getLocalProductPricing(productId);
        final effectiveUnitPricePerUnit = unitPricePerUnit > 0
            ? unitPricePerUnit
            : _asInt(pricing?['price_unit'] ?? 0);

        if (qtyUnits == currentQty) {
          // Transferência total: mover o pedido para outro cliente
          await _db.update(
            'table_orders',
            {
              'table_customer_id': toCustomerId,
              'updated_at': now,
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [orderId],
          );
        } else {
          // Transferência parcial: dividir em 2 pedidos (localmente)
          final remainingQty = currentQty - qtyUnits;

          final remainingTotal = await _computeOrderTotal(
            productId: productId,
            qtyUnits: remainingQty,
            fallbackUnitPrice: effectiveUnitPricePerUnit,
            isMuntu: isMuntuOrder,
          );

          await _db.update(
            'table_orders',
            {
              'qty_units': remainingQty,
              'unit_price': effectiveUnitPricePerUnit,
              'subtotal': remainingTotal,
              'total': remainingTotal,
              'updated_at': now,
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [orderId],
          );

          final newOrderId = _uuid.v4();
          final transferredTotal = await _computeOrderTotal(
            productId: productId,
            qtyUnits: qtyUnits,
            fallbackUnitPrice: effectiveUnitPricePerUnit,
            isMuntu: isMuntuOrder,
          );

          // Garantir que temos o nome do produto
          String effectiveProductName =
              productName ?? order['product_name']?.toString() ?? '';
          if (effectiveProductName.isEmpty ||
              effectiveProductName == 'Produto') {
            final products = await _db.query(
              'products',
              where: 'id = ?',
              whereArgs: [productId],
            );
            if (products.isNotEmpty && products.first['name'] != null) {
              effectiveProductName = products.first['name'].toString();
            } else {
              effectiveProductName = 'Produto'; // Fallback final
            }
          }

          await _db.insert('table_orders', {
            'id': newOrderId,
            'session_id': sessionId,
            'table_customer_id': toCustomerId,
            'product_id': productId,
            'product_name': effectiveProductName,
            'qty_units': qtyUnits,
            'display_qty': displayQty ?? qtyUnits,
            'is_muntu': isMuntuOrder ? 1 : 0,
            'muntu_quantity': muntuQuantity ?? order['muntu_quantity'] ?? 3,
            'unit_price': effectiveUnitPricePerUnit,
            'unit_cost': _asInt(order['unit_cost']),
            'subtotal': transferredTotal,
            'total': transferredTotal,
            'status': order['status'] ?? 'pending',
            'notes': order['notes'],
            'ordered_by': order['ordered_by'] ?? transferredBy,
            'ordered_at': order['ordered_at'] ?? now,
            'updated_at': now,
            'synced': 0,
          });

          // Atualizar display_qty do pedido original
          final originalDisplayQty = _asInt(order['display_qty']);
          final newOriginalDisplayQty = originalDisplayQty - (displayQty ?? 0);
          if (newOriginalDisplayQty > 0) {
            await _db.update(
              'table_orders',
              {'display_qty': newOriginalDisplayQty},
              where: 'id = ?',
              whereArgs: [orderId],
            );
          }
        }

        // Recalcular totais locais
        await _recalculateSessionAndCustomersTotals(sessionId, now: now);

        // Enfileirar operação para sincronização
        await _sync.markForSync(
          entityType: 'table_order_transfer',
          entityId: orderId,
          action: 'transfer',
          data: {
            'orderId': orderId,
            'fromCustomerId': fromCustomerId,
            'toCustomerId': toCustomerId,
            'qtyUnits': qtyUnits,
            'transferredBy': transferredBy,
            'sessionId': sessionId,
          },
        );

        // Atualizar estado em memória
        if (_currentSession != null && _currentSession!['id'] == sessionId) {
          await loadSession(sessionId);
        }
      }

      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Transferir mesa para outra
  Future<bool> transferTable({
    required String sessionId,
    required String toTableId,
    required String transferredBy,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();
      final fromTableId =
          _currentSession?['table_id'] ?? _currentSession?['tableId'];

      if (_sync.isOnline) {
        await _api.transferTable(
          sessionId: sessionId,
          toTableId: toTableId,
          transferredBy: transferredBy,
        );
      } else {
        // ✅ CORREÇÃO BUG 3: Suporte offline para transferência de mesa
        debugPrint(
            '📦 [OFFLINE] Transferindo mesa de $fromTableId para $toTableId');

        // Atualizar sessão local para nova mesa
        await _db.update(
          'table_sessions',
          {
            'table_id': toTableId,
            'updated_at': now,
            'synced': 0,
          },
          where: 'id = ?',
          whereArgs: [sessionId],
        );

        // Atualizar status da mesa de origem para disponível
        if (fromTableId != null) {
          await _db.update(
            'tables',
            {'status': 'available', 'synced': 0},
            where: 'id = ?',
            whereArgs: [fromTableId],
          );
        }

        // Atualizar status da mesa destino para ocupada
        await _db.update(
          'tables',
          {'status': 'occupied', 'synced': 0},
          where: 'id = ?',
          whereArgs: [toTableId],
        );

        // Enfileirar para sincronização
        await _sync.markForSync(
          entityType: 'table_transfer',
          entityId: sessionId,
          action: 'transfer',
          data: {
            'sessionId': sessionId,
            'fromTableId': fromTableId,
            'toTableId': toTableId,
            'transferredBy': transferredBy,
          },
        );
        debugPrint('✅ [OFFLINE] Transferência de mesa enfileirada para sync');
      }

      // Atualizar lista de mesas em memória
      if (fromTableId != null) {
        final fromIdx = _tables.indexWhere((t) => t['id'] == fromTableId);
        if (fromIdx >= 0) {
          _tables[fromIdx] = Map<String, dynamic>.from(_tables[fromIdx]);
          _tables[fromIdx]['status'] = 'available';
          _tables[fromIdx]['current_session'] = null;
        }
      }
      final toIdx = _tables.indexWhere((t) => t['id'] == toTableId);
      if (toIdx >= 0) {
        _tables[toIdx] = Map<String, dynamic>.from(_tables[toIdx]);
        _tables[toIdx]['status'] = 'occupied';
      }

      _currentSession = null;
      _currentCustomers = [];
      _currentOrders = [];

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Transferir clientes selecionados para outra mesa
  Future<bool> transferCustomers({
    required String sessionId,
    required List<String> customerIds,
    required String toTableId,
    required String transferredBy,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();
      final branchId = _currentSession?['branch_id'] ??
          _currentSession?['branchId'] ??
          'main-branch';

      if (_sync.isOnline) {
        await _api.transferCustomers(
          sessionId: sessionId,
          customerIds: customerIds,
          toTableId: toTableId,
          transferredBy: transferredBy,
        );
      } else {
        // ✅ CORREÇÃO BUG 3: Suporte offline para transferência de clientes
        debugPrint(
            '📦 [OFFLINE] Transferindo ${customerIds.length} clientes para mesa $toTableId');

        // Verificar se já existe sessão aberta na mesa destino
        final existingSessions = await _db.query(
          'table_sessions',
          where: 'table_id = ? AND status = ?',
          whereArgs: [toTableId, 'open'],
        );

        String targetSessionId;
        if (existingSessions.isNotEmpty) {
          targetSessionId = existingSessions.first['id'].toString();
        } else {
          // Criar nova sessão na mesa destino
          targetSessionId = _uuid.v4();
          final sessionNumber = 'S${DateTime.now().millisecondsSinceEpoch}';
          await _db.insert('table_sessions', {
            'id': targetSessionId,
            'table_id': toTableId,
            'branch_id': branchId,
            'session_number': sessionNumber,
            'status': 'open',
            'opened_by': transferredBy,
            'total_amount': 0,
            'paid_amount': 0,
            'opened_at': now,
            'created_at': now,
            'updated_at': now,
            'synced': 0,
          });

          // Atualizar mesa destino para ocupada
          await _db.update(
            'tables',
            {'status': 'occupied', 'synced': 0},
            where: 'id = ?',
            whereArgs: [toTableId],
          );
        }

        // Mover clientes para nova sessão
        for (final customerId in customerIds) {
          await _db.update(
            'table_customers',
            {'session_id': targetSessionId, 'updated_at': now, 'synced': 0},
            where: 'id = ?',
            whereArgs: [customerId],
          );

          // Mover pedidos do cliente
          await _db.update(
            'table_orders',
            {'session_id': targetSessionId, 'updated_at': now, 'synced': 0},
            where: 'table_customer_id = ?',
            whereArgs: [customerId],
          );
        }

        // Recalcular totais das sessões
        await _recalculateSessionAndCustomersTotals(sessionId, now: now);
        await _recalculateSessionAndCustomersTotals(targetSessionId, now: now);

        // Enfileirar para sincronização
        await _sync.markForSync(
          entityType: 'table_customer_transfer',
          entityId: sessionId,
          action: 'transfer',
          data: {
            'sessionId': sessionId,
            'customerIds': customerIds,
            'toTableId': toTableId,
            'targetSessionId': targetSessionId,
            'transferredBy': transferredBy,
          },
        );
        debugPrint(
            '✅ [OFFLINE] Transferência de clientes enfileirada para sync');
      }

      // Remover clientes transferidos da lista local
      _currentCustomers.removeWhere((c) => customerIds.contains(c['id']));
      _currentOrders.removeWhere((o) {
        final customerId = o['table_customer_id'] ?? o['tableCustomerId'];
        return customerIds.contains(customerId);
      });

      // ✅ CORREÇÃO BUG SEPARAÇÃO: Atualizar lista de mesas em memória
      final toTableIdx = _tables.indexWhere((t) => t['id'] == toTableId);
      if (toTableIdx >= 0) {
        _tables[toTableIdx] = Map<String, dynamic>.from(_tables[toTableIdx]);
        _tables[toTableIdx]['status'] = 'occupied';
        debugPrint(
            '✅ Mesa destino $toTableId marcada como occupied em memória');
      }

      // Se não sobrou nenhum cliente, fechar sessão local
      if (_currentCustomers.isEmpty) {
        _currentSession = null;
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Unir mesas
  Future<bool> mergeTables({
    required List<String> sessionIds,
    required String targetTableId,
    required String mergedBy,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();
      final branchId = _currentSession?['branch_id'] ??
          _currentSession?['branchId'] ??
          'main-branch';

      if (_sync.isOnline) {
        await _api.mergeTables(
          sessionIds: sessionIds,
          targetTableId: targetTableId,
          mergedBy: mergedBy,
        );
      } else {
        // ✅ CORREÇÃO BUG 3: Suporte offline para merge de mesas
        debugPrint(
            '📦 [OFFLINE] Unindo ${sessionIds.length} mesas na mesa $targetTableId');

        if (sessionIds.isEmpty) {
          throw Exception('Nenhuma sessão para unir');
        }

        // Verificar se já existe sessão na mesa destino ou criar uma
        final existingSessions = await _db.query(
          'table_sessions',
          where: 'table_id = ? AND status = ?',
          whereArgs: [targetTableId, 'open'],
        );

        String targetSessionId;
        if (existingSessions.isNotEmpty) {
          targetSessionId = existingSessions.first['id'].toString();
        } else {
          targetSessionId = _uuid.v4();
          final sessionNumber = 'S${DateTime.now().millisecondsSinceEpoch}';
          await _db.insert('table_sessions', {
            'id': targetSessionId,
            'table_id': targetTableId,
            'branch_id': branchId,
            'session_number': sessionNumber,
            'status': 'open',
            'opened_by': mergedBy,
            'total_amount': 0,
            'paid_amount': 0,
            'opened_at': now,
            'created_at': now,
            'updated_at': now,
            'synced': 0,
          });
        }

        // Mover clientes e pedidos de todas as sessões para a sessão destino
        for (final sourceSessionId in sessionIds) {
          if (sourceSessionId == targetSessionId) continue;

          // Obter mesa de origem para liberar
          final sourceSession = await _db.query(
            'table_sessions',
            where: 'id = ?',
            whereArgs: [sourceSessionId],
          );
          final sourceTableId =
              sourceSession.isNotEmpty ? sourceSession.first['table_id'] : null;

          // Mover clientes
          await _db.update(
            'table_customers',
            {'session_id': targetSessionId, 'updated_at': now, 'synced': 0},
            where: 'session_id = ?',
            whereArgs: [sourceSessionId],
          );

          // Mover pedidos
          await _db.update(
            'table_orders',
            {'session_id': targetSessionId, 'updated_at': now, 'synced': 0},
            where: 'session_id = ?',
            whereArgs: [sourceSessionId],
          );

          // Fechar sessão de origem
          await _db.update(
            'table_sessions',
            {
              'status': 'closed',
              'closed_by': mergedBy,
              'closed_at': now,
              'updated_at': now,
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [sourceSessionId],
          );

          // Liberar mesa de origem
          if (sourceTableId != null) {
            await _db.update(
              'tables',
              {'status': 'available', 'synced': 0},
              where: 'id = ?',
              whereArgs: [sourceTableId],
            );
          }
        }

        // Atualizar mesa destino para ocupada
        await _db.update(
          'tables',
          {'status': 'occupied', 'synced': 0},
          where: 'id = ?',
          whereArgs: [targetTableId],
        );

        // Recalcular totais da sessão destino
        await _recalculateSessionAndCustomersTotals(targetSessionId, now: now);

        // Enfileirar para sincronização
        await _sync.markForSync(
          entityType: 'table_merge',
          entityId: sessionIds.first,
          action: 'merge',
          data: {
            'sessionIds': sessionIds,
            'targetTableId': targetTableId,
            'targetSessionId': targetSessionId,
            'mergedBy': mergedBy,
          },
        );
        debugPrint('✅ [OFFLINE] Merge de mesas enfileirado para sync');
      }

      _currentSession = null;
      _currentCustomers = [];
      _currentOrders = [];

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Separar mesa
  Future<bool> splitTable({
    required String sessionId,
    required List<Map<String, dynamic>> distributions,
    required String splitBy,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();

      // Descobrir branch_id da sessão de origem (se possível)
      String branchId = _currentSession?['branch_id'] ??
          _currentSession?['branchId'] ??
          'main-branch';
      try {
        final originSession = await _db.query(
          'table_sessions',
          where: 'id = ?',
          whereArgs: [sessionId],
          limit: 1,
        );
        if (originSession.isNotEmpty) {
          branchId = originSession.first['branch_id'] ??
              originSession.first['branchId'] ??
              branchId;
        }
      } catch (_) {}

      // Converter payload da UI (agrupado por mesa) para o formato do backend
      final flatDistributions = <Map<String, dynamic>>[];
      final targetTableIds = <String>[];
      for (final distribution in distributions) {
        final targetTableId = (distribution['tableId'] ?? '').toString();
        if (targetTableId.isEmpty) continue;
        targetTableIds.add(targetTableId);
        final customerIds =
            List<String>.from(distribution['customerIds'] ?? []);
        for (final customerId in customerIds) {
          if (customerId.isEmpty) continue;
          flatDistributions.add({
            'customerId': customerId,
            'targetTableId': targetTableId,
          });
        }
      }

      if (flatDistributions.isEmpty) {
        throw Exception('Selecione pelo menos um cliente para separar');
      }

      if (_sync.isOnline) {
        // Online: delegar ao backend (fonte da verdade) e recarregar
        await _api.splitTable(
          sessionId: sessionId,
          distributions: flatDistributions,
          splitBy: splitBy,
        );

        await loadTables(branchId: branchId);
      } else {
        // Offline: aplicar localmente e enfileirar operação de split
        final affectedSessionIds = <String>{sessionId};

        for (final distribution in distributions) {
          final targetTableId = (distribution['tableId'] ?? '').toString();
          if (targetTableId.isEmpty) continue;
          final customerIds =
              List<String>.from(distribution['customerIds'] ?? []);

          // Verificar se a mesa destino já tem sessão aberta
          final existingSessions = await _db.query(
            'table_sessions',
            where: 'table_id = ? AND status = ?',
            whereArgs: [targetTableId, 'open'],
            limit: 1,
          );

          String targetSessionId;
          if (existingSessions.isNotEmpty) {
            targetSessionId = existingSessions.first['id'];
          } else {
            // Criar nova sessão local apenas para UI (será reconciliada no sync)
            targetSessionId = _uuid.v4();
            final newSession = {
              'id': targetSessionId,
              'table_id': targetTableId,
              'branch_id': branchId,
              'session_number': 'S${DateTime.now().millisecondsSinceEpoch}',
              'status': 'open',
              'opened_by': splitBy,
              'total_amount': 0,
              'paid_amount': 0,
              'opened_at': now,
              'created_at': now,
              'updated_at': now,
              'synced': 0,
            };
            await _db.insert('table_sessions', newSession);
          }

          affectedSessionIds.add(targetSessionId);

          // Transferir cada cliente
          for (final customerId in customerIds) {
            final rows = await _db.rawQuery(
              'SELECT id FROM table_customers '
              'WHERE session_id = ? AND (id = ? OR customer_id = ?) '
              'LIMIT 1',
              [sessionId, customerId, customerId],
            );
            if (rows.isEmpty) continue;
            final tableCustomerRowId = rows.first['id']?.toString();
            if (tableCustomerRowId == null) continue;

            await _db.update(
              'table_customers',
              {
                'session_id': targetSessionId,
                'updated_at': now,
                'synced': 0,
              },
              where: 'id = ?',
              whereArgs: [tableCustomerRowId],
            );

            await _db.update(
              'table_orders',
              {
                'session_id': targetSessionId,
                'updated_at': now,
                'synced': 0,
              },
              where: 'session_id = ? AND table_customer_id = ?',
              whereArgs: [sessionId, tableCustomerRowId],
            );
          }

          // ✅ CORREÇÃO BUG SEPARAÇÃO: Atualizar status da mesa destino
          await _db.update(
            'tables',
            {'status': 'occupied', 'synced': 0},
            where: 'id = ?',
            whereArgs: [targetTableId],
          );

          // Atualizar mesa destino em memória
          final targetTableIdx =
              _tables.indexWhere((t) => t['id'] == targetTableId);
          if (targetTableIdx >= 0) {
            _tables[targetTableIdx] =
                Map<String, dynamic>.from(_tables[targetTableIdx]);
            _tables[targetTableIdx]['status'] = 'occupied';
          }
          debugPrint('✅ [OFFLINE] Mesa $targetTableId marcada como occupied');
        }

        for (final sid in affectedSessionIds) {
          await _recalculateSessionAndCustomersTotals(sid, now: now);
        }

        await _sync.markForSync(
          entityType: 'table_split',
          entityId: sessionId,
          action: 'split',
          data: {
            'sessionId': sessionId,
            'distributions': flatDistributions,
            'splitBy': splitBy,
            'branchId': branchId,
            'targetTableIds': targetTableIds,
          },
        );
      }

      _currentSession = null;
      _currentCustomers = [];
      _currentOrders = [];

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('❌ Erro no splitTable: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Carregar histórico de ações
  Future<void> loadSessionHistory(String sessionId) async {
    try {
      if (_sync.isOnline) {
        final history = await _api.getSessionHistory(sessionId);
        _sessionHistory =
            history.map((e) => Map<String, dynamic>.from(e)).toList();
      }
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Criar nova mesa
  Future<bool> createTable({
    required String branchId,
    required String number,
    int seats = 4,
    String? area,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();

      if (_sync.isOnline) {
        final result = await _api.createTable(
          branchId: branchId,
          number: number,
          seats: seats,
          area: area,
        );

        final newTable = Map<String, dynamic>.from(result);
        newTable['status'] = 'available';
        _tables.add(newTable);
        await _saveTableLocally(newTable);
      } else {
        final id = _uuid.v4();
        final newTable = {
          'id': id,
          'branch_id': branchId,
          'number': number,
          'seats': seats,
          'area': area,
          'status': 'available',
          'is_active': 1,
          'created_at': now,
          'updated_at': now,
          'synced': 0,
        };

        await _db.insert('tables', newTable);
        _tables.add(newTable);

        await _sync.markForSync(
          entityType: 'tables',
          entityId: id,
          action: 'create',
          data: newTable,
        );
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Carregar informações de crédito de um cliente
  Future<void> loadCustomerCredit(String customerId) async {
    try {
      if (_sync.isOnline) {
        final data = await _api.getCustomerCredit(customerId);
        if (data != null) {
          _customerCreditInfo[customerId] = {
            'creditLimit': data['credit_limit'] ?? data['creditLimit'] ?? 0,
            'currentDebt': data['current_debt'] ?? data['currentDebt'] ?? 0,
          };
          notifyListeners();
        }
      } else {
        // ✅ CORREÇÃO BUG VALE OFFLINE: Buscar crédito do banco local
        debugPrint(
            '📴 [OFFLINE] Buscando crédito do cliente $customerId do banco local');

        // Buscar dados do cliente local
        final customers = await _db.query(
          'customers',
          where: 'id = ?',
          whereArgs: [customerId],
        );

        if (customers.isNotEmpty) {
          final customer = customers.first;
          final creditLimit = _asInt(customer['credit_limit']);
          final currentDebt = _asInt(customer['current_debt']);

          debugPrint(
              '💳 [OFFLINE] Cliente $customerId - limit: $creditLimit, debt: $currentDebt');

          _customerCreditInfo[customerId] = {
            'creditLimit': creditLimit,
            'currentDebt': currentDebt,
          };
          notifyListeners();
        } else {
          debugPrint(
              '⚠️ [OFFLINE] Cliente $customerId não encontrado no banco local');
        }
      }
    } catch (e) {
      debugPrint('Erro ao carregar crédito: $e');
    }
  }

  /// Carregar vales pendentes dos clientes da sessão
  Future<void> loadCustomerDebts() async {
    try {
      final customerIds = _currentCustomers
          .where((c) => c['customer_id'] != null || c['customerId'] != null)
          .map((c) => (c['customer_id'] ?? c['customerId']) as String)
          .toList();

      if (customerIds.isEmpty) return;

      if (_sync.isOnline) {
        final debts = await _api.getCustomersPendingDebts(customerIds);
        _customerDebts =
            debts.map((e) => Map<String, dynamic>.from(e)).toList();
        notifyListeners();
      } else {
        // ✅ CORREÇÃO VALE OFFLINE: Buscar dívidas do banco local
        debugPrint('📴 [OFFLINE] Buscando dívidas dos clientes do banco local');

        final placeholders = customerIds.map((_) => '?').join(',');
        final debts = await _db.rawQuery(
          "SELECT * FROM debts WHERE customer_id IN ($placeholders) AND status = 'pending'",
          customerIds,
        );

        _customerDebts =
            debts.map((e) => Map<String, dynamic>.from(e)).toList();
        debugPrint(
            '💳 [OFFLINE] Encontradas ${_customerDebts.length} dívidas pendentes');
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Erro ao carregar vales: $e');
    }
  }

  /// Obter crédito disponível de um cliente
  int getAvailableCredit(String customerId) {
    final info = _customerCreditInfo[customerId];
    if (info == null) return 0;
    final limit = info['creditLimit'] ?? 0;
    final debt = info['currentDebt'] ?? 0;
    return limit - debt;
  }

  /// Verificar se cliente pode usar Vale
  bool canUseVale(String customerId, int amount) {
    return getAvailableCredit(customerId) >= amount;
  }

  /// Obter vales pendentes de um cliente
  List<Map<String, dynamic>> getCustomerPendingDebts(String customerId) {
    return _customerDebts.where((d) => d['customer_id'] == customerId).toList();
  }
}
