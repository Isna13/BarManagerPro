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

  /// 🔴 CORREÇÃO: Inicializar listener para eventos de sync
  /// Isso garante que o caixa seja recarregado após sincronização
  CashBoxProvider() {
    _sync.addSyncEventListener(_onSyncEvent);
  }

  @override
  void dispose() {
    _sync.removeSyncEventListener(_onSyncEvent);
    super.dispose();
  }

  /// 🔴 CORREÇÃO: Handler para eventos de sync
  void _onSyncEvent(SyncEventType type, dynamic data) {
    if (type == SyncEventType.cashBoxUpdated ||
        type == SyncEventType.salesUpdated) {
      debugPrint('📢 CashBoxProvider: Recebido evento $type, recarregando...');
      loadCurrentCashBox();
    }
  }

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
            // MESMO CAIXA - Salvar dados do servidor primeiro
            _currentCashBox = serverCashBox;
            await _saveCashBoxLocally(result);

            // 🔴 CORREÇÃO CRÍTICA: SEMPRE recalcular a partir das vendas locais
            // Isso garante que vendas offline (ainda não sincronizadas) sejam contabilizadas
            // O recálculo usa TODAS as vendas locais (synced ou não) e compara com servidor
            await _recalculateAndMergeCashBox(serverCashBox);

            debugPrint('📦 Caixa mesclado com vendas locais');
          } else if (localCashBox != null &&
              localCashBox['id']?.toString().startsWith('temp_') == true) {
            // Caixa temporário existe - precisamos migrar vendas para o caixa real
            debugPrint(
                '🔄 Migrando vendas do caixa temporário para o caixa real...');
            _currentCashBox = serverCashBox;
            await _saveCashBoxLocally(result);

            // Recalcular incluindo vendas do período temporário
            await _recalculateAndMergeCashBox(serverCashBox);

            // Fechar o caixa temporário
            await _db.update(
              'cash_boxes',
              {
                'status': 'closed',
                'closed_at': DateTime.now().toIso8601String()
              },
              where: 'id = ?',
              whereArgs: [localCashBox['id']],
            );
            debugPrint('✅ Caixa temporário fechado, vendas migradas');
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

            // Salvar novo caixa localmente e recalcular
            await _saveCashBoxLocally(result);
            await _recalculateAndMergeCashBox(serverCashBox);
          }
        } else {
          // Servidor não tem caixa aberto
          debugPrint('🌐 Servidor não tem caixa aberto');

          if (localCashBox != null) {
            // 🔴 CORREÇÃO CRÍTICA: Antes de fechar, verificar se há vendas pendentes
            final pendingSales = await _db.rawQuery('''
              SELECT COUNT(*) as count FROM sync_queue 
              WHERE entity_type = 'sale' AND status = 'pending'
            ''');
            final pendingCount =
                (pendingSales.first['count'] as num? ?? 0).toInt();

            if (pendingCount > 0 || localCashBox['synced'] == 0) {
              // Há vendas não sincronizadas - NÃO fechar o caixa local!
              debugPrint(
                  '⚠️ $pendingCount vendas pendentes de sync - mantendo caixa local aberto');
              debugPrint(
                  '   Caixa local: id=${localCashBox['id']}, synced=${localCashBox['synced']}');

              _currentCashBox = localCashBox;

              // Recalcular para garantir que os totais estão corretos
              await recalculateCashBoxFromLocalSales();

              debugPrint(
                  '📦 Caixa local mantido com vendas pendentes. Sincronize para fechar.');
            } else {
              // Sem vendas pendentes - seguro fechar
              debugPrint('✅ Sem vendas pendentes - fechando caixa local');

              await _db.update(
                'cash_boxes',
                {
                  'status': 'closed',
                  'closed_at': DateTime.now().toIso8601String(),
                  'synced': 1,
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
            }
          } else {
            _currentCashBox = null;
          }
        }
      } else {
        // Offline: usar banco local
        debugPrint('📴 Offline - usando banco local');
        _currentCashBox = localCashBox;

        // 🔴 CORREÇÃO CRÍTICA: Quando offline, recalcular caixa a partir das vendas locais
        // Isso garante que vendas feitas offline sejam refletidas no caixa
        if (_currentCashBox != null) {
          await recalculateCashBoxFromLocalSales();
        }
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
        // 🔴 CORREÇÃO CRÍTICA: Se não há caixa local, criar um temporário para não perder vendas
        // Quando o app sincronizar, ele vai associar essas vendas ao caixa do servidor
        debugPrint(
            '⚠️ Nenhum caixa aberto! Criando caixa temporário para não perder vendas...');
        final now = DateTime.now();
        final tempId = 'temp_${now.millisecondsSinceEpoch}';
        _currentCashBox = {
          'id': tempId,
          'box_number': 'TEMP',
          'branch_id': 'main-branch',
          'status': 'open',
          'opening_cash': 0,
          'total_sales': 0,
          'total_cash': 0,
          'total_card': 0,
          'total_mobile_money': 0,
          'total_debt': 0,
          'opened_at': now.toIso8601String(),
          'synced': 0,
        };
        // Salvar no banco para persistir
        await _db.insert('cash_boxes', _currentCashBox!);
        debugPrint('✅ Caixa temporário criado: $tempId');
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

    // CRÍTICO: Total de vendas inclui TODOS os métodos de pagamento, inclusive VALE
    // Vale é uma venda real, apenas com forma de pagamento diferida
    _currentCashBox!['total_sales'] =
        currentCash + currentCard + currentMobile + currentDebt;
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

  /// 🔴 CORREÇÃO CRÍTICA: Recalcula os totais do caixa a partir das vendas locais
  /// Isso garante consistência quando offline ou após perda de conexão
  /// Deve ser chamado quando o app inicia offline ou detecta inconsistência
  Future<void> recalculateCashBoxFromLocalSales() async {
    if (_currentCashBox == null) {
      debugPrint('❌ recalculateCashBoxFromLocalSales: nenhum caixa aberto');
      return;
    }

    try {
      final openedAt =
          _currentCashBox!['opened_at'] ?? _currentCashBox!['openedAt'];
      final boxId = _currentCashBox!['id'];

      if (openedAt == null) {
        debugPrint('❌ recalculateCashBoxFromLocalSales: openedAt é null');
        return;
      }

      debugPrint('🔄 Recalculando caixa $boxId a partir de vendas locais...');

      // Buscar TODAS as vendas locais desde a abertura do caixa (sincronizadas ou não)
      final salesResults = await _db.rawQuery('''
        SELECT 
          payment_method,
          SUM(total) as total_amount,
          COUNT(*) as count
        FROM sales 
        WHERE created_at >= ? 
          AND status != 'cancelled'
        GROUP BY payment_method
      ''', [openedAt]);

      int totalCash = 0;
      int totalCard = 0;
      int totalMobile = 0;
      int totalDebt = 0;
      int salesCount = 0;

      for (final row in salesResults) {
        final method = (row['payment_method'] as String? ?? '').toLowerCase();
        final amount = (row['total_amount'] as num? ?? 0).toInt();
        final count = (row['count'] as num? ?? 0).toInt();

        salesCount += count;

        if (method == 'cash') {
          totalCash += amount;
        } else if (method == 'orange' ||
            method == 'teletaku' ||
            method == 'mobile') {
          totalMobile += amount;
        } else if (method == 'card' || method == 'mixed') {
          totalCard += amount;
        } else if (method == 'vale' || method == 'debt') {
          totalDebt += amount;
        }
      }

      final totalSales = totalCash + totalCard + totalMobile + totalDebt;

      debugPrint('📊 Recálculo do caixa:');
      debugPrint('   Cash: $totalCash');
      debugPrint('   Card: $totalCard');
      debugPrint('   Mobile: $totalMobile');
      debugPrint('   Debt: $totalDebt');
      debugPrint('   Total: $totalSales');
      debugPrint('   Vendas: $salesCount');

      // Atualizar o caixa em memória
      _currentCashBox!['total_cash'] = totalCash;
      _currentCashBox!['total_card'] = totalCard;
      _currentCashBox!['total_mobile_money'] = totalMobile;
      _currentCashBox!['total_debt'] = totalDebt;
      _currentCashBox!['total_sales'] = totalSales;
      _currentCashBox!['synced'] = 0;

      // Persistir no banco local
      await _db.update(
        'cash_boxes',
        {
          'total_cash': totalCash,
          'total_card': totalCard,
          'total_mobile_money': totalMobile,
          'total_debt': totalDebt,
          'total_sales': totalSales,
          'synced': 0,
        },
        where: 'id = ?',
        whereArgs: [boxId],
      );

      debugPrint('✅ Caixa recalculado e salvo');
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Erro ao recalcular caixa: $e');
    }
  }

  /// Recalcula o caixa a partir das vendas locais e mescla com os valores do servidor
  /// Usa MAX(local, servidor) para garantir que vendas offline não sejam perdidas
  Future<void> _recalculateAndMergeCashBox(
      Map<String, dynamic> serverCashBox) async {
    if (_currentCashBox == null) return;

    try {
      final openedAt = serverCashBox['opened_at'] ??
          serverCashBox['openedAt'] ??
          _currentCashBox!['opened_at'];
      final boxId = _currentCashBox!['id'];

      if (openedAt == null) {
        debugPrint(
            '⚠️ _recalculateAndMergeCashBox: openedAt é null, usando servidor diretamente');
        return;
      }

      debugPrint('🔄 Recalculando e mesclando caixa com vendas locais...');

      // Buscar TODAS as vendas locais desde a abertura do caixa (sincronizadas ou não)
      final salesResults = await _db.rawQuery('''
        SELECT 
          payment_method,
          SUM(total) as total_amount,
          COUNT(*) as count
        FROM sales 
        WHERE created_at >= ? 
          AND status != 'cancelled'
        GROUP BY payment_method
      ''', [openedAt]);

      int localCash = 0;
      int localCard = 0;
      int localMobile = 0;
      int localDebt = 0;
      int localSalesCount = 0;

      for (final row in salesResults) {
        final method = (row['payment_method'] as String? ?? '').toLowerCase();
        final amount = (row['total_amount'] as num? ?? 0).toInt();
        final count = (row['count'] as num? ?? 0).toInt();

        localSalesCount += count;

        if (method == 'cash') {
          localCash += amount;
        } else if (method == 'orange' ||
            method == 'teletaku' ||
            method == 'mobile') {
          localMobile += amount;
        } else if (method == 'card' || method == 'mixed') {
          localCard += amount;
        } else if (method == 'vale' || method == 'debt') {
          localDebt += amount;
        }
      }

      // Valores do servidor
      final serverCash = (serverCashBox['total_cash'] as num? ?? 0).toInt();
      final serverCard = (serverCashBox['total_card'] as num? ?? 0).toInt();
      final serverMobile =
          (serverCashBox['total_mobile_money'] as num? ?? 0).toInt();
      final serverDebt = (serverCashBox['total_debt'] as num? ?? 0).toInt();

      // Usar MAX(local, servidor) para cada tipo de pagamento
      // Isso garante que vendas offline (ainda não no servidor) sejam mantidas
      final finalCash = localCash > serverCash ? localCash : serverCash;
      final finalCard = localCard > serverCard ? localCard : serverCard;
      final finalMobile =
          localMobile > serverMobile ? localMobile : serverMobile;
      final finalDebt = localDebt > serverDebt ? localDebt : serverDebt;
      final finalTotal = finalCash + finalCard + finalMobile + finalDebt;

      debugPrint('📊 Merge caixa (local vs servidor):');
      debugPrint('   Cash: $localCash vs $serverCash -> $finalCash');
      debugPrint('   Card: $localCard vs $serverCard -> $finalCard');
      debugPrint('   Mobile: $localMobile vs $serverMobile -> $finalMobile');
      debugPrint('   Debt: $localDebt vs $serverDebt -> $finalDebt');
      debugPrint('   Vendas locais: $localSalesCount');

      // Verificar se há diferença (vendas locais não sincronizadas)
      final hasLocalChanges = localCash > serverCash ||
          localCard > serverCard ||
          localMobile > serverMobile ||
          localDebt > serverDebt;

      // Atualizar o caixa em memória
      _currentCashBox = {
        ..._currentCashBox!,
        'total_cash': finalCash,
        'total_card': finalCard,
        'total_mobile_money': finalMobile,
        'total_debt': finalDebt,
        'total_sales': finalTotal,
        'synced': hasLocalChanges
            ? 0
            : 1, // Se tem vendas locais não sync, marcar como não sincronizado
      };

      // Persistir no banco local
      await _db.update(
        'cash_boxes',
        {
          'total_cash': finalCash,
          'total_card': finalCard,
          'total_mobile_money': finalMobile,
          'total_debt': finalDebt,
          'total_sales': finalTotal,
          'synced': hasLocalChanges ? 0 : 1,
        },
        where: 'id = ?',
        whereArgs: [boxId],
      );

      if (hasLocalChanges) {
        debugPrint('⚠️ Caixa tem vendas locais não sincronizadas!');
      } else {
        debugPrint('✅ Caixa sincronizado com servidor');
      }
    } catch (e) {
      debugPrint('❌ Erro ao recalcular e mesclar caixa: $e');
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
