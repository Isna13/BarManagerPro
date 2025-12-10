import 'package:flutter/foundation.dart';
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
  bool _isLoading = false;
  String? _error;

  List<Map<String, dynamic>> get tables => _tables;
  List<Map<String, dynamic>> get sessions => _sessions;
  Map<String, dynamic>? get currentSession => _currentSession;
  List<Map<String, dynamic>> get currentCustomers => _currentCustomers;
  List<Map<String, dynamic>> get currentOrders => _currentOrders;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadTables({String? branchId}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      if (_sync.isOnline && branchId != null) {
        final results = await _api.getTablesOverview(branchId);
        _tables = results.map((e) => Map<String, dynamic>.from(e)).toList();

        for (final table in _tables) {
          await _saveTableLocally(table);

          // Se mesa tem sessão ativa, salvar também
          if (table['currentSession'] != null) {
            await _saveSessionLocally(table['currentSession']);
          }
        }
      } else {
        // Carregar do banco local
        final results = await _db.query(
          'tables',
          where: branchId != null ? 'branch_id = ?' : null,
          whereArgs: branchId != null ? [branchId] : null,
          orderBy: 'number ASC',
        );
        _tables = results;

        // Carregar sessões ativas para cada mesa
        for (int i = 0; i < _tables.length; i++) {
          final tableId = _tables[i]['id'];
          final sessions = await _db.query(
            'table_sessions',
            where: 'table_id = ? AND status = ?',
            whereArgs: [tableId, 'open'],
            limit: 1,
          );

          if (sessions.isNotEmpty) {
            _tables[i]['current_session'] = sessions.first;
          }
        }
      }
    } catch (e) {
      _error = e.toString();

      // Fallback para banco local
      try {
        final results = await _db.query('tables', orderBy: 'number ASC');
        _tables = results;
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

      // Atualizar status da mesa
      final tableIndex = _tables.indexWhere((t) => t['id'] == tableId);
      if (tableIndex >= 0) {
        _tables[tableIndex]['status'] = 'occupied';
        _tables[tableIndex]['current_session'] = _currentSession;
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
      final total = unitPrice * quantity;

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
        await _saveOrderLocally(order);
      } else {
        order = {
          'id': id,
          'session_id': sessionId,
          'table_customer_id': tableCustomerId,
          'product_id': productId,
          'product_name': productName,
          'qty_units': quantity,
          'is_muntu': isMuntu ? 1 : 0,
          'unit_price': unitPrice,
          'subtotal': total,
          'total': total,
          'status': 'pending',
          'ordered_by': orderedBy,
          'ordered_at': now,
          'synced': 0,
        };

        await _db.insert('table_orders', order);

        await _sync.markForSync(
          entityType: 'table_orders',
          entityId: id,
          action: 'create',
          data: order,
        );

        // Atualizar total do cliente
        final customerIndex =
            _currentCustomers.indexWhere((c) => c['id'] == tableCustomerId);
        if (customerIndex >= 0) {
          _currentCustomers[customerIndex]['subtotal'] =
              (_currentCustomers[customerIndex]['subtotal'] ?? 0) + total;
          _currentCustomers[customerIndex]['total'] =
              (_currentCustomers[customerIndex]['total'] ?? 0) + total;

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
      if (_sync.isOnline) {
        await _api.processTablePayment(
          sessionId: sessionId,
          tableCustomerId: tableCustomerId,
          method: method,
          amount: amount,
          processedBy: processedBy,
          isSessionPayment: isSessionPayment,
        );
      }

      if (isSessionPayment) {
        // Pagamento da sessão inteira
        if (_currentSession != null) {
          _currentSession!['paid_amount'] =
              (_currentSession!['paid_amount'] ?? 0) + amount;

          final totalAmount = _currentSession!['total_amount'] ?? 0;
          if (_currentSession!['paid_amount'] >= totalAmount) {
            _currentSession!['status'] = 'closed';
          }
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
        }
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
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
