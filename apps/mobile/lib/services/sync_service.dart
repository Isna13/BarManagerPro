import 'package:connectivity_plus/connectivity_plus.dart';
import 'api_service.dart';
import 'database_service.dart';
import 'dart:convert';

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

      // 1. Pull data from server (products)
      await _pullProducts();
      result.pulled++;

      // 2. Push pending changes to server
      final pending = await _dbService.getPendingSync();
      for (final item in pending) {
        try {
          await _pushItem(item);
          await _dbService.removeSyncItem(item['id']);
          result.pushed++;
        } catch (e) {
          print('Error pushing item ${item['id']}: $e');
          result.errors++;
        }
      }

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
          'id': product['id'],
          'name': product['name'],
          'sku': product['sku'],
          'categoryId': product['categoryId'],
          'priceUnit': product['priceUnit'],
          'priceBox': product['priceBox'],
          'unitsPerBox': product['unitsPerBox'],
          'stock': product['stock'] ?? 0,
          'isActive': product['isActive'] ? 1 : 0,
          'syncStatus': 'synced',
          'updatedAt': DateTime.now().toIso8601String(),
        });
      }
    } catch (e) {
      print('Error pulling products: $e');
      rethrow;
    }
  }

  Future<void> _pushItem(Map<String, dynamic> item) async {
    final entity = item['entity'];
    final operation = item['operation'];
    final data = jsonDecode(item['data']);

    switch (entity) {
      case 'sale':
        if (operation == 'create') {
          await _apiService.createSale(data);
        }
        break;
      case 'sale_item':
        if (operation == 'create') {
          await _apiService.addSaleItem(data['saleId'], data);
        }
        break;
      case 'payment':
        if (operation == 'create') {
          await _apiService.processPayment(data['saleId'], data);
        }
        break;
    }
  }

  Future<void> addSaleToQueue(Map<String, dynamic> sale) async {
    await _dbService.addToSyncQueue({
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'entity': 'sale',
      'entityId': sale['id'],
      'operation': 'create',
      'data': jsonEncode(sale),
      'attempts': 0,
      'createdAt': DateTime.now().toIso8601String(),
    });
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
