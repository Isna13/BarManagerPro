import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

class ApiService {
  static final ApiService instance = ApiService._init();
  late Dio _dio;
  String? _token;

  ApiService._init() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_token != null) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        return handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          // Token expirado - limpar e redirecionar para login
          _token = null;
        }
        return handler.next(error);
      },
    ));
  }

  void setToken(String token) {
    _token = token;
  }

  void clearToken() {
    _token = null;
  }

  bool get hasToken => _token != null;

  // ==================== AUTH ====================
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.data['accessToken'] != null) {
        _token = response.data['accessToken'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', _token!);
      }

      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  Future<bool> validateToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      if (token == null) return false;

      _token = token;
      final response = await _dio.get('/auth/profile');
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // ==================== PRODUTOS ====================
  Future<List<dynamic>> getProducts({bool? isActive}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (isActive != null) queryParams['isActive'] = isActive;

      final response =
          await _dio.get('/products', queryParameters: queryParams);
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getCategories() async {
    try {
      final response = await _dio.get('/products/categories');
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== INVENTÁRIO ====================
  Future<List<dynamic>> getInventory({String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;

      final response =
          await _dio.get('/inventory', queryParameters: queryParams);
      return response.data is List
          ? response.data
          : response.data['data'] ?? [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// Ajusta o estoque de um produto (negativo para venda, positivo para entrada)
  Future<dynamic> adjustStockByProduct({
    required String productId,
    required String branchId,
    required int adjustment,
    String? reason,
  }) async {
    try {
      final response = await _dio.put('/inventory/adjust-by-product', data: {
        'productId': productId,
        'branchId': branchId,
        'adjustment': adjustment,
        'reason': reason ?? 'Venda mobile',
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== CLIENTES ====================
  Future<List<dynamic>> getCustomers() async {
    try {
      final response = await _dio.get('/customers');
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> getCustomerById(String id) async {
    try {
      final response = await _dio.get('/customers/$id');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== CAIXA ====================
  Future<dynamic> getCurrentCashBox() async {
    try {
      final response = await _dio.get('/cash-box/current');
      if (response.data == null ||
          response.data == '' ||
          (response.data is String && response.data.isEmpty)) {
        return null;
      }
      if (response.data is Map && (response.data as Map).isEmpty) {
        return null;
      }
      return response.data;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getCashBoxHistory({int? limit}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (limit != null) queryParams['limit'] = limit;

      final response =
          await _dio.get('/cash-box/history', queryParameters: queryParams);
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> openCashBox({
    required String boxNumber,
    required String branchId,
    required String openedBy,
    required int openingCash,
  }) async {
    try {
      final response = await _dio.post('/cash-box/open', data: {
        'boxNumber': boxNumber,
        'branchId': branchId,
        'openedBy': openedBy,
        'openingCash': openingCash,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> closeCashBox(
    String id, {
    required int closingCash,
    required int difference,
    required String closedBy,
    String? notes,
  }) async {
    try {
      final response = await _dio.post('/cash-box/$id/close', data: {
        'closingCash': closingCash,
        'difference': difference,
        'closedBy': closedBy,
        'notes': notes,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== MESAS ====================
  Future<List<dynamic>> getTables({String? branchId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (branchId != null) queryParams['branchId'] = branchId;

      final response = await _dio.get('/tables', queryParameters: queryParams);
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getTablesOverview(String branchId) async {
    try {
      final response = await _dio.get('/tables/overview/$branchId');
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> getTableSession(String sessionId) async {
    try {
      final response = await _dio.get('/tables/sessions/$sessionId');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> openTable({
    required String tableId,
    required String branchId,
    required String openedBy,
  }) async {
    try {
      final response = await _dio.post('/tables/sessions/open', data: {
        'tableId': tableId,
        'branchId': branchId,
        'openedBy': openedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> addCustomerToTable({
    required String sessionId,
    required String customerName,
    String? customerId,
    required String addedBy,
  }) async {
    try {
      final response = await _dio.post('/tables/customers/add', data: {
        'sessionId': sessionId,
        'customerName': customerName,
        'customerId': customerId,
        'addedBy': addedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> addOrderToTable({
    required String sessionId,
    required String tableCustomerId,
    required String productId,
    required int qtyUnits,
    required bool isMuntu,
    required String orderedBy,
  }) async {
    try {
      final response = await _dio.post('/tables/orders/add', data: {
        'sessionId': sessionId,
        'tableCustomerId': tableCustomerId,
        'productId': productId,
        'qtyUnits': qtyUnits,
        'isMuntu': isMuntu,
        'orderedBy': orderedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> processTablePayment({
    required String sessionId,
    String? tableCustomerId,
    required String method,
    required int amount,
    required String processedBy,
    required bool isSessionPayment,
  }) async {
    try {
      final endpoint = isSessionPayment
          ? '/tables/payments/session'
          : '/tables/payments/customer';
      final response = await _dio.post(endpoint, data: {
        'sessionId': sessionId,
        'tableCustomerId': tableCustomerId,
        'method': method,
        'amount': amount,
        'processedBy': processedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Fechar sessão da mesa
  Future<dynamic> closeTableSession({
    required String sessionId,
    required String closedBy,
  }) async {
    try {
      final response = await _dio.post('/tables/sessions/close', data: {
        'sessionId': sessionId,
        'closedBy': closedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Cancelar pedido
  Future<dynamic> cancelTableOrder({
    required String orderId,
    required String cancelledBy,
  }) async {
    try {
      final response = await _dio.post('/tables/orders/cancel', data: {
        'orderId': orderId,
        'cancelledBy': cancelledBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Limpar pedidos pagos
  Future<dynamic> clearPaidOrders({
    required String sessionId,
    required String tableCustomerId,
    required String clearedBy,
  }) async {
    try {
      final response =
          await _dio.post('/tables/payments/clear-paid-orders', data: {
        'sessionId': sessionId,
        'tableCustomerId': tableCustomerId,
        'clearedBy': clearedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Transferir item entre clientes
  Future<dynamic> transferTableOrder({
    required String orderId,
    required String fromCustomerId,
    required String toCustomerId,
    required int qtyUnits,
    required String transferredBy,
  }) async {
    try {
      final response = await _dio.post('/tables/orders/transfer', data: {
        'orderId': orderId,
        'fromCustomerId': fromCustomerId,
        'toCustomerId': toCustomerId,
        'qtyUnits': qtyUnits,
        'transferredBy': transferredBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Transferir mesa
  Future<dynamic> transferTable({
    required String sessionId,
    required String toTableId,
    required String transferredBy,
  }) async {
    try {
      final response = await _dio.post('/tables/sessions/transfer', data: {
        'sessionId': sessionId,
        'toTableId': toTableId,
        'transferredBy': transferredBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Transferir clientes para outra mesa
  Future<dynamic> transferCustomers({
    required String sessionId,
    required List<String> customerIds,
    required String toTableId,
    required String transferredBy,
  }) async {
    try {
      final response =
          await _dio.post('/tables/sessions/transfer-customers', data: {
        'sessionId': sessionId,
        'customerIds': customerIds,
        'toTableId': toTableId,
        'transferredBy': transferredBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Unir mesas
  Future<dynamic> mergeTables({
    required List<String> sessionIds,
    required String targetTableId,
    required String mergedBy,
  }) async {
    try {
      final response = await _dio.post('/tables/sessions/merge', data: {
        'sessionIds': sessionIds,
        'targetTableId': targetTableId,
        'mergedBy': mergedBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Separar mesa
  Future<dynamic> splitTable({
    required String sessionId,
    required List<Map<String, dynamic>> distributions,
    required String splitBy,
  }) async {
    try {
      final response = await _dio.post('/tables/sessions/split', data: {
        'sessionId': sessionId,
        'distributions': distributions,
        'splitBy': splitBy,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Histórico de ações da sessão
  Future<List<dynamic>> getSessionHistory(String sessionId) async {
    try {
      final response = await _dio.get('/tables/sessions/$sessionId/actions');
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Criar nova mesa
  Future<dynamic> createTable({
    required String branchId,
    required String number,
    int seats = 4,
    String? area,
  }) async {
    try {
      final response = await _dio.post('/tables', data: {
        'branchId': branchId,
        'number': number,
        'seats': seats,
        'area': area,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Buscar informações de crédito do cliente
  Future<Map<String, dynamic>?> getCustomerCredit(String customerId) async {
    try {
      final response = await _dio.get('/customers/$customerId');
      return response.data;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _handleError(e);
    }
  }

  // Buscar vales pendentes de clientes
  Future<List<dynamic>> getCustomersPendingDebts(
      List<String> customerIds) async {
    try {
      final response = await _dio.post('/debts/customers-pending', data: {
        'customerIds': customerIds,
      });
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== VENDAS ====================
  Future<dynamic> createSale(Map<String, dynamic> saleData) async {
    try {
      final response = await _dio.post('/sales', data: saleData);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> addSaleItem(
      String saleId, Map<String, dynamic> itemData) async {
    try {
      final response = await _dio.post('/sales/$saleId/items', data: itemData);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> addSalePayment(
      String saleId, Map<String, dynamic> paymentData) async {
    try {
      final response =
          await _dio.post('/sales/$saleId/payments', data: paymentData);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<List<dynamic>> getSales(
      {String? status, DateTime? startDate, DateTime? endDate}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status;
      if (startDate != null)
        queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();

      final response = await _dio.get('/sales', queryParameters: queryParams);
      return response.data is List ? response.data : [];
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<dynamic> closeSale(String saleId) async {
    try {
      final response = await _dio.post('/sales/$saleId/close');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== DÉBITOS ====================
  Future<dynamic> createDebt(Map<String, dynamic> debtData) async {
    try {
      final response = await _dio.post('/debts', data: debtData);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== FIDELIDADE ====================
  Future<Map<String, dynamic>> addLoyaltyPoints({
    required String customerId,
    required int points,
    String? reason,
  }) async {
    try {
      final response = await _dio.post('/loyalty/points', data: {
        'customerId': customerId,
        'points': points,
        'reason': reason ?? 'Pontos de compra',
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== SYNC ====================
  Future<Map<String, dynamic>> syncData(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post('/sync', data: data);
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Error handler
  String _handleError(DioException e) {
    if (e.response != null) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'];
      }
      return 'Erro ${e.response?.statusCode}: ${e.response?.statusMessage}';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Tempo limite de conexão excedido';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Sem conexão com o servidor';
    }
    return e.message ?? 'Erro desconhecido';
  }
}
