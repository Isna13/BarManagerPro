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
              _currentOrders.add(Map<String, dynamic>.from(order));
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
        _currentSession = sessions.isNotEmpty ? sessions.first : null;

        if (_currentSession != null) {
          _currentCustomers = await _db.query(
            'table_customers',
            where: 'session_id = ?',
            whereArgs: [sessionId],
          );

          _currentOrders = await _db.query(
            'table_orders',
            where: 'session_id = ?',
            whereArgs: [sessionId],
          );
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

      Map<String, dynamic> order;

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
        // Garantir que product_name está na ordem
        order['product_name'] = productName;
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
          'is_muntu': isMuntu ? 1 : 0,
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

          final total = _currentCustomers[customerIndex]['total'] ?? 0;
          if (_currentCustomers[customerIndex]['paid_amount'] >= total) {
            _currentCustomers[customerIndex]['payment_status'] = 'paid';

            // Marcar pedidos como pagos
            for (final order in _currentOrders) {
              if (order['table_customer_id'] == tableCustomerId) {
                order['status'] = 'paid';
              }
            }
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

        customerId = tableCustomer['customer_id'] as String?;
        customerName = tableCustomer['customer_name'] as String? ??
            tableCustomer['customerName'] as String?;

        debugPrint('🔍 customer_id: $customerId');
        debugPrint('🔍 customer_name: $customerName');
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
      // ✅ CORREÇÃO: Criar dívida automaticamente para pagamento VALE
      // Isso garante que toda venda VALE gera uma dívida associada
      // ═══════════════════════════════════════════════════════════════════
      if (normalizedMethod == 'VALE' && customerId != null) {
        debugPrint('💳 [VALE] Criando dívida para venda $saleId');
        debugPrint('   Cliente: $customerId ($customerName)');
        debugPrint('   Valor: $amount');

        try {
          await _api.createDebt({
            'customerId': customerId,
            'amount': amount,
            'saleId': saleId,
            'branchId': branchId,
            'description': 'Vale referente à venda de mesa $saleNumber',
          });
          debugPrint('✅ Dívida criada com sucesso para venda $saleId');
        } catch (e) {
          debugPrint('❌ Erro ao criar dívida: $e');
          // Não bloqueia - a venda foi criada, dívida será sincronizada depois
        }
      }
      // ===========================================================

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
    final mappedData = <String, dynamic>{
      'id': order['id'],
      'session_id': order['sessionId'] ?? order['session_id'],
      'table_customer_id':
          order['tableCustomerId'] ?? order['table_customer_id'],
      'product_id': order['productId'] ?? order['product_id'],
      'product_name':
          order['productName'] ?? order['product_name'] ?? 'Produto',
      'qty_units': order['qtyUnits'] ?? order['qty_units'] ?? 1,
      'is_muntu': (order['isMuntu'] ?? order['is_muntu']) == true ? 1 : 0,
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
          _tables[tableIndex]['status'] = 'available';
          _tables[tableIndex]['current_session'] = null;
          _tables[tableIndex]['currentSession'] = null;
        }
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
      if (_sync.isOnline) {
        await _api.cancelTableOrder(
          orderId: orderId,
          cancelledBy: cancelledBy,
        );
      } else {
        // Atualizar localmente
        final orderIndex = _currentOrders.indexWhere((o) => o['id'] == orderId);
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

          // Atualizar total do cliente
          final customerId =
              order['table_customer_id'] ?? order['tableCustomerId'];
          final orderTotal = order['total'] ?? 0;
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
        final isMuntu = (order['is_muntu'] == 1);
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
            isMuntu: isMuntu,
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
            isMuntu: isMuntu,
          );

          await _db.insert('table_orders', {
            'id': newOrderId,
            'session_id': sessionId,
            'table_customer_id': toCustomerId,
            'product_id': productId,
            'qty_units': qtyUnits,
            'is_muntu': isMuntu ? 1 : 0,
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
      if (_sync.isOnline) {
        await _api.transferTable(
          sessionId: sessionId,
          toTableId: toTableId,
          transferredBy: transferredBy,
        );
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
      if (_sync.isOnline) {
        await _api.transferCustomers(
          sessionId: sessionId,
          customerIds: customerIds,
          toTableId: toTableId,
          transferredBy: transferredBy,
        );
      }

      // Remover clientes transferidos da lista local
      _currentCustomers.removeWhere((c) => customerIds.contains(c['id']));
      _currentOrders.removeWhere((o) {
        final customerId = o['table_customer_id'] ?? o['tableCustomerId'];
        return customerIds.contains(customerId);
      });

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
      if (_sync.isOnline) {
        await _api.mergeTables(
          sessionIds: sessionIds,
          targetTableId: targetTableId,
          mergedBy: mergedBy,
        );
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

      if (customerIds.isNotEmpty && _sync.isOnline) {
        final debts = await _api.getCustomersPendingDebts(customerIds);
        _customerDebts =
            debts.map((e) => Map<String, dynamic>.from(e)).toList();
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
