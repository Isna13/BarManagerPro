import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class SyncProvider with ChangeNotifier {
  bool _isSyncing = false;
  int _pendingItems = 0;
  DateTime? _lastSync;
  Timer? _autoSyncTimer;
  final ApiService _apiService = ApiService();

  // Stream controller para notificar quando sync completa
  final _syncCompleteController = StreamController<bool>.broadcast();
  Stream<bool> get onSyncComplete => _syncCompleteController.stream;

  bool get isSyncing => _isSyncing;
  int get pendingItems => _pendingItems;
  DateTime? get lastSync => _lastSync;

  SyncProvider() {
    // Iniciar sincronização automática a cada 2 minutos
    _startAutoSync();
  }

  void _startAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(
      const Duration(minutes: 2), // Reduzir para 2 minutos para melhor UX
      (_) => startSync(silent: true),
    );
  }

  Future<void> startSync({bool silent = false}) async {
    if (_isSyncing) return;

    _isSyncing = true;
    if (!silent) notifyListeners();

    try {
      await _apiService.loadToken();

      // Sincronizar dados principais incluindo caixa e inventário
      await Future.wait([
        _apiService.getDashboardStats(),
        _apiService.getProducts(),
        _apiService.getSales(),
        _apiService.getInventory(), // Sincronizar inventário
        _apiService.getCurrentCashBox(), // Sincronizar caixa atual
        _apiService.getCashBoxHistory(limit: 30), // Sincronizar histórico
      ]);

      _pendingItems = 0;
      _lastSync = DateTime.now();
      
      // Notificar que sync completou com sucesso
      debugPrint('🔄 SyncProvider: Sync completo, notificando listeners...');
      _syncCompleteController.add(true);
    } catch (e) {
      debugPrint('Erro na sincronização: $e');
      _syncCompleteController.add(false);
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  void addPendingItem() {
    _pendingItems++;
    notifyListeners();
  }

  @override
  void dispose() {
    _autoSyncTimer?.cancel();
    _syncCompleteController.close();
    super.dispose();
  }
}
