import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  bool _isAuthenticated = false;
  bool _isLoading = false;
  Map<String, dynamic>? _user;
  String? _token;
  String? _error;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get token => _token;
  String? get error => _error;
  ApiService get apiService => _apiService;

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.login(email, password);

      // Extrair token da resposta
      _token = response['accessToken'] ??
          response['access_token'] ??
          response['token'];

      if (_token != null) {
        await _apiService.saveToken(_token!);
        _isAuthenticated = true;

        // Tentar buscar perfil do usuário
        try {
          _user = await _apiService.getProfile();
        } catch (e) {
          // Se falhar, usar dados da resposta de login
          _user = response['user'] ?? {'email': email};
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = 'Token não recebido do servidor';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      _isAuthenticated = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _apiService.clearToken();
    _isAuthenticated = false;
    _user = null;
    _token = null;
    _error = null;
    notifyListeners();
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _apiService.loadToken();

      // Tentar buscar perfil para validar token
      _user = await _apiService.getProfile();
      _isAuthenticated = true;
    } catch (e) {
      _isAuthenticated = false;
      _user = null;
      await _apiService.clearToken();
    }

    _isLoading = false;
    notifyListeners();
  }
}
