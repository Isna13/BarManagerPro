import 'package:flutter/foundation.dart';

class SyncProvider with ChangeNotifier {
  bool _isSyncing = false;
  int _pendingItems = 0;
  DateTime? _lastSync;

  bool get isSyncing => _isSyncing;
  int get pendingItems => _pendingItems;
  DateTime? get lastSync => _lastSync;

  Future<void> startSync() async {
    if (_isSyncing) return;

    _isSyncing = true;
    notifyListeners();

    // TODO: Implementar lógica de sincronização
    await Future.delayed(const Duration(seconds: 2));

    _pendingItems = 0;
    _lastSync = DateTime.now();
    _isSyncing = false;
    notifyListeners();
  }

  void addPendingItem() {
    _pendingItems++;
    notifyListeners();
  }
}
