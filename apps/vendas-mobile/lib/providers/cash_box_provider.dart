import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';

class CashBoxProvider extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final DatabaseService _db = DatabaseService.instance;
  final SyncService _sync = SyncService.instance;

  Map<String, dynamic>? _currentCashBox;
  List<Map<String, dynamic>> _history = [];
  bool _isLoading = false;
  String? _error;

  Map<String, dynamic>? get currentCashBox => _currentCashBox;
  List<Map<String, dynamic>> get history => _history;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasOpenCashBox =>
      _currentCashBox != null && _currentCashBox!['status'] == 'open';

  Future<void> loadCurrentCashBox() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Tentar carregar do servidor primeiro
      if (_sync.isOnline) {
        final result = await _api.getCurrentCashBox();
        _currentCashBox = result;

        // Salvar localmente se houver caixa aberto
        if (_currentCashBox != null) {
          await _saveCashBoxLocally(_currentCashBox!);
        }
      } else {
        // Offline: carregar do banco local
        final results = await _db.query(
          'cash_boxes',
          where: 'status = ?',
          whereArgs: ['open'],
          orderBy: 'opened_at DESC',
          limit: 1,
        );
        _currentCashBox = results.isNotEmpty ? results.first : null;
      }
    } catch (e) {
      _error = e.toString();

      // Fallback para banco local
      try {
        final results = await _db.query(
          'cash_boxes',
          where: 'status = ?',
          whereArgs: ['open'],
          orderBy: 'opened_at DESC',
          limit: 1,
        );
        _currentCashBox = results.isNotEmpty ? results.first : null;
      } catch (_) {}
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadHistory({int limit = 20}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      if (_sync.isOnline) {
        final results = await _api.getCashBoxHistory(limit: limit);
        _history = results.map((e) => Map<String, dynamic>.from(e)).toList();

        // Salvar histórico localmente
        for (final cashBox in _history) {
          await _saveCashBoxLocally(cashBox);
        }
      } else {
        // Offline: carregar do banco local
        final results = await _db.query(
          'cash_boxes',
          where: 'status = ?',
          whereArgs: ['closed'],
          orderBy: 'closed_at DESC',
          limit: limit,
        );
        _history = results;
      }
    } catch (e) {
      _error = e.toString();

      // Fallback para banco local
      try {
        final results = await _db.query(
          'cash_boxes',
          where: 'status = ?',
          whereArgs: ['closed'],
          orderBy: 'closed_at DESC',
          limit: limit,
        );
        _history = results;
      } catch (_) {}
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> openCashBox({
    required String boxNumber,
    required String branchId,
    required String openedBy,
    required int openingCash,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final now = DateTime.now().toIso8601String();
      final id = 'cb_${DateTime.now().millisecondsSinceEpoch}';

      if (_sync.isOnline) {
        final result = await _api.openCashBox(
          boxNumber: boxNumber,
          branchId: branchId,
          openedBy: openedBy,
          openingCash: openingCash,
        );
        _currentCashBox = Map<String, dynamic>.from(result);
        await _saveCashBoxLocally(_currentCashBox!);
      } else {
        // Criar localmente
        _currentCashBox = {
          'id': id,
          'box_number': boxNumber,
          'branch_id': branchId,
          'opened_by': openedBy,
          'status': 'open',
          'opening_cash': openingCash,
          'total_sales': 0,
          'total_cash': 0,
          'total_card': 0,
          'total_mobile_money': 0,
          'total_debt': 0,
          'opened_at': now,
          'synced': 0,
        };

        await _db.insert('cash_boxes', _currentCashBox!);

        // Adicionar à fila de sincronização
        await _sync.markForSync(
          entityType: 'cash_boxes',
          entityId: id,
          action: 'create',
          data: _currentCashBox,
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

  Future<bool> closeCashBox({
    required int closingCash,
    required String closedBy,
    String? notes,
  }) async {
    if (_currentCashBox == null) {
      _error = 'Nenhum caixa aberto';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final id = _currentCashBox!['id'] ?? _currentCashBox!['boxNumber'];
      final expectedCash = ((_currentCashBox!['opening_cash'] ??
                  _currentCashBox!['openingCash'] ??
                  0) as num)
              .toInt() +
          ((_currentCashBox!['total_cash'] ??
                  _currentCashBox!['totalCash'] ??
                  0) as num)
              .toInt();
      final difference = closingCash - expectedCash;
      final now = DateTime.now().toIso8601String();

      if (_sync.isOnline) {
        final result = await _api.closeCashBox(
          id.toString(),
          closingCash: closingCash,
          difference: difference,
          closedBy: closedBy,
          notes: notes,
        );

        _currentCashBox = Map<String, dynamic>.from(result);
        await _saveCashBoxLocally(_currentCashBox!);
      } else {
        // Fechar localmente
        _currentCashBox!['status'] = 'closed';
        _currentCashBox!['closing_cash'] = closingCash;
        _currentCashBox!['difference'] = difference;
        _currentCashBox!['closed_by'] = closedBy;
        _currentCashBox!['notes'] = notes;
        _currentCashBox!['closed_at'] = now;
        _currentCashBox!['synced'] = 0;

        await _db.update(
          'cash_boxes',
          _currentCashBox!,
          where: 'id = ?',
          whereArgs: [id],
        );

        // Adicionar à fila de sincronização
        await _sync.markForSync(
          entityType: 'cash_boxes',
          entityId: id.toString(),
          action: 'update',
          data: _currentCashBox,
        );
      }

      // Adicionar ao histórico e limpar caixa atual
      _history.insert(0, Map<String, dynamic>.from(_currentCashBox!));
      _currentCashBox = null;

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

  Future<void> updateCashBoxTotals({
    int? cashAmount,
    int? cardAmount,
    int? mobileMoneyAmount,
    int? debtAmount,
  }) async {
    if (_currentCashBox == null) return;

    final id = _currentCashBox!['id'];

    if (cashAmount != null) {
      _currentCashBox!['total_cash'] =
          (_currentCashBox!['total_cash'] ?? 0) + cashAmount;
    }
    if (cardAmount != null) {
      _currentCashBox!['total_card'] =
          (_currentCashBox!['total_card'] ?? 0) + cardAmount;
    }
    if (mobileMoneyAmount != null) {
      _currentCashBox!['total_mobile_money'] =
          (_currentCashBox!['total_mobile_money'] ?? 0) + mobileMoneyAmount;
    }
    if (debtAmount != null) {
      _currentCashBox!['total_debt'] =
          (_currentCashBox!['total_debt'] ?? 0) + debtAmount;
    }

    _currentCashBox!['total_sales'] = (_currentCashBox!['total_cash'] ?? 0) +
        (_currentCashBox!['total_card'] ?? 0) +
        (_currentCashBox!['total_mobile_money'] ?? 0);

    _currentCashBox!['synced'] = 0;

    await _db.update(
      'cash_boxes',
      _currentCashBox!,
      where: 'id = ?',
      whereArgs: [id],
    );

    notifyListeners();
  }

  Future<void> _saveCashBoxLocally(Map<String, dynamic> cashBox) async {
    final mappedData = <String, dynamic>{
      'id': cashBox['id'] ?? cashBox['boxNumber'],
      'box_number': cashBox['boxNumber'] ?? cashBox['box_number'],
      'branch_id': cashBox['branchId'] ?? cashBox['branch_id'],
      'opened_by': cashBox['openedBy'] ?? cashBox['opened_by'],
      'closed_by': cashBox['closedBy'] ?? cashBox['closed_by'],
      'status': cashBox['status'],
      'opening_cash': cashBox['openingCash'] ?? cashBox['opening_cash'] ?? 0,
      'total_sales': cashBox['totalSales'] ?? cashBox['total_sales'] ?? 0,
      'total_cash': cashBox['totalCash'] ?? cashBox['total_cash'] ?? 0,
      'total_card': cashBox['totalCard'] ?? cashBox['total_card'] ?? 0,
      'total_mobile_money':
          cashBox['totalMobileMoney'] ?? cashBox['total_mobile_money'] ?? 0,
      'total_debt': cashBox['totalDebt'] ?? cashBox['total_debt'] ?? 0,
      'closing_cash': cashBox['closingCash'] ?? cashBox['closing_cash'],
      'difference': cashBox['difference'],
      'notes': cashBox['notes'],
      'opened_at': cashBox['openedAt'] ?? cashBox['opened_at'],
      'closed_at': cashBox['closedAt'] ?? cashBox['closed_at'],
      'synced': 1,
    };

    await _db.insert('cash_boxes', mappedData);
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
