import 'package:flutter/foundation.dart';
import '../models/models.dart' as models;
import '../services/api_service.dart';

class DataProvider extends ChangeNotifier {
  ApiService? _apiService;

  // Loading states
  bool _isLoading = false;
  String? _error;
  DateTime? _lastRefresh;

  // Data
  models.DashboardStats? _dashboardStats;
  List<models.Product> _products = [];
  List<models.Category> _categories = [];
  List<models.Supplier> _suppliers = [];
  List<models.Sale> _sales = [];
  List<models.Purchase> _purchases = [];
  List<models.Inventory> _inventory = [];
  List<models.Customer> _customers = [];
  List<models.Debt> _debts = [];
  List<models.CashBox> _cashRegisters = [];
  models.CashBox? _currentCashBox;
  List<models.CashMovement> _cashMovements = [];

  // Getters
  bool get isLoading => _isLoading;
  String? get error => _error;
  DateTime? get lastRefresh => _lastRefresh;

  models.DashboardStats? get dashboardStats => _dashboardStats;
  List<models.Product> get products => _products;
  List<models.Category> get categories => _categories;
  List<models.Supplier> get suppliers => _suppliers;
  List<models.Sale> get sales => _sales;
  List<models.Purchase> get purchases => _purchases;
  List<models.Inventory> get inventory => _inventory;
  List<models.Customer> get customers => _customers;
  List<models.Debt> get debts => _debts;
  List<models.CashBox> get cashRegisters => _cashRegisters;
  models.CashBox? get currentCashBox => _currentCashBox;
  List<models.CashMovement> get cashMovements => _cashMovements;

  // Computed getters
  List<models.Inventory> get lowStockItems =>
      _inventory.where((i) => i.isLowStock).toList();
  List<models.Debt> get pendingDebts =>
      _debts.where((d) => d.status == 'pending').toList();
  double get totalDebt => _debts.fold(0.0, (sum, d) => sum + d.remainingAmount);
  double get totalStockValue =>
      _inventory.fold(0.0, (sum, i) => sum + i.stockValue);

  // Set API Service
  void setApiService(ApiService apiService) {
    _apiService = apiService;
  }

  // Initialize
  Future<void> initialize() async {
    if (_apiService != null) {
      await _apiService!.loadToken();
    }
  }

  // ==================== DASHBOARD ====================

  Future<void> loadDashboardStats() async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _dashboardStats = await _apiService!.getDashboardStats();
      _error = null;
      _lastRefresh = DateTime.now();
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  // ==================== PRODUCTS ====================

  Future<void> loadProducts({String? categoryId, String? search}) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _products = await _apiService!.getProducts(
        categoryId: categoryId,
        search: search,
      );
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  Future<void> loadCategories() async {
    if (_apiService == null) return;
    try {
      _categories = await _apiService!.getCategories();
    } catch (e) {
      print('Error loading categories: $e');
    }
  }

  models.Product? getProductById(String id) {
    try {
      return _products.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }

  // ==================== SUPPLIERS ====================

  Future<void> loadSuppliers({String? search}) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _suppliers = await _apiService!.getSuppliers(search: search);
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  models.Supplier? getSupplierById(String id) {
    try {
      return _suppliers.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  // ==================== SALES ====================

  Future<void> loadSales({
    DateTime? startDate,
    DateTime? endDate,
    String? status,
    int? limit,
  }) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _sales = await _apiService!.getSales(
        startDate: startDate,
        endDate: endDate,
        status: status,
        limit: limit,
      );
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  // ==================== PURCHASES ====================

  Future<void> loadPurchases({
    DateTime? startDate,
    DateTime? endDate,
    String? status,
    String? supplierId,
  }) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _purchases = await _apiService!.getPurchases(
        startDate: startDate,
        endDate: endDate,
        status: status,
        supplierId: supplierId,
      );
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  // ==================== INVENTORY ====================

  Future<void> loadInventory({String? search}) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _inventory = await _apiService!.getInventory(search: search);
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  // ==================== CUSTOMERS ====================

  Future<void> loadCustomers({String? search}) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _customers = await _apiService!.getCustomers(search: search);
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  models.Customer? getCustomerById(String id) {
    try {
      return _customers.firstWhere((c) => c.id == id);
    } catch (_) {
      return null;
    }
  }

  // ==================== DEBTS ====================

  Future<void> loadDebts({String? status, String? customerId}) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _debts =
          await _apiService!.getDebts(status: status, customerId: customerId);
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  // ==================== CASH BOX ====================

  Future<void> loadCashBoxHistory({int? limit}) async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _cashRegisters = await _apiService!.getCashBoxHistory(limit: limit ?? 30);
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  Future<void> loadCurrentCashBox() async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      _currentCashBox = await _apiService!.getCurrentCashBox();
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  Future<void> loadCashMovements({String? cashBoxId, int? limit}) async {
    if (_apiService == null) return;
    try {
      _cashMovements = await _apiService!.getCashMovements(
        cashBoxId: cashBoxId,
        limit: limit ?? 50,
      );
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    notifyListeners();
  }

  // ==================== REFRESH ALL ====================

  Future<void> refreshAll() async {
    if (_apiService == null) return;
    _setLoading(true);
    try {
      await Future.wait([
        loadDashboardStats(),
        loadProducts(),
        loadCategories(),
        loadSuppliers(),
        loadCustomers(),
        loadInventory(),
        loadDebts(),
        loadSales(limit: 50),
        loadPurchases(),
        loadCashBoxHistory(limit: 30),
        loadCurrentCashBox(),
      ]);
      _lastRefresh = DateTime.now();
      _error = null;
    } catch (e) {
      _error = e.toString();
    }
    _setLoading(false);
  }

  // ==================== HELPERS ====================

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void clearData() {
    _dashboardStats = null;
    _products = [];
    _categories = [];
    _suppliers = [];
    _sales = [];
    _purchases = [];
    _inventory = [];
    _customers = [];
    _debts = [];
    _cashRegisters = [];
    _currentCashBox = null;
    _cashMovements = [];
    _lastRefresh = null;
    notifyListeners();
  }
}
