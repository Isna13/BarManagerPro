import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'api_service.dart';
import 'database_service.dart';

/// SyncService para o app mobile (somente leitura)
/// Este app é apenas para visualização de dados, não realiza operações de escrita
class SyncService {
  final ApiService _apiService;
  final DatabaseService _dbService;
  bool _isSyncing = false;

  SyncService(this._apiService, this._dbService);

  Future<bool> isOnline() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    return connectivityResult != ConnectivityResult.none;
  }

  Future<SyncResult> syncAll() async {
    if (_isSyncing) {
      return SyncResult(
        success: false,
        message: 'Sincronização já em andamento',
      );
    }

    _isSyncing = true;
    final result = SyncResult();

    try {
      final online = await isOnline();
      if (!online) {
        result.success = false;
        result.message = 'Sem conexão com internet';
        return result;
      }

      // Pull data from server (products for offline cache)
      await _pullProducts();
      result.pulled++;

      result.success = true;
      result.message = 'Sincronização concluída';
    } catch (e) {
      result.success = false;
      result.message = 'Erro na sincronização: $e';
    } finally {
      _isSyncing = false;
    }

    return result;
  }

  Future<void> _pullProducts() async {
    try {
      final products = await _apiService.getProducts();
      for (final product in products) {
        await _dbService.insertProduct({
          'id': product.id,
          'name': product.name,
          'sku': product.sku ?? '',
          'categoryId': product.categoryId ?? '',
          'priceUnit': product.priceUnit,
          'priceBox': product.priceBox ?? 0.0,
          'unitsPerBox': product.unitsPerBox ?? 1,
          'stock': 0, // Stock é gerenciado pelo inventário
          'isActive': product.isActive ? 1 : 0,
          'syncStatus': 'synced',
          'updatedAt': DateTime.now().toIso8601String(),
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error pulling products: $e');
      }
      rethrow;
    }
  }
}

class SyncResult {
  bool success;
  String message;
  int pulled;
  int pushed;
  int errors;

  SyncResult({
    this.success = false,
    this.message = '',
    this.pulled = 0,
    this.pushed = 0,
    this.errors = 0,
  });
}
