import 'package:flutter/foundation.dart';

class AuthProvider with ChangeNotifier {
  bool _isAuthenticated = false;
  Map<String, dynamic>? _user;
  String? _token;

  bool get isAuthenticated => _isAuthenticated;
  Map<String, dynamic>? get user => _user;
  String? get token => _token;

  Future<void> login(String email, String password) async {
    // TODO: Implementar chamada à API
    // TODO: Salvar token localmente
    _isAuthenticated = true;
    _user = {'id': '1', 'email': email, 'fullName': 'Admin User'};
    _token = 'mock_token';
    notifyListeners();
  }

  Future<void> logout() async {
    _isAuthenticated = false;
    _user = null;
    _token = null;
    notifyListeners();
  }

  Future<void> checkAuth() async {
    // TODO: Verificar token salvo
    await Future.delayed(const Duration(seconds: 1));
    notifyListeners();
  }
}
