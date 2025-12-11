import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';

class ProductsProvider extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final DatabaseService _db = DatabaseService.instance;
  final SyncService _sync = SyncService.instance;

  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _categories = [];
  Map<String, Map<String, dynamic>> _inventory = {};
  bool _isLoading = false;
  String? _error;
  String? _selectedCategoryId;
  String _searchQuery = '';

  List<Map<String, dynamic>> get products => _products;
  List<Map<String, dynamic>> get categories => _categories;
  Map<String, Map<String, dynamic>> get inventory => _inventory;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get selectedCategoryId => _selectedCategoryId;

  // Produtos filtrados por categoria e busca
  List<Map<String, dynamic>> get filteredProducts {
    return _products.where((p) {
      final isActive = p['is_active'] == 1 || p['isActive'] == true;
      if (!isActive) return false;

      // Filtrar por categoria
      if (_selectedCategoryId != null && _selectedCategoryId!.isNotEmpty) {
        final categoryId = p['category_id'] ?? p['categoryId'];
        if (categoryId != _selectedCategoryId) return false;
      }

      // Filtrar por busca
      if (_searchQuery.isNotEmpty) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        final sku = (p['sku'] ?? '').toString().toLowerCase();
        final query = _searchQuery.toLowerCase();
        if (!name.contains(query) && !sku.contains(query)) return false;
      }

      return true;
    }).toList();
  }

  Future<void> loadProducts() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      if (_sync.isOnline) {
        // Carregar do servidor
        final results = await _api.getProducts(isActive: true);
        _products = results.map((e) => Map<String, dynamic>.from(e)).toList();

        // Salvar localmente
        for (final product in _products) {
          await _saveProductLocally(product);
        }
      } else {
        // Carregar do banco local
        final results = await _db.query(
          'products',
          where: 'is_active = ?',
          whereArgs: [1],
          orderBy: 'name ASC',
        );
        _products = results;
      }
    } catch (e) {
      _error = e.toString();

      // Fallback para banco local
      try {
        final results = await _db.query(
          'products',
          where: 'is_active = ?',
          whereArgs: [1],
          orderBy: 'name ASC',
        );
        _products = results;
      } catch (_) {}
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadCategories() async {
    try {
      if (_sync.isOnline) {
        final results = await _api.getCategories();
        _categories = results.map((e) => Map<String, dynamic>.from(e)).toList();

        // Salvar localmente
        for (final category in _categories) {
          await _saveCategoryLocally(category);
        }
      } else {
        final results = await _db.query(
          'categories',
          where: 'is_active = ?',
          whereArgs: [1],
          orderBy: 'name ASC',
        );
        _categories = results;
      }
    } catch (e) {
      // Fallback para banco local
      try {
        final results = await _db.query(
          'categories',
          where: 'is_active = ?',
          whereArgs: [1],
          orderBy: 'name ASC',
        );
        _categories = results;
      } catch (_) {}
    }
    notifyListeners();
  }

  Future<void> loadInventory({String? branchId}) async {
    try {
      // PRIMEIRO: carregar inventário local para preservar ajustes não sincronizados
      final localResults = await _db.query('inventory');
      final localInventory = <String, Map<String, dynamic>>{};

      for (final item in localResults) {
        final productId = item['product_id'];
        if (productId != null) {
          localInventory[productId] = item;
        }
      }

      if (_sync.isOnline) {
        final results = await _api.getInventory(branchId: branchId);
        _inventory = {};

        for (final item in results) {
          final productId = item['productId'] ?? item['product_id'];
          if (productId != null) {
            // Verificar se há estoque local não sincronizado
            final localItem = localInventory[productId];
            // Comparar synced como int (0 = não sincronizado)
            final isNotSynced = localItem != null &&
                (localItem['synced'] == 0 ||
                    localItem['synced'] == '0' ||
                    localItem['synced'] == false);

            if (isNotSynced) {
              // MANTER estoque local (tem ajustes pendentes)
              debugPrint(
                  '📦 Mantendo estoque local não sincronizado para $productId: ${localItem['qty_units']} (synced=${localItem['synced']})');
              _inventory[productId] = Map<String, dynamic>.from(localItem);
            } else {
              // Usar estoque do servidor
              _inventory[productId] = Map<String, dynamic>.from(item);
              await _saveInventoryLocally(item);
            }
          }
        }
      } else {
        _inventory = localInventory;
      }
    } catch (e) {
      // Fallback para banco local
      try {
        final results = await _db.query('inventory');
        _inventory = {};

        for (final item in results) {
          final productId = item['product_id'];
          if (productId != null) {
            _inventory[productId] = item;
          }
        }
      } catch (_) {}
    }
    notifyListeners();
  }

  void setSelectedCategory(String? categoryId) {
    _selectedCategoryId = categoryId;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  int getProductStock(String productId) {
    final inv = _inventory[productId];
    if (inv == null) return 0;
    return inv['qty_units'] ?? inv['qtyUnits'] ?? 0;
  }

  Map<String, dynamic>? getProductById(String productId) {
    try {
      return _products.firstWhere((p) => p['id'] == productId);
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic>? getCategoryById(String categoryId) {
    try {
      return _categories.firstWhere((c) => c['id'] == categoryId);
    } catch (_) {
      return null;
    }
  }

  // Calcular preço (considerando Muntu)
  int calculatePrice(Map<String, dynamic> product, int quantity, bool isMuntu) {
    if (isMuntu) {
      final muntuQuantity =
          (product['muntu_quantity'] ?? product['muntuQuantity'] ?? 0) as num;
      final muntuPrice =
          (product['muntu_price'] ?? product['muntuPrice'] ?? 0) as num;

      if (muntuQuantity > 0 && muntuPrice > 0) {
        final sets = quantity ~/ muntuQuantity.toInt();
        final remainder = quantity % muntuQuantity.toInt();
        final unitPrice =
            (product['price_unit'] ?? product['priceUnit'] ?? 0) as num;

        return (sets * muntuPrice.toInt()) + (remainder * unitPrice.toInt());
      }
    }

    final unitPrice =
        (product['price_unit'] ?? product['priceUnit'] ?? 0) as num;
    return (quantity * unitPrice.toInt());
  }

  Future<void> _saveProductLocally(Map<String, dynamic> product) async {
    final mappedData = <String, dynamic>{
      'id': product['id'],
      'name': product['name'],
      'sku': product['sku'],
      'category_id': product['categoryId'] ?? product['category_id'],
      'price_unit': product['priceUnit'] ?? product['price_unit'] ?? 0,
      'price_box': product['priceBox'] ?? product['price_box'],
      'cost_unit': product['costUnit'] ?? product['cost_unit'] ?? 0,
      'cost_box': product['costBox'] ?? product['cost_box'],
      'units_per_box': product['unitsPerBox'] ?? product['units_per_box'] ?? 1,
      'is_muntu_eligible':
          (product['isMuntuEligible'] ?? product['is_muntu_eligible']) == true
              ? 1
              : 0,
      'muntu_quantity': product['muntuQuantity'] ?? product['muntu_quantity'],
      'muntu_price': product['muntuPrice'] ?? product['muntu_price'],
      'is_active':
          (product['isActive'] ?? product['is_active'] ?? true) == true ? 1 : 0,
      'barcode': product['barcode'],
      'image_url': product['imageUrl'] ?? product['image_url'],
      'synced': 1,
    };

    await _db.insert('products', mappedData);
  }

  Future<void> _saveCategoryLocally(Map<String, dynamic> category) async {
    final mappedData = <String, dynamic>{
      'id': category['id'],
      'name': category['name'],
      'description': category['description'],
      'color': category['color'],
      'is_active':
          (category['isActive'] ?? category['is_active'] ?? true) == true
              ? 1
              : 0,
      'synced': 1,
    };

    await _db.insert('categories', mappedData);
  }

  Future<void> _saveInventoryLocally(Map<String, dynamic> inventory) async {
    final mappedData = <String, dynamic>{
      'id': inventory['id'],
      'product_id': inventory['productId'] ?? inventory['product_id'],
      'branch_id': inventory['branchId'] ?? inventory['branch_id'],
      'qty_units': inventory['qtyUnits'] ?? inventory['qty_units'] ?? 0,
      'low_stock_alert':
          inventory['lowStockAlert'] ?? inventory['low_stock_alert'] ?? 10,
      'synced': 1,
    };

    await _db.insert('inventory', mappedData);
  }

  /// Decrementa o estoque de um produto localmente e sincroniza com servidor
  Future<bool> decrementStock(String productId, int quantity) async {
    try {
      final inv = _inventory[productId];
      if (inv == null) {
        debugPrint('❌ Inventário não encontrado para produto: $productId');
        return false;
      }

      final currentQty = inv['qty_units'] ?? inv['qtyUnits'] ?? 0;
      final newQty = currentQty - quantity;
      // Usar branchId do inventário ou fallback para main-branch
      final branchId = inv['branch_id'] ?? inv['branchId'] ?? 'main-branch';
      final invId = inv['id'];

      debugPrint('═══════════════════════════════════════════════════════');
      debugPrint('📦 DECREMENTO DE ESTOQUE');
      debugPrint('   Produto ID: $productId');
      debugPrint('   Inventário ID: $invId');
      debugPrint('   Branch ID: $branchId');
      debugPrint('   Quantidade anterior: $currentQty');
      debugPrint('   Quantidade vendida: $quantity');
      debugPrint('   Nova quantidade: $newQty');
      debugPrint('═══════════════════════════════════════════════════════');

      // Atualizar em memória
      _inventory[productId]!['qty_units'] = newQty;

      // Atualizar no banco local
      if (invId != null) {
        await _db.update(
          'inventory',
          {'qty_units': newQty, 'synced': 0},
          where: 'id = ?',
          whereArgs: [invId],
        );
        debugPrint('💾 Banco local atualizado: qty=$newQty, synced=0');

        // Marcar para sincronização com dados do ajuste
        await _sync.markForSync(
          entityType: 'inventory',
          entityId: invId,
          action: 'adjust',
          data: {
            'productId': productId,
            'branchId': branchId,
            'adjustment': -quantity, // Negativo porque é venda
            'reason': 'Venda mobile',
          },
        );
      }

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Erro ao decrementar estoque: $e');
      return false;
    }
  }

  /// Decrementa o estoque de múltiplos itens (para vendas)
  Future<void> decrementStockForSale(List<Map<String, dynamic>> items) async {
    for (final item in items) {
      final productId = item['productId'] ?? item['product_id'];
      final quantity = item['quantity'] ?? item['qty_units'] ?? 0;
      if (productId != null && quantity > 0) {
        await decrementStock(productId, quantity);
      }
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
