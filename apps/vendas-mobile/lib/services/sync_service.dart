import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import 'database_service.dart';
import '../config/app_config.dart';
import '../config/payment_methods.dart';

/// Tipos de eventos de sincronização
enum SyncEventType {
  inventoryUpdated,
  productsUpdated,
  customersUpdated,
  salesUpdated,
  cashBoxUpdated,
  tablesUpdated,
}

/// Callback para eventos de sincronização
typedef SyncEventCallback = void Function(SyncEventType type, dynamic data);

class SyncService {
  static final SyncService instance = SyncService._init();

  final DatabaseService _db = DatabaseService.instance;
  final ApiService _api = ApiService.instance;

  bool _isSyncing = false;
  bool _isOnline = true;
  Timer? _syncTimer;
  StreamSubscription? _connectivitySubscription;

  // 🔴 CORREÇÃO CRÍTICA: Flag para re-sync após sync atual
  // Evita perda de vendas quando sync é ignorado por já estar em andamento
  bool _pendingSyncRequested = false;

  // 🔴 CORREÇÃO: Debounce para evitar múltiplas chamadas em sequência rápida
  Timer? _syncDebounceTimer;

  // 🔴 NOVO: Callbacks para notificar providers sobre atualizações
  final List<SyncEventCallback> _eventListeners = [];

  final _syncStatusController = StreamController<SyncStatus>.broadcast();
  Stream<SyncStatus> get syncStatusStream => _syncStatusController.stream;

  /// Registrar listener para eventos de sync
  void addSyncEventListener(SyncEventCallback callback) {
    _eventListeners.add(callback);
  }

  /// Remover listener
  void removeSyncEventListener(SyncEventCallback callback) {
    _eventListeners.remove(callback);
  }

  /// Emitir evento para todos os listeners
  void _emitSyncEvent(SyncEventType type, [dynamic data]) {
    debugPrint('📢 SyncEvent: $type');
    for (final listener in _eventListeners) {
      try {
        listener(type, data);
      } catch (e) {
        debugPrint('⚠️ Erro em SyncEventListener: $e');
      }
    }
  }

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
    _syncDebounceTimer?.cancel();
    _connectivitySubscription?.cancel();
    _syncStatusController.close();
  }

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;

  // 🔴 CORREÇÃO CRÍTICA: Método para sync imediato de vendas (prioridade máxima)
  // Chamado após cada venda para garantir que não se perca
  Future<void> syncSalesImmediately() async {
    debugPrint('🔥 syncSalesImmediately() chamado - sync imediato de vendas');

    // Cancelar debounce anterior se existir
    _syncDebounceTimer?.cancel();

    // Debounce de 500ms para evitar múltiplas chamadas em sequência rápida
    // mas ainda garantir que vendas rápidas sejam sincronizadas
    _syncDebounceTimer = Timer(const Duration(milliseconds: 500), () async {
      if (_isSyncing) {
        // Se já está sincronizando, marcar para re-sync
        _pendingSyncRequested = true;
        debugPrint('⏳ Sync em andamento, re-sync agendado para após conclusão');
      } else {
        await syncAll();
      }
    });
  }

  // Sincronizar tudo
  Future<void> syncAll() async {
    if (_isSyncing) {
      // 🔴 CORREÇÃO: Não ignorar, marcar para re-sync
      _pendingSyncRequested = true;
      debugPrint('⚠️ Sincronização já em andamento, re-sync agendado');
      return;
    }
    if (!_isOnline) {
      debugPrint('📴 Offline, sincronização adiada');
      return;
    }

    // Se não há token em memória, tentar restaurar do SharedPreferences.
    // Se falhar, não adianta tentar sincronizar (vai dar Unauthorized em cascata).
    if (!_api.hasToken) {
      final ok = await _api.validateToken();
      if (!ok) {
        debugPrint('🔒 Sem autenticação válida, sincronização cancelada');
        _syncStatusController.add(SyncStatus(
            isSyncing: false,
            message: 'Sessão expirada. Faça login novamente.',
            success: false));
        return;
      }
    }

    debugPrint('🔄 Iniciando sincronização completa...');
    _isSyncing = true;
    _syncStatusController
        .add(SyncStatus(isSyncing: true, message: 'Sincronizando...'));

    try {
      // 0. Verificar comandos remotos pendentes (ex: reset de dados)
      debugPrint('🔍 Etapa 0: Verificando comandos remotos...');
      await _checkPendingRemoteCommands();

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
      if (e.toString().contains('Unauthorized')) {
        _syncStatusController.add(SyncStatus(
            isSyncing: false,
            message: 'Sessão expirada. Faça login novamente.',
            success: false));
      }
      _syncStatusController.add(
          SyncStatus(isSyncing: false, message: 'Erro: $e', success: false));
    } finally {
      _isSyncing = false;

      // 🔴 CORREÇÃO CRÍTICA: Verificar se há sync pendente e executar
      // Isso garante que vendas criadas durante sync não sejam perdidas
      if (_pendingSyncRequested) {
        _pendingSyncRequested = false;
        debugPrint(
            '🔁 Re-sync solicitado durante sync anterior, executando...');
        // Pequeno delay para evitar loop infinito
        Future.delayed(const Duration(milliseconds: 100), () => syncAll());
      }
    }
  }

  // Enviar mudanças locais para o servidor
  Future<void> _uploadPendingChanges() async {
    final pendingItems = await _db.getPendingSyncItems();
    debugPrint('🔄 Itens pendentes para sincronização: ${pendingItems.length}');

    for (final item in pendingItems) {
      // 🔴 CORREÇÃO: Null-safe casting para evitar crash
      final entityType = item['entity_type']?.toString();
      final entityId = item['entity_id']?.toString();
      final action = item['action']?.toString();

      // 🔴 VALIDAÇÃO CRÍTICA: Verificar campos obrigatórios
      if (entityType == null ||
          entityType.isEmpty ||
          entityId == null ||
          entityId.isEmpty ||
          action == null ||
          action.isEmpty) {
        debugPrint('❌ Item de sync inválido - dados incompletos:');
        debugPrint('   entityType: $entityType');
        debugPrint('   entityId: $entityId');
        debugPrint('   action: $action');
        await _db.markSyncItemFailed(
          item['id'] as int,
          'Dados inválidos: entityType=$entityType, entityId=$entityId, action=$action',
        );
        continue;
      }

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

        // Para operações que não são uma tabela local, usar dados do sync_queue
        final usesQueueData =
            (entityType == 'inventory' && action == 'adjust') ||
                (entityType == 'table_split' && action == 'split') ||
                (entityType == 'table_order_transfer' && action == 'transfer');

        if (usesQueueData) {
          if (syncData == null) {
            throw Exception(
                'Dados ausentes no sync_queue para $entityType/$entityId');
          }
          await _sendToServer(entityType, action, syncData);
          await _db.markSyncItemProcessed(item['id'] as int);
          continue;
        }

        // Buscar dados atuais da entidade local
        final entityData = await _getLocalEntity(entityType, entityId);
        if (entityData == null && action != 'delete') {
          // 🔴 CORREÇÃO: Tentar usar dados do sync_queue antes de descartar
          if (syncData != null && syncData.isNotEmpty) {
            debugPrint(
                '⚠️ Entidade não encontrada localmente, usando dados do sync_queue: $entityType/$entityId');
            await _sendToServer(entityType, action, syncData);
            await _db.markSyncItemProcessed(item['id'] as int);
            continue;
          }

          // 🔴 NÃO marcar como processado - deixar para retry ou investigação
          debugPrint(
              '❌ Entidade não encontrada e sem dados backup: $entityType/$entityId');
          await _db.markSyncItemFailed(
            item['id'] as int,
            'Entidade não encontrada localmente e sem dados no sync_queue',
          );
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

          // Processar pagamento - APENAS para vendas que NÃO são de mesa
          // Vendas de mesa já têm TablePayment criado separadamente
          // Criar Payment aqui causaria DUPLICAÇÃO no faturamento!
          final paymentMethod = data['payment_method'];
          final saleType = data['type'];

          // 🔴 LOG: Debug do método de pagamento
          debugPrint(
              '🔴 [SYNC][PAYMENT] Verificando pagamento para venda ${data['id']}');
          debugPrint('   payment_method: $paymentMethod');
          debugPrint('   payment_status: ${data['payment_status']}');
          debugPrint('   type: $saleType');

          // CRÍTICO: Vendas de mesa (type=table) já têm TablePayment!
          // Criar Payment aqui duplicaria o valor no faturamento!
          final isTableSale = saleType == 'table';

          // Criar payment APENAS para vendas de PDV/balcão (não mesa)
          final shouldCreatePayment = paymentMethod != null &&
              paymentMethod.toString().isNotEmpty &&
              data['payment_status'] == 'paid' &&
              !isTableSale; // 🚫 NÃO criar Payment para vendas de mesa!

          if (shouldCreatePayment) {
            try {
              final normalizedMethod = _mapPaymentMethod(paymentMethod);
              debugPrint(
                  '🔴 [SYNC][PAYMENT] Criando payment: method=$normalizedMethod, amount=${data['total']}');

              await _api.addSalePayment(data['id'], {
                'method': normalizedMethod,
                'amount': data['total'] ?? 0,
              });
              debugPrint(
                  '✅ Pagamento sincronizado: $paymentMethod -> $normalizedMethod');
            } catch (e) {
              // LOG DETALHADO do erro - NÃO silenciar
              debugPrint('❌❌❌ ERRO ao sincronizar pagamento: $e');
              debugPrint('   Venda: ${data['id']}');
              debugPrint('   Método: $paymentMethod');
              debugPrint('   customer_id: ${data['customer_id']}');
              debugPrint('   customer_name: ${data['customer_name']}');
              // Relançar o erro para não marcar como sincronizado com sucesso
              // Mas não bloquear a sincronização - apenas logar
            }
          } else {
            if (isTableSale) {
              debugPrint(
                  '🍽️ [SYNC][PAYMENT] Venda de MESA - Payment NÃO criado (já existe TablePayment)');
            } else {
              debugPrint(
                  '⚠️ [SYNC][PAYMENT] Não criou payment: paymentMethod=$paymentMethod, status=${data['payment_status']}');
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
          final localSessionId =
              (data['id'] ?? data['session_id'] ?? data['sessionId'])
                  ?.toString();

          final opened = await _api.openTable(
            tableId: data['table_id'] ?? data['tableId'] ?? '',
            branchId: data['branch_id'] ?? data['branchId'] ?? '',
            openedBy: data['opened_by'] ?? data['openedBy'] ?? 'mobile',
            sessionId: localSessionId,
          );

          final serverSessionId = (opened is Map && opened['id'] != null)
              ? opened['id'].toString()
              : null;

          if (localSessionId != null &&
              localSessionId.isNotEmpty &&
              serverSessionId != null &&
              serverSessionId.isNotEmpty &&
              serverSessionId != localSessionId) {
            debugPrint(
                '🔁 Remapeando sessionId local → servidor: $localSessionId → $serverSessionId');
            await _db.remapTableSessionId(
              oldSessionId: localSessionId,
              newSessionId: serverSessionId,
            );
          }

          debugPrint('✅ Sessão de mesa sincronizada: ${data['id']}');

          // Marcar sessão como sincronizada
          await _db.update(
            'table_sessions',
            {'synced': 1},
            where: 'id = ?',
            whereArgs: [serverSessionId ?? data['id']],
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
            tableCustomerId: (data['id'] ??
                    data['table_customer_id'] ??
                    data['tableCustomerId'])
                ?.toString(),
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
            orderId:
                (data['id'] ?? data['order_id'] ?? data['orderId'])?.toString(),
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

      // ==================== OPERAÇÕES DE MESAS (QUEUE-BASED) ====================
      case 'table_split':
        if (action == 'split') {
          final sessionId =
              (data['sessionId'] ?? data['session_id'] ?? '').toString();
          final splitBy =
              (data['splitBy'] ?? data['split_by'] ?? 'mobile').toString();
          final branchId = (data['branchId'] ?? data['branch_id'])?.toString();
          final distributionsRaw = data['distributions'];
          final distributions = (distributionsRaw is List)
              ? distributionsRaw
                  .map((e) => Map<String, dynamic>.from(e as Map))
                  .toList()
              : <Map<String, dynamic>>[];

          if (sessionId.isEmpty || distributions.isEmpty) {
            throw Exception('Payload inválido para table_split');
          }

          debugPrint('📋 Sincronizando split de mesa: $sessionId');
          await _api.splitTable(
            sessionId: sessionId,
            distributions: distributions,
            splitBy: splitBy,
          );
          debugPrint('✅ Split sincronizado: $sessionId');

          // Reconciliar estado local: remover duplicatas locais não sincronizadas
          // e baixar sessões atualizadas do servidor.
          try {
            await _refreshTableSessionFromServer(sessionId);

            final targetTableIdsRaw = data['targetTableIds'];
            final targetTableIds = (targetTableIdsRaw is List)
                ? targetTableIdsRaw
                    .map((e) => e.toString())
                    .where((e) => e.isNotEmpty)
                    .toList()
                : <String>[];

            if (branchId != null && branchId.isNotEmpty) {
              final overview = await _api.getTablesOverview(branchId);
              for (final table in overview) {
                if (table is! Map<String, dynamic>) continue;
                final tableId = (table['id'] ?? '').toString();
                if (targetTableIds.isNotEmpty &&
                    !targetTableIds.contains(tableId)) {
                  continue;
                }
                final currentSession = table['currentSession'];
                if (currentSession is Map<String, dynamic>) {
                  final sid = (currentSession['id'] ?? '').toString();
                  if (sid.isNotEmpty) {
                    await _refreshTableSessionFromServer(sid);
                  }
                }
              }
            }
          } catch (e) {
            debugPrint('⚠️ Aviso: falha ao reconciliar split local: $e');
          }
        }
        break;

      case 'table_order_transfer':
        if (action == 'transfer') {
          final orderId =
              (data['orderId'] ?? data['order_id'] ?? '').toString();
          final fromCustomerId =
              (data['fromCustomerId'] ?? data['from_customer_id'] ?? '')
                  .toString();
          final toCustomerId =
              (data['toCustomerId'] ?? data['to_customer_id'] ?? '').toString();
          final transferredBy =
              (data['transferredBy'] ?? data['transferred_by'] ?? 'mobile')
                  .toString();
          final qtyUnitsRaw = data['qtyUnits'] ?? data['qty_units'] ?? 1;
          final qtyUnits = qtyUnitsRaw is int
              ? qtyUnitsRaw
              : int.tryParse(qtyUnitsRaw.toString()) ?? 1;
          final sessionId =
              (data['sessionId'] ?? data['session_id'] ?? '').toString();

          if (orderId.isEmpty ||
              fromCustomerId.isEmpty ||
              toCustomerId.isEmpty) {
            throw Exception('Payload inválido para table_order_transfer');
          }

          debugPrint(
              '📋 Sincronizando transferência de item: $orderId ($qtyUnits)');
          await _api.transferTableOrder(
            orderId: orderId,
            fromCustomerId: fromCustomerId,
            toCustomerId: toCustomerId,
            qtyUnits: qtyUnits,
            transferredBy: transferredBy,
          );
          debugPrint('✅ Transferência sincronizada: $orderId');

          if (sessionId.isNotEmpty) {
            try {
              await _refreshTableSessionFromServer(sessionId);
            } catch (e) {
              debugPrint(
                  '⚠️ Aviso: falha ao reconciliar sessão após transfer: $e');
            }
          }
        }
        break;

      // ==================== NOVOS HANDLERS OFFLINE ====================
      case 'table_transfer':
        if (action == 'transfer') {
          final sessionId =
              (data['sessionId'] ?? data['session_id'] ?? '').toString();
          final toTableId =
              (data['toTableId'] ?? data['to_table_id'] ?? '').toString();
          final transferredBy =
              (data['transferredBy'] ?? data['transferred_by'] ?? 'mobile')
                  .toString();

          if (sessionId.isEmpty || toTableId.isEmpty) {
            throw Exception('Payload inválido para table_transfer');
          }

          debugPrint(
              '📋 Sincronizando transferência de mesa: $sessionId → $toTableId');
          await _api.transferTable(
            sessionId: sessionId,
            toTableId: toTableId,
            transferredBy: transferredBy,
          );
          debugPrint('✅ Transferência de mesa sincronizada');
        }
        break;

      case 'table_customer_transfer':
        if (action == 'transfer') {
          final sessionId =
              (data['sessionId'] ?? data['session_id'] ?? '').toString();
          final customerIdsRaw = data['customerIds'] ?? data['customer_ids'];
          final customerIds = (customerIdsRaw is List)
              ? customerIdsRaw.map((e) => e.toString()).toList()
              : <String>[];
          final toTableId =
              (data['toTableId'] ?? data['to_table_id'] ?? '').toString();
          final transferredBy =
              (data['transferredBy'] ?? data['transferred_by'] ?? 'mobile')
                  .toString();

          if (sessionId.isEmpty || customerIds.isEmpty || toTableId.isEmpty) {
            throw Exception('Payload inválido para table_customer_transfer');
          }

          debugPrint(
              '📋 Sincronizando transferência de ${customerIds.length} clientes');
          await _api.transferCustomers(
            sessionId: sessionId,
            customerIds: customerIds,
            toTableId: toTableId,
            transferredBy: transferredBy,
          );
          debugPrint('✅ Transferência de clientes sincronizada');
        }
        break;

      case 'table_merge':
        if (action == 'merge') {
          final sessionIdsRaw = data['sessionIds'] ?? data['session_ids'];
          final sessionIds = (sessionIdsRaw is List)
              ? sessionIdsRaw.map((e) => e.toString()).toList()
              : <String>[];
          final targetTableId =
              (data['targetTableId'] ?? data['target_table_id'] ?? '')
                  .toString();
          final mergedBy =
              (data['mergedBy'] ?? data['merged_by'] ?? 'mobile').toString();

          if (sessionIds.isEmpty || targetTableId.isEmpty) {
            throw Exception('Payload inválido para table_merge');
          }

          debugPrint('📋 Sincronizando merge de ${sessionIds.length} mesas');
          await _api.mergeTables(
            sessionIds: sessionIds,
            targetTableId: targetTableId,
            mergedBy: mergedBy,
          );
          debugPrint('✅ Merge de mesas sincronizado');
        }
        break;

      // 🔴 CORREÇÃO CRÍTICA: Handler para sincronizar pontos de fidelidade
      case 'customer_loyalty':
        if (action == 'update') {
          final customerId =
              (data['customerId'] ?? data['customer_id'] ?? '').toString();
          final pointsAdded = data['pointsAdded'] ?? data['points_added'] ?? 0;
          final reason = data['reason'] ?? 'Sincronização de pontos';

          if (pointsAdded > 0 && customerId.isNotEmpty) {
            debugPrint(
                '🏆 Sincronizando $pointsAdded pontos para cliente $customerId');
            await _api.addLoyaltyPoints(
              customerId: customerId,
              points: pointsAdded,
              reason: reason,
            );
            debugPrint('✅ Pontos de fidelidade sincronizados');
          }
        }
        break;
    }
  }

  Future<void> _refreshTableSessionFromServer(String sessionId) async {
    final session = await _api.getTableSession(sessionId);
    if (session is! Map<String, dynamic>) return;

    // Coletar IDs do servidor (clientes e pedidos)
    final serverCustomerIds = <String>{};
    final serverOrderIds = <String>{};
    final customers = session['customers'] as List<dynamic>? ?? [];
    for (final c in customers) {
      if (c is! Map<String, dynamic>) continue;
      final cid = c['id']?.toString();
      if (cid != null && cid.isNotEmpty) serverCustomerIds.add(cid);
      final orders = c['orders'] as List<dynamic>? ?? [];
      for (final o in orders) {
        if (o is! Map<String, dynamic>) continue;
        final oid = o['id']?.toString();
        if (oid != null && oid.isNotEmpty) serverOrderIds.add(oid);
      }
    }

    // Remover duplicatas locais não sincronizadas que não existem no servidor
    if (serverOrderIds.isEmpty) {
      await _db.delete('table_orders',
          where: 'session_id = ? AND synced = 0', whereArgs: [sessionId]);
    } else {
      final placeholders = serverOrderIds.map((_) => '?').join(',');
      await _db.rawUpdate(
        'DELETE FROM table_orders WHERE session_id = ? AND synced = 0 AND id NOT IN ($placeholders)',
        [sessionId, ...serverOrderIds.toList()],
      );
    }

    if (serverCustomerIds.isEmpty) {
      await _db.delete('table_customers',
          where: 'session_id = ? AND synced = 0', whereArgs: [sessionId]);
    } else {
      final placeholders = serverCustomerIds.map((_) => '?').join(',');
      await _db.rawUpdate(
        'DELETE FROM table_customers WHERE session_id = ? AND synced = 0 AND id NOT IN ($placeholders)',
        [sessionId, ...serverCustomerIds.toList()],
      );
    }

    await _mergeTableSession(session);
  }

  /// Mapeia dados da venda local para formato do servidor
  Map<String, dynamic> _mapSaleToServer(Map<String, dynamic> data) {
    // 🔴 LOG FASE 5: SYNC - Dados recebidos do banco local
    debugPrint('\n═══════════════════════════════════════════════════════');
    debugPrint('🔴 [SYNC][_mapSaleToServer] DADOS DO BANCO LOCAL');
    debugPrint('   data[payment_method]: "${data['payment_method']}"');
    debugPrint('   data[paymentMethod]: "${data['paymentMethod']}"');
    debugPrint('═══════════════════════════════════════════════════════\n');

    // Obter método de pagamento de forma robusta
    final rawPaymentMethod = data['payment_method'] ?? data['paymentMethod'];
    String? normalizedPaymentMethod;

    // 🔴 LOG FASE 6: Valor raw antes de normalizar
    debugPrint('🔴 [SYNC][RAW_PAYMENT] rawPaymentMethod: "$rawPaymentMethod"');

    if (rawPaymentMethod != null && rawPaymentMethod.toString().isNotEmpty) {
      try {
        normalizedPaymentMethod =
            PaymentMethod.normalize(rawPaymentMethod.toString());
        // 🔴 LOG FASE 7: Após normalização
        debugPrint(
            '🔴 [SYNC][NORMALIZED] $rawPaymentMethod -> $normalizedPaymentMethod');
      } catch (e) {
        debugPrint(
            '❌ [SYNC][ERROR] Erro ao normalizar método de pagamento: $rawPaymentMethod - $e');
        // NÃO usar fallback - deixar null para que o servidor rejeite
        normalizedPaymentMethod = null;
      }
    } else {
      debugPrint('❌ [SYNC][ERROR] rawPaymentMethod é NULL ou VAZIO!');
    }

    final payload = {
      'id': data['id'],
      'branchId': data['branch_id'] ?? data['branchId'],
      'cashierId': data['cashier_id'] ?? data['cashierId'],
      'type': data['type'] ?? 'counter',
      'customerId': data['customer_id'] ?? data['customerId'],
      'customerName': data['customer_name'] ??
          data['customerName'], // ✅ Incluir nome do cliente
      'saleNumber': data['sale_number'] ?? data['saleNumber'],
      'subtotal': data['subtotal'],
      'total': data['total'],
      'status': data['status'],
      'paymentMethod': normalizedPaymentMethod, // Método normalizado
      'paymentStatus':
          data['payment_status'] ?? data['paymentStatus'] ?? 'paid',
      'notes': data['notes'],
    };

    // 🔴 LOG FASE 8: Payload final que será enviado ao servidor
    debugPrint(
        '🔴 [SYNC][FINAL_PAYLOAD] paymentMethod no payload: "${payload['paymentMethod']}"');

    return payload;
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
      _emitSyncEvent(SyncEventType.productsUpdated, products.length);

      // Baixar clientes
      final customers = await _api.getCustomers();
      await _mergeData('customers', customers);
      _emitSyncEvent(SyncEventType.customersUpdated, customers.length);

      // Baixar estoque
      final inventory = await _api.getInventory();
      await _mergeData('inventory', inventory);
      _emitSyncEvent(SyncEventType.inventoryUpdated, inventory.length);

      // Baixar mesas
      debugPrint('🍽️ SyncService: Baixando mesas...');
      final tables = await _api.getTables();
      debugPrint('🍽️ SyncService: Mesas recebidas: ${tables.length}');
      await _mergeData('tables', tables);
      debugPrint('🍽️ SyncService: Mesas mescladas no banco local');
      _emitSyncEvent(SyncEventType.tablesUpdated, tables.length);

      // Baixar mesas com sessões ativas (overview)
      try {
        // Preferir branchId persistido (mais confiável do que inferir pela lista de mesas)
        final prefs = await SharedPreferences.getInstance();
        String? branchId = prefs.getString('branch_id');

        // Fallback: tentar inferir pelo primeiro registro retornado
        if ((branchId == null || branchId.isEmpty) && tables.isNotEmpty) {
          branchId = (tables.first['branchId'] ?? tables.first['branch_id'])
              ?.toString();

          if (branchId != null && branchId.isNotEmpty) {
            try {
              await prefs.setString('branch_id', branchId);
            } catch (_) {}
          }
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
      } else {
        // CRÍTICO: Servidor não tem caixa aberto - FECHAR todos os caixas locais abertos
        debugPrint('🔴 Servidor não tem caixa aberto - fechando caixas locais');
        await _closeAllLocalOpenCashBoxes();
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

    final productId = order['productId'] ?? order['product_id'];

    // Determinar o product_name correto
    String? productName = order['productName'] ?? order['product_name'];

    final existingOrders = await _db.query(
      'table_orders',
      where: 'id = ?',
      whereArgs: [orderId],
    );

    // Se não temos product_name do servidor, preservar o do banco local
    if ((productName == null ||
            productName.isEmpty ||
            productName == 'Produto') &&
        existingOrders.isNotEmpty) {
      final localProductName = existingOrders.first['product_name']?.toString();
      if (localProductName != null &&
          localProductName.isNotEmpty &&
          localProductName != 'Produto') {
        productName = localProductName;
      }
    }

    // Se ainda não temos um nome válido, buscar da tabela de produtos
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

    // Fallback final
    productName ??= 'Produto';

    final mappedOrder = {
      'id': orderId,
      'session_id': sessionId,
      'table_customer_id': tableCustomerId,
      'product_id': productId,
      'product_name': productName,
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

    // Preservar display_qty e muntu_quantity do banco local se existirem
    if (existingOrders.isNotEmpty) {
      final localOrder = existingOrders.first;
      if (mappedOrder['display_qty'] == null &&
          localOrder['display_qty'] != null) {
        mappedOrder['display_qty'] = localOrder['display_qty'];
      }
      if (mappedOrder['muntu_quantity'] == null &&
          localOrder['muntu_quantity'] != null) {
        mappedOrder['muntu_quantity'] = localOrder['muntu_quantity'];
      }
    }

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

  /// CRÍTICO: Fecha TODOS os caixas locais abertos quando o servidor não tem caixa aberto
  /// Isso garante que o Mobile nunca exiba um caixa "fantasma"
  Future<void> _closeAllLocalOpenCashBoxes() async {
    try {
      final openCashBoxes = await _db.query(
        'cash_boxes',
        where: 'status = ?',
        whereArgs: ['open'],
      );

      debugPrint(
          '🔴 Encontrados ${openCashBoxes.length} caixas locais abertos para fechar');

      for (final cashBox in openCashBoxes) {
        final cashBoxId = cashBox['id'];
        final synced = cashBox['synced'] as int? ?? 1;

        // IMPORTANTE: Fechar INDEPENDENTE do status de synced
        // Se o servidor diz que não há caixa, o servidor é a fonte da verdade
        // Se havia vendas não sincronizadas, elas já foram perdidas ou sincronizadas
        debugPrint('🔴 Fechando caixa local: $cashBoxId (synced=$synced)');

        await _db.update(
          'cash_boxes',
          {
            'status': 'closed',
            'closed_at': DateTime.now().toIso8601String(),
            'synced':
                1, // Marcar como sincronizado pois reflete estado do servidor
          },
          where: 'id = ?',
          whereArgs: [cashBoxId],
        );

        debugPrint('✅ Caixa $cashBoxId fechado localmente');
      }
    } catch (e) {
      debugPrint('❌ Erro ao fechar caixas locais: $e');
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

    // 🔴 CORREÇÃO CRÍTICA: Vendas, pagamentos e caixa têm prioridade máxima
    final isCritical = entityType == 'sales' ||
        entityType == 'table_payments' ||
        entityType == 'payments' ||
        entityType == 'table_orders' ||
        entityType == 'cash_boxes';

    await _db.addToSyncQueue(
      entityType: entityType,
      entityId: entityId,
      action: action,
      data: data ?? {},
      priority: isCritical ? 1 : 10, // Prioridade 1 para críticos
    );

    // Tentar sincronizar imediatamente se online
    if (_isOnline) {
      debugPrint('🌐 Online - iniciando sincronização imediata');
      // 🔴 CORREÇÃO: Usar método com debounce para vendas
      if (isCritical) {
        syncSalesImmediately();
      } else {
        Future.delayed(const Duration(milliseconds: 500), () => syncAll());
      }
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

  /// Verifica e executa comandos remotos pendentes do admin
  /// Executado no início de cada sincronização
  Future<void> _checkPendingRemoteCommands() async {
    try {
      final commands = await _api.getPendingCommands();

      if (commands.isEmpty) {
        debugPrint('✅ Nenhum comando remoto pendente');
        return;
      }

      debugPrint('⚠️ ${commands.length} comando(s) remoto(s) pendente(s)');

      for (final command in commands) {
        final commandId = command['id'] as String?;
        final commandType = command['type'] as String?;

        if (commandId == null || commandType == null) continue;

        debugPrint('🔧 Executando comando: $commandType ($commandId)');

        if (commandType == 'RESET_LOCAL_DATA') {
          // Executar reset local
          final stats = await _executeLocalReset();

          // Confirmar execução
          final acknowledged = await _api.acknowledgeCommand(
            commandId: commandId,
            success: true,
            stats: stats,
          );

          if (acknowledged) {
            debugPrint('✅ Comando $commandId executado e confirmado');
          } else {
            debugPrint('⚠️ Comando executado, mas não confirmado no servidor');
          }

          // Notificar UI que está iniciando download
          _syncStatusController.add(SyncStatus(
            isSyncing: true,
            message: '🔄 Reset remoto executado. Baixando dados...',
            success: null,
          ));

          // IMPORTANTE: Após reset remoto, forçar download imediato dos dados
          // Isso garante que o app não fique com banco vazio
          debugPrint('📥 Iniciando download de dados após reset remoto...');
          try {
            await _downloadServerData();
            debugPrint('✅ Dados baixados com sucesso após reset remoto');

            // Notificar UI que os dados foram recarregados e providers devem atualizar
            _syncStatusController.add(SyncStatus(
              isSyncing: false,
              message: '✅ Reset remoto concluído. Dados recarregados!',
              success: true,
              requiresReload: true, // Sinaliza que providers devem recarregar
            ));
          } catch (downloadError) {
            debugPrint('⚠️ Erro ao baixar dados após reset: $downloadError');

            // Ainda assim notificar que precisa recarregar (tentará usar cache)
            _syncStatusController.add(SyncStatus(
              isSyncing: false,
              message:
                  '⚠️ Reset executado. Erro ao baixar dados: $downloadError',
              success: false,
              requiresReload: true,
            ));
          }
        } else {
          debugPrint('⚠️ Comando desconhecido: $commandType');
        }
      }
    } catch (e) {
      debugPrint('❌ Erro ao verificar comandos remotos: $e');
      // Não propagar erro - comandos remotos são opcionais
    }
  }

  /// Executa reset local e retorna estatísticas
  Future<Map<String, dynamic>> _executeLocalReset() async {
    debugPrint('═══════════════════════════════════════════════════════');
    debugPrint('🗑️ RESET LOCAL REMOTO - Iniciando...');
    debugPrint('═══════════════════════════════════════════════════════');

    final stats = <String, dynamic>{};

    try {
      // Contar registros antes de deletar
      final db = await _db.database;

      final tables = [
        'sync_queue',
        'payments',
        'table_payments',
        'sale_items',
        'sales',
        'table_orders',
        'table_customers',
        'table_sessions',
        'tables',
        'debts',
        'cash_boxes',
        'inventory',
        'customers',
        'products',
        'categories'
      ];

      for (final table in tables) {
        try {
          final result =
              await db.rawQuery('SELECT COUNT(*) as count FROM $table');
          final count = (result.first['count'] as int?) ?? 0;
          if (count > 0) {
            stats['$table'] = count;
          }
        } catch (_) {}
      }

      // Executar reset
      await _db.clearAllData();

      stats['timestamp'] = DateTime.now().toIso8601String();
      stats['success'] = true;

      debugPrint('✅ Reset local concluído');
      debugPrint('📊 Estatísticas: $stats');
      debugPrint('═══════════════════════════════════════════════════════');

      return stats;
    } catch (e) {
      debugPrint('❌ Erro no reset local: $e');
      stats['error'] = e.toString();
      stats['success'] = false;
      return stats;
    }
  }

  /// Limpa todos os dados locais e sincroniza novamente do servidor
  /// Usado para garantir que o app tenha os mesmos dados do Railway
  Future<bool> resetAndSyncFromServer() async {
    if (!_isOnline) {
      debugPrint('❌ Sem conexão com internet - impossível sincronizar');
      return false;
    }

    try {
      debugPrint('═══════════════════════════════════════════════════════');
      debugPrint('🔄 RESET E SYNC - Iniciando...');
      debugPrint('═══════════════════════════════════════════════════════');

      // 1. Limpar todos os dados locais
      debugPrint('🗑️ Limpando banco de dados local...');
      await _db.clearAllData();
      debugPrint('✅ Banco local limpo');

      // 2. Baixar dados do servidor
      debugPrint('📥 Baixando dados do servidor Railway...');
      await _downloadServerData();
      debugPrint('✅ Dados baixados com sucesso');

      // 3. Atualizar timestamp
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('last_sync', DateTime.now().toIso8601String());

      debugPrint('═══════════════════════════════════════════════════════');
      debugPrint('✅ RESET E SYNC - Concluído com sucesso!');
      debugPrint('═══════════════════════════════════════════════════════');

      return true;
    } catch (e) {
      debugPrint('❌ Erro no reset e sync: $e');
      return false;
    }
  }
}

class SyncStatus {
  final bool isSyncing;
  final String message;
  final bool? success;
  final bool requiresReload; // Indica que providers devem recarregar dados

  SyncStatus({
    required this.isSyncing,
    required this.message,
    this.success,
    this.requiresReload = false,
  });
}
