import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kDebugMode, debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../models/models.dart' as models;

class ApiService {
  late Dio _dio;
  String? _token;

  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (_token != null) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          if (kDebugMode) {
            debugPrint('🌐 API Request: ${options.method} ${options.path}');
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (kDebugMode) {
            debugPrint('✅ API Response: ${response.statusCode}');
          }
          return handler.next(response);
        },
        onError: (error, handler) {
          if (kDebugMode) {
            debugPrint('❌ API Error: ${error.message}');
          }
          return handler.next(error);
        },
      ),
    );
  }

  // ==================== AUTH ====================

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  Future<void> saveToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }

  Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  bool get isAuthenticated => _token != null;

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _dio.post(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getProfile() async {
    try {
      final response = await _dio.get('/auth/profile');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== DASHBOARD ====================

  Future<models.DashboardStats> getDashboardStats({String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;

      final response =
          await _dio.get('/reports/dashboard', queryParameters: queryParams);
      return models.DashboardStats.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== PRODUCTS ====================

  Future<List<models.Product>> getProducts(
      {String? categoryId, String? search, bool? active}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (categoryId != null) queryParams['categoryId'] = categoryId;
      if (search != null) queryParams['search'] = search;
      if (active != null) queryParams['active'] = active;

      final response =
          await _dio.get('/products', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Product.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<models.Product?> getProductById(String id) async {
    try {
      final response = await _dio.get('/products/$id');
      return models.Product.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<models.Category>> getCategories() async {
    try {
      final response = await _dio.get('/products/categories');
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Category.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== SUPPLIERS ====================

  Future<List<models.Supplier>> getSuppliers(
      {String? search, bool? active}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (search != null) queryParams['search'] = search;
      if (active != null) queryParams['active'] = active;

      final response =
          await _dio.get('/suppliers', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Supplier.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<models.Supplier?> getSupplierById(String id) async {
    try {
      final response = await _dio.get('/suppliers/$id');
      return models.Supplier.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== SALES ====================

  Future<List<models.Sale>> getSales({
    String? status,
    DateTime? startDate,
    DateTime? endDate,
    String? customerId,
    int? limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;
      if (startDate != null)
        queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();
      if (customerId != null) queryParams['customerId'] = customerId;
      if (limit != null) queryParams['limit'] = limit;

      final response = await _dio.get('/sales', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Sale.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<models.Sale?> getSaleById(String id) async {
    try {
      final response = await _dio.get('/sales/$id');
      return models.Sale.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== PURCHASES ====================

  Future<List<models.Purchase>> getPurchases({
    String? status,
    String? supplierId,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;
      if (supplierId != null) queryParams['supplierId'] = supplierId;
      if (startDate != null)
        queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();

      final response =
          await _dio.get('/purchases', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Purchase.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<models.Purchase?> getPurchaseById(String id) async {
    try {
      final response = await _dio.get('/purchases/$id');
      return models.Purchase.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== INVENTORY ====================

  Future<List<models.Inventory>> getInventory({
    String? branchId,
    bool? lowStock,
    String? search,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;
      if (lowStock != null) queryParams['lowStock'] = lowStock;
      if (search != null) queryParams['search'] = search;

      final response =
          await _dio.get('/inventory', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Inventory.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<models.InventoryMovement>> getInventoryMovements({
    String? productId,
    String? branchId,
    String? movementType,
    DateTime? startDate,
    DateTime? endDate,
    int? limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (productId != null) queryParams['productId'] = productId;
      if (branchId != null) queryParams['branchId'] = branchId;
      if (movementType != null) queryParams['movementType'] = movementType;
      if (startDate != null)
        queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();
      if (limit != null) queryParams['limit'] = limit;

      final response =
          await _dio.get('/inventory/movements', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data
          .map((json) => models.InventoryMovement.fromJson(json))
          .toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getInventoryValuation({String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;

      final response =
          await _dio.get('/inventory/valuation', queryParameters: queryParams);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== CUSTOMERS ====================

  Future<List<models.Customer>> getCustomers(
      {String? search, bool? active}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (search != null) queryParams['search'] = search;
      if (active != null) queryParams['active'] = active;

      final response =
          await _dio.get('/customers', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Customer.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<models.Customer?> getCustomerById(String id) async {
    try {
      final response = await _dio.get('/customers/$id');
      return models.Customer.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== DEBTS ====================

  Future<List<models.Debt>> getDebts(
      {String? status, String? customerId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;
      if (customerId != null) queryParams['customerId'] = customerId;

      final response = await _dio.get('/debts', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.Debt.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getDebtsSummary() async {
    try {
      final response = await _dio.get('/debts/summary');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== CASH BOX ====================

  Future<List<models.CashBox>> getCashBoxHistory({
    String? branchId,
    DateTime? startDate,
    DateTime? endDate,
    int? limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;
      if (startDate != null)
        queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();
      if (limit != null) queryParams['limit'] = limit;

      final response =
          await _dio.get('/cash-box/history', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.CashBox.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<models.CashBox?> getCurrentCashBox({String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;

      final response =
          await _dio.get('/cash-box/current', queryParameters: queryParams);

      // Tratar null, string vazia, ou resposta vazia
      if (response.data == null ||
          response.data == '' ||
          (response.data is String && response.data.isEmpty)) {
        return null;
      }

      // Se for um Map vazio, também retorna null
      if (response.data is Map && (response.data as Map).isEmpty) {
        return null;
      }

      return models.CashBox.fromJson(response.data);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _handleError(e);
    }
  }

  Future<List<models.CashMovement>> getCashMovements({
    String? cashBoxId,
    String? movementType,
    int? limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (cashBoxId != null) queryParams['cashBoxId'] = cashBoxId;
      if (movementType != null) queryParams['movementType'] = movementType;
      if (limit != null) queryParams['limit'] = limit;

      final response =
          await _dio.get('/cash-box/movements', queryParameters: queryParams);
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.CashMovement.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 🎯 ENDPOINT CRÍTICO: Detalhes completos do caixa (paridade com Electron)
  /// Retorna produtos vendidos, custos, lucros e métricas para auditoria financeira
  Future<models.CashBoxDetails?> getCashBoxDetails(String cashBoxId) async {
    try {
      final response = await _dio.get('/cash-box/$cashBoxId/details');

      if (response.data == null || response.data == '') {
        return null;
      }

      return models.CashBoxDetails.fromJson(response.data);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _handleError(e);
    }
  }

  // ==================== REPORTS ====================

  Future<Map<String, dynamic>> getSalesReport({
    required DateTime startDate,
    required DateTime endDate,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get(
        '/reports/sales',
        queryParameters: {
          'startDate': startDate.toIso8601String(),
          'endDate': endDate.toIso8601String(),
          if (branchId != null) 'branchId': branchId,
        },
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<models.TopProduct>> getTopProducts({int limit = 10}) async {
    try {
      final response = await _dio
          .get('/reports/top-products', queryParameters: {'limit': limit});
      final List<dynamic> data =
          response.data is List ? response.data : response.data['data'] ?? [];
      return data.map((json) => models.TopProduct.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getCashFlowReport({
    required DateTime startDate,
    required DateTime endDate,
    String? branchId,
  }) async {
    try {
      final response = await _dio.get(
        '/reports/cash-flow',
        queryParameters: {
          'startDate': startDate.toIso8601String(),
          'endDate': endDate.toIso8601String(),
          if (branchId != null) 'branchId': branchId,
        },
      );
      return response.data;
    } on DioException catch (e) {
      // Se o endpoint não existir, retorna dados padrão
      if (e.response?.statusCode == 404) {
        return {
          'totalIn': 0.0,
          'totalOut': 0.0,
          'balance': 0.0,
          'transactions': [],
        };
      }
      throw _handleError(e);
    }
  }

  // ==================== SYNC ====================

  Future<Map<String, dynamic>> syncData({
    required String entity,
    DateTime? lastSync,
  }) async {
    try {
      final queryParams = <String, dynamic>{'entity': entity};
      if (lastSync != null)
        queryParams['lastSync'] = lastSync.toIso8601String();

      final response = await _dio.get('/sync', queryParameters: queryParams);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== ERROR HANDLING ====================

  String _handleError(DioException error) {
    if (error.response != null) {
      final statusCode = error.response!.statusCode;
      final data = error.response!.data;

      if (statusCode == 401) {
        return 'Sessão expirada. Faça login novamente.';
      } else if (statusCode == 403) {
        return 'Acesso negado.';
      } else if (statusCode == 404) {
        return 'Recurso não encontrado.';
      } else if (statusCode == 500) {
        return 'Erro interno do servidor.';
      }

      return data['message'] ?? 'Erro desconhecido';
    } else if (error.type == DioExceptionType.connectionTimeout) {
      return 'Tempo de conexão esgotado';
    } else if (error.type == DioExceptionType.receiveTimeout) {
      return 'Tempo de resposta esgotado';
    } else if (error.type == DioExceptionType.connectionError) {
      return 'Sem conexão com o servidor';
    } else {
      return 'Erro de conexão com servidor';
    }
  }
}
