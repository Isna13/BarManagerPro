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
  int _localSalesCount = 0;

  Map<String, dynamic>? get currentCashBox => _currentCashBox;
  List<Map<String, dynamic>> get history => _history;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get localSalesCount => _localSalesCount;
  bool get hasOpenCashBox =>
      _currentCashBox != null && _currentCashBox!['status'] == 'open';

  /// Normaliza os campos do caixa para snake_case (formato do banco local)
  /// Usa os valores de stats quando disponíveis (são calculados em tempo real pelo servidor)
  Map<String, dynamic> _normalizeToSnakeCase(Map<String, dynamic> cashBox) {
    final stats = cashBox['stats'] as Map<String, dynamic>? ?? {};

    // Usar stats se disponíveis (são os valores mais atualizados do servidor)
    final totalCash = stats['cashPayments'] ??
        cashBox['totalCash'] ??
        cashBox['total_cash'] ??
        0;
    final totalCard = stats['cardPayments'] ??
        cashBox['totalCard'] ??
        cashBox['total_card'] ??
        0;
    final totalMobile = stats['mobileMoneyPayments'] ??
        cashBox['totalMobileMoney'] ??
        cashBox['total_mobile_money'] ??
        0;
    final totalDebt = stats['debtPayments'] ??
        cashBox['totalDebt'] ??
        cashBox['total_debt'] ??
        0;
    final totalSales = stats['totalSales'] ??
        cashBox['totalSales'] ??
        cashBox['total_sales'] ??
        0;

    return {
      'id': cashBox['id'] ?? cashBox['boxNumber'],
      'box_number': cashBox['boxNumber'] ?? cashBox['box_number'],
      'branch_id': cashBox['branchId'] ?? cashBox['branch_id'],
      'opened_by': cashBox['openedBy'] ?? cashBox['opened_by'],
      'closed_by': cashBox['closedBy'] ?? cashBox['closed_by'],
      'status': cashBox['status'],
      'opening_cash': cashBox['openingCash'] ?? cashBox['opening_cash'] ?? 0,
      'total_sales': totalSales,
      'total_cash': totalCash,
      'total_card': totalCard,
      'total_mobile_money': totalMobile,
      'total_debt': totalDebt,
      'closing_cash': cashBox['closingCash'] ?? cashBox['closing_cash'],
      'difference': cashBox['difference'],
      'notes': cashBox['notes'],
      'opened_at': cashBox['openedAt'] ?? cashBox['opened_at'],
      'closed_at': cashBox['closedAt'] ?? cashBox['closed_at'],
      'synced': 1, // Veio do servidor, está sincronizado
      // Manter stats se existir (para exibição)
      'stats': cashBox['stats'],
    };
  }

  Future<void> loadCurrentCashBox() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // SEMPRE carregar primeiro do banco local
      final localResults = await _db.query(
        'cash_boxes',
        where: 'status = ?',
        whereArgs: ['open'],
        orderBy: 'opened_at DESC',
        limit: 1,
      );
      Map<String, dynamic>? localCashBox = localResults.isNotEmpty
          ? Map<String, dynamic>.from(localResults.first)
          : null;

      debugPrint(
          '📦 Caixa local: ${localCashBox != null ? "encontrado (synced=${localCashBox['synced']})" : "não encontrado"}');

      if (localCashBox != null) {
        debugPrint(
            '📦 Totais locais: cash=${localCashBox['total_cash']}, mobile=${localCashBox['total_mobile_money']}, total=${localCashBox['total_sales']}');
      }

      if (_sync.isOnline) {
        final result = await _api.getCurrentCashBox();

        if (result != null) {
          debugPrint('🔍 Resposta bruta do servidor: $result');
          debugPrint('🔍 Stats do servidor: ${result['stats']}');

          final serverCashBox = _normalizeToSnakeCase(result);
          final serverId = serverCashBox['id'];

          debugPrint(
              '🌐 Caixa normalizado: id=$serverId, cash=${serverCashBox['total_cash']}, mobile=${serverCashBox['total_mobile_money']}');

          // Verificar se já temos este caixa localmente
          if (localCashBox != null && localCashBox['id'] == serverId) {
            // MESMO CAIXA
            if (localCashBox['synced'] == 0) {
              // Caixa local tem vendas NÃO sincronizadas
              // Precisamos SOMAR: valores do servidor + incrementos locais
              debugPrint('🔄 Caixa com vendas locais não sincronizadas');

              // Calcular incrementos locais (diferença entre local e o que foi sincronizado antes)
              // Usar o MAIOR valor para evitar perda de dados
              final serverCash = (serverCashBox['total_cash'] ?? 0) as num;
              final localCash = (localCashBox['total_cash'] ?? 0) as num;
              final serverMobile =
                  (serverCashBox['total_mobile_money'] ?? 0) as num;
              final localMobile =
                  (localCashBox['total_mobile_money'] ?? 0) as num;
              final serverCard = (serverCashBox['total_card'] ?? 0) as num;
              final localCard = (localCashBox['total_card'] ?? 0) as num;
              final serverDebt = (serverCashBox['total_debt'] ?? 0) as num;
              final localDebt = (localCashBox['total_debt'] ?? 0) as num;

              // Se o valor local é maior, significa que temos vendas locais não sincronizadas
              // Nesse caso, mantemos o valor local
              // Se o servidor é maior, alguém fez vendas em outro dispositivo
              final finalCash = localCash > serverCash ? localCash : serverCash;
              final finalMobile =
                  localMobile > serverMobile ? localMobile : serverMobile;
              final finalCard = localCard > serverCard ? localCard : serverCard;
              final finalDebt = localDebt > serverDebt ? localDebt : serverDebt;

              _currentCashBox = {
                ...serverCashBox,
                'total_cash': finalCash.toInt(),
                'total_card': finalCard.toInt(),
                'total_mobile_money': finalMobile.toInt(),
                'total_debt': finalDebt.toInt(),
                'total_sales': (finalCash + finalCard + finalMobile).toInt(),
                'synced': 0,
              };

              debugPrint(
                  '📦 Totais mesclados: cash=$finalCash, mobile=$finalMobile');
            } else {
              // Caixa local está sincronizado - usar valores do servidor (mais recentes)
              debugPrint('✅ Caixa sincronizado - usando valores do servidor');
              _currentCashBox = serverCashBox;

              // Atualizar banco local com valores do servidor
              await _saveCashBoxLocally(result);
            }
          } else {
            // CAIXA NOVO do servidor (ou primeiro sync)
            debugPrint('🆕 Novo caixa do servidor - salvando localmente');
            _currentCashBox = serverCashBox;

            // Fechar qualquer caixa local antigo
            if (localCashBox != null) {
              await _db.update(
                'cash_boxes',
                {
                  'status': 'closed',
                  'closed_at': DateTime.now().toIso8601String()
                },
                where: 'id = ?',
                whereArgs: [localCashBox['id']],
              );
            }

            // Salvar novo caixa localmente
            await _saveCashBoxLocally(result);
          }
        } else {
          // Servidor não tem caixa aberto
          debugPrint('🌐 Servidor não tem caixa aberto');
          
          // Se temos caixa local aberto mas servidor não tem, significa que foi fechado
          // em outro dispositivo (ex: Electron) - precisamos fechar localmente também
          if (localCashBox != null && localCashBox['synced'] == 1) {
            debugPrint('⚠️ Caixa local aberto mas servidor fechado - fechando localmente');
            
            // Fechar o caixa local
            await _db.update(
              'cash_boxes',
              {
                'status': 'closed',
                'closed_at': DateTime.now().toIso8601String(),
                'synced': 1, // Já está sincronizado com servidor
              },
              where: 'id = ?',
              whereArgs: [localCashBox['id']],
            );
            
            // Adicionar ao histórico e limpar caixa atual
            _history.insert(0, {
              ...localCashBox,
              'status': 'closed',
              'closed_at': DateTime.now().toIso8601String(),
            });
            _currentCashBox = null;
            debugPrint('✅ Caixa local fechado para corresponder ao servidor');
          } else if (localCashBox != null && localCashBox['synced'] == 0) {
            // Caixa local tem vendas não sincronizadas - manter aberto
            debugPrint('⚠️ Caixa local tem dados não sincronizados - mantendo aberto');
            _currentCashBox = localCashBox;
          } else {
            _currentCashBox = null;
          }
        }
      } else {
        // Offline: usar banco local
        debugPrint('📴 Offline - usando banco local');
        _currentCashBox = localCashBox;
      }

      if (_currentCashBox != null) {
        debugPrint(
            '📦 Caixa final: total_cash=${_currentCashBox!['total_cash']}, total_mobile=${_currentCashBox!['total_mobile_money']}, total_sales=${_currentCashBox!['total_sales']}');

        // Contar vendas locais para este caixa
        await _countLocalSales();
      }
    } catch (e) {
      _error = e.toString();
      debugPrint('❌ Erro ao carregar caixa: $e');

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
    if (_currentCashBox == null) {
      debugPrint('❌ updateCashBoxTotals: caixa é null! Tentando carregar...');
      // Tentar carregar caixa do banco local
      final localResults = await _db.query(
        'cash_boxes',
        where: 'status = ?',
        whereArgs: ['open'],
        orderBy: 'opened_at DESC',
        limit: 1,
      );
      if (localResults.isNotEmpty) {
        _currentCashBox = Map<String, dynamic>.from(localResults.first);
        debugPrint(
            '✅ Caixa carregado do banco local: ${_currentCashBox!['id']}');
      } else {
        debugPrint('❌ Nenhum caixa aberto encontrado no banco local!');
        return;
      }
    }

    final id = _currentCashBox!['id'];
    debugPrint(
        '📦 updateCashBoxTotals: id=$id, cash=$cashAmount, card=$cardAmount, mobile=$mobileMoneyAmount, debt=$debtAmount');

    // Converter valores existentes para int de forma segura
    int currentCash = (_currentCashBox!['total_cash'] ?? 0) is int
        ? _currentCashBox!['total_cash'] ?? 0
        : ((_currentCashBox!['total_cash'] ?? 0) as num).toInt();
    int currentCard = (_currentCashBox!['total_card'] ?? 0) is int
        ? _currentCashBox!['total_card'] ?? 0
        : ((_currentCashBox!['total_card'] ?? 0) as num).toInt();
    int currentMobile = (_currentCashBox!['total_mobile_money'] ?? 0) is int
        ? _currentCashBox!['total_mobile_money'] ?? 0
        : ((_currentCashBox!['total_mobile_money'] ?? 0) as num).toInt();
    int currentDebt = (_currentCashBox!['total_debt'] ?? 0) is int
        ? _currentCashBox!['total_debt'] ?? 0
        : ((_currentCashBox!['total_debt'] ?? 0) as num).toInt();

    if (cashAmount != null) {
      currentCash += cashAmount;
      _currentCashBox!['total_cash'] = currentCash;
    }
    if (cardAmount != null) {
      currentCard += cardAmount;
      _currentCashBox!['total_card'] = currentCard;
    }
    if (mobileMoneyAmount != null) {
      currentMobile += mobileMoneyAmount;
      _currentCashBox!['total_mobile_money'] = currentMobile;
    }
    if (debtAmount != null) {
      currentDebt += debtAmount;
      _currentCashBox!['total_debt'] = currentDebt;
    }

    _currentCashBox!['total_sales'] = currentCash + currentCard + currentMobile;
    _currentCashBox!['synced'] = 0;

    debugPrint(
        '📦 Novos totais: cash=$currentCash, card=$currentCard, mobile=$currentMobile, debt=$currentDebt, total=${_currentCashBox!['total_sales']}');

    // Mapear apenas os campos válidos para o banco
    final dataToSave = {
      'id': _currentCashBox!['id'],
      'box_number':
          _currentCashBox!['box_number'] ?? _currentCashBox!['boxNumber'],
      'branch_id':
          _currentCashBox!['branch_id'] ?? _currentCashBox!['branchId'],
      'opened_by':
          _currentCashBox!['opened_by'] ?? _currentCashBox!['openedBy'],
      'closed_by':
          _currentCashBox!['closed_by'] ?? _currentCashBox!['closedBy'],
      'status': _currentCashBox!['status'] ?? 'open',
      'opening_cash': _currentCashBox!['opening_cash'] ??
          _currentCashBox!['openingCash'] ??
          0,
      'total_sales': _currentCashBox!['total_sales'] ?? 0,
      'total_cash': _currentCashBox!['total_cash'] ?? 0,
      'total_card': _currentCashBox!['total_card'] ?? 0,
      'total_mobile_money': _currentCashBox!['total_mobile_money'] ?? 0,
      'total_debt': _currentCashBox!['total_debt'] ?? 0,
      'closing_cash':
          _currentCashBox!['closing_cash'] ?? _currentCashBox!['closingCash'],
      'difference': _currentCashBox!['difference'],
      'notes': _currentCashBox!['notes'],
      'opened_at':
          _currentCashBox!['opened_at'] ?? _currentCashBox!['openedAt'],
      'closed_at':
          _currentCashBox!['closed_at'] ?? _currentCashBox!['closedAt'],
      'synced': 0,
    };

    try {
      // Usar INSERT com REPLACE para garantir que o registro existe
      // Isso funciona tanto para criar quanto para atualizar
      await _db.insert('cash_boxes', dataToSave);
      debugPrint('✅ Caixa salvo no banco (id=$id)');
    } catch (e) {
      debugPrint('❌ Erro ao salvar caixa: $e');
      // Tentar update como fallback
      try {
        await _db.update(
          'cash_boxes',
          dataToSave,
          where: 'id = ?',
          whereArgs: [id],
        );
        debugPrint('✅ Caixa atualizado via update (id=$id)');
      } catch (e2) {
        debugPrint('❌ Erro ao atualizar caixa: $e2');
      }
    }

    notifyListeners();
    debugPrint('✅ notifyListeners chamado');
  }

  Future<void> _saveCashBoxLocally(Map<String, dynamic> cashBox) async {
    final stats = cashBox['stats'] as Map<String, dynamic>? ?? {};

    // Usar stats se disponíveis (são os valores mais atualizados do servidor)
    final totalCash = stats['cashPayments'] ??
        cashBox['totalCash'] ??
        cashBox['total_cash'] ??
        0;
    final totalCard = stats['cardPayments'] ??
        cashBox['totalCard'] ??
        cashBox['total_card'] ??
        0;
    final totalMobile = stats['mobileMoneyPayments'] ??
        cashBox['totalMobileMoney'] ??
        cashBox['total_mobile_money'] ??
        0;
    final totalDebt = stats['debtPayments'] ??
        cashBox['totalDebt'] ??
        cashBox['total_debt'] ??
        0;
    final totalSales = stats['totalSales'] ??
        cashBox['totalSales'] ??
        cashBox['total_sales'] ??
        0;

    final mappedData = <String, dynamic>{
      'id': cashBox['id'] ?? cashBox['boxNumber'],
      'box_number': cashBox['boxNumber'] ?? cashBox['box_number'],
      'branch_id': cashBox['branchId'] ?? cashBox['branch_id'],
      'opened_by': cashBox['openedBy'] ?? cashBox['opened_by'],
      'closed_by': cashBox['closedBy'] ?? cashBox['closed_by'],
      'status': cashBox['status'],
      'opening_cash': cashBox['openingCash'] ?? cashBox['opening_cash'] ?? 0,
      'total_sales': totalSales,
      'total_cash': totalCash,
      'total_card': totalCard,
      'total_mobile_money': totalMobile,
      'total_debt': totalDebt,
      'closing_cash': cashBox['closingCash'] ?? cashBox['closing_cash'],
      'difference': cashBox['difference'],
      'notes': cashBox['notes'],
      'opened_at': cashBox['openedAt'] ?? cashBox['opened_at'],
      'closed_at': cashBox['closedAt'] ?? cashBox['closed_at'],
      'synced': 1,
    };

    await _db.insert('cash_boxes', mappedData);
    debugPrint(
        '💾 Caixa salvo localmente: total_cash=$totalCash, total_mobile=$totalMobile');
  }

  /// Conta as vendas locais NÃO SINCRONIZADAS para o caixa atual
  /// Estas são vendas feitas no app que ainda não foram enviadas ao servidor
  Future<void> _countLocalSales() async {
    if (_currentCashBox == null) {
      _localSalesCount = 0;
      return;
    }

    try {
      final openedAt =
          _currentCashBox!['opened_at'] ?? _currentCashBox!['openedAt'];

      if (openedAt == null) {
        _localSalesCount = 0;
        return;
      }

      // Contar APENAS vendas locais NÃO SINCRONIZADAS (synced = 0)
      // Vendas sincronizadas já estão contabilizadas no servidor
      final results = await _db.rawQuery(
        'SELECT COUNT(*) as count FROM sales WHERE created_at >= ? AND status != ? AND synced = 0',
        [openedAt, 'cancelled'],
      );

      _localSalesCount = (results.first['count'] as int?) ?? 0;
      debugPrint(
          '📊 Vendas locais NÃO sincronizadas desde $openedAt: $_localSalesCount');
    } catch (e) {
      debugPrint('❌ Erro ao contar vendas locais: $e');
      _localSalesCount = 0;
    }
  }

  /// Incrementa o contador de vendas locais (chamado após cada venda)
  void incrementSalesCount() {
    _localSalesCount++;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
