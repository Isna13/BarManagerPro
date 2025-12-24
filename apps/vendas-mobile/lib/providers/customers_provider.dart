import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';

class CustomersProvider extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final DatabaseService _db = DatabaseService.instance;

  List<Map<String, dynamic>> _customers = [];
  bool _isLoading = false;
  String? _error;
  String _searchQuery = '';

  List<Map<String, dynamic>> get customers => _customers;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<Map<String, dynamic>> get filteredCustomers {
    if (_searchQuery.isEmpty) return _customers;
    final query = _searchQuery.toLowerCase();
    return _customers.where((c) {
      final name = (c['name'] ?? '').toString().toLowerCase();
      final phone = (c['phone'] ?? '').toString().toLowerCase();
      final email = (c['email'] ?? '').toString().toLowerCase();
      return name.contains(query) ||
          phone.contains(query) ||
          email.contains(query);
    }).toList();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  Future<void> loadCustomers() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Primeiro tenta carregar da API
      try {
        final apiCustomers = await _api.getCustomers();
        if (apiCustomers.isNotEmpty) {
          _customers = apiCustomers.map((c) => _normalizeCustomer(c)).toList();

          // Salvar no banco local
          for (final customer in _customers) {
            try {
              await _db.insert('customers', {
                'id': customer['id'],
                'name': customer['name'],
                'phone': customer['phone'],
                'email': customer['email'],
                'address': customer['address'],
                'credit_limit': customer['creditLimit'] ?? 0,
                'current_debt': customer['currentDebt'] ?? 0,
                'loyalty_points': customer['loyaltyPoints'] ?? 0,
                'is_active': customer['isActive'] == true ? 1 : 0,
                'synced': 1,
              });
            } catch (_) {
              // Ignore duplicate errors
            }
          }
        }
      } catch (e) {
        // Se falhar a API, carregar do banco local
        debugPrint('Erro ao buscar clientes da API: $e');
      }

      // Carregar do banco local
      final localCustomers = await _db.query('customers',
          where: 'is_active = ?', whereArgs: [1], orderBy: 'name ASC');

      if (localCustomers.isNotEmpty) {
        _customers = localCustomers.map((c) => _normalizeCustomer(c)).toList();

        // Remover duplicatas baseado no ID
        final seen = <String>{};
        _customers = _customers.where((c) {
          final id = c['id']?.toString() ?? '';
          if (seen.contains(id)) return false;
          seen.add(id);
          return true;
        }).toList();
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Map<String, dynamic> _normalizeCustomer(Map<String, dynamic> c) {
    final name = c['name'] ?? c['fullName'] ?? c['full_name'] ?? '';
    return {
      'id': c['id'] ?? '',
      'name': name,
      'fullName': name,
      'phone': c['phone'] ?? '',
      'email': c['email'] ?? '',
      'address': c['address'] ?? '',
      'creditLimit': _parseToInt(c['credit_limit'] ?? c['creditLimit'] ?? 0),
      'currentDebt': _parseToInt(c['current_debt'] ?? c['currentDebt'] ?? 0),
      'loyaltyPoints':
          _parseToInt(c['loyalty_points'] ?? c['loyaltyPoints'] ?? 0),
      'isActive': c['is_active'] == 1 || c['isActive'] == true,
      'code': c['code'] ?? '',
    };
  }

  int _parseToInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  Map<String, dynamic>? getCustomerById(String id) {
    try {
      return _customers.firstWhere((c) => c['id'] == id);
    } catch (_) {
      return null;
    }
  }

  /// Calcula o crédito disponível para um cliente
  int getAvailableCredit(String customerId) {
    final customer = getCustomerById(customerId);
    if (customer == null) return 0;
    final creditLimit = customer['creditLimit'] as int? ?? 0;
    final currentDebt = customer['currentDebt'] as int? ?? 0;
    return creditLimit - currentDebt;
  }

  /// Verifica se o cliente pode usar Vale para um determinado valor
  bool canUseVale(String customerId, int amount) {
    final availableCredit = getAvailableCredit(customerId);
    return availableCredit >= amount;
  }

  /// Atualiza a dívida do cliente após uma venda Vale
  /// Sincroniza imediatamente com o servidor
  Future<void> updateCustomerDebt(
    String customerId,
    int addedDebt, {
    String? saleId,
    String? branchId,
  }) async {
    final index = _customers.indexWhere((c) => c['id'] == customerId);
    if (index >= 0) {
      final currentDebt = _customers[index]['currentDebt'] as int? ?? 0;
      final newDebt = currentDebt + addedDebt;
      _customers[index]['currentDebt'] = newDebt;

      // Atualizar no banco local
      await _db.update(
        'customers',
        {'current_debt': newDebt, 'synced': 0},
        where: 'id = ?',
        whereArgs: [customerId],
      );

      // Sincronizar dívida com o servidor
      try {
        await _api.createDebt({
          'customerId': customerId,
          'amount': addedDebt,
          'description': 'Venda a crédito (Vale)',
          'type': 'sale',
          if (saleId != null) 'saleId': saleId,
          if (branchId != null) 'branchId': branchId,
        });
        debugPrint(
            '✅ Dívida sincronizada: +$addedDebt para cliente $customerId');

        // Marcar como sincronizado
        await _db.update(
          'customers',
          {'synced': 1},
          where: 'id = ?',
          whereArgs: [customerId],
        );
      } catch (e) {
        debugPrint('❌ Erro ao sincronizar dívida: $e');
        // Não bloqueia - será sincronizado depois pela fila
      }

      notifyListeners();
    }
  }

  /// Adiciona pontos de fidelidade ao cliente após uma venda
  /// Retorna o número de pontos adicionados e o total atualizado
  /// Regra: 1 ponto para cada 1.000 FCFA gastos (valores em centavos)
  Future<Map<String, int>?> addLoyaltyPoints(
      String customerId, int saleAmount) async {
    final customer = getCustomerById(customerId);
    if (customer == null) return null;

    // Calcular pontos: 1 ponto para cada 1.000 FCFA (100000 centavos)
    // Ex: 1200 FCFA = 120000 centavos => 120000 ~/ 100000 = 1 ponto
    final pointsToAdd = saleAmount ~/ 100000;
    if (pointsToAdd <= 0) return null;

    final index = _customers.indexWhere((c) => c['id'] == customerId);
    if (index >= 0) {
      final currentPoints = _customers[index]['loyaltyPoints'] as int? ?? 0;
      final newTotal = currentPoints + pointsToAdd;
      _customers[index]['loyaltyPoints'] = newTotal;

      // Atualizar no banco local
      await _db.update(
        'customers',
        {'loyalty_points': newTotal, 'synced': 0},
        where: 'id = ?',
        whereArgs: [customerId],
      );

      // Tentar enviar para o servidor
      try {
        await _api.addLoyaltyPoints(
          customerId: customerId,
          points: pointsToAdd,
          reason: 'Pontos de compra',
        );
        // 🔴 CORREÇÃO: Marcar como sincronizado se sucesso
        await _db.update(
          'customers',
          {'synced': 1},
          where: 'id = ?',
          whereArgs: [customerId],
        );
      } catch (e) {
        debugPrint('Erro ao sincronizar pontos de fidelidade: $e');
        // 🔴 CORREÇÃO CRÍTICA: Adicionar à fila de sincronização para retry posterior
        await _db.addToSyncQueue(
          entityType: 'customer_loyalty',
          entityId: customerId,
          action: 'update',
          data: {
            'customerId': customerId,
            'pointsAdded': pointsToAdd,
            'reason': 'Pontos de compra',
          },
          priority: 50, // Prioridade baixa (após vendas)
        );
        debugPrint(
            '📤 Pontos adicionados à fila de sync: $pointsToAdd para $customerId');
      }

      notifyListeners();
      return {'added': pointsToAdd, 'total': newTotal};
    }
    return null;
  }
}
