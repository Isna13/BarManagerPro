import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class SyncProvider with ChangeNotifier {
  bool _isSyncing = false;
  int _pendingItems = 0;
  DateTime? _lastSync;
  Timer? _autoSyncTimer;
  final ApiService _apiService = ApiService();

  bool get isSyncing => _isSyncing;
  int get pendingItems => _pendingItems;
  DateTime? get lastSync => _lastSync;

  SyncProvider() {
    // Iniciar sincronização automática a cada 5 minutos
    _startAutoSync();
  }

  void _startAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => startSync(silent: true),
    );
  }

  Future<void> startSync({bool silent = false}) async {
    if (_isSyncing) return;

    _isSyncing = true;
    if (!silent) notifyListeners();

    try {
      await _apiService.loadToken();

      // Sincronizar dados principais
      await Future.wait([
        _apiService.getDashboardStats(),
        _apiService.getProducts(),
        _apiService.getSales(),
      ]);

      _pendingItems = 0;
      _lastSync = DateTime.now();
    } catch (e) {
      debugPrint('Erro na sincronização: $e');
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
    super.dispose();
  }
}
