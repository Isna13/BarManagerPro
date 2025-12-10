import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final DatabaseService _db = DatabaseService.instance;

  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _user;
  String? _branchId;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get error => _error;
  Map<String, dynamic>? get user => _user;
  String? get branchId => _branchId;
  String? get userId => _user?['id'];
  String? get userName => _user?['name'];
  String? get userRole => _user?['role'];

  AuthProvider() {
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    _isLoading = true;
    notifyListeners();

    try {
      final isValid = await _api.validateToken();
      if (isValid) {
        // Carregar dados do usuário do SharedPreferences
        final prefs = await SharedPreferences.getInstance();
        final userId = prefs.getString('user_id');
        final userName = prefs.getString('user_name');
        final userRole = prefs.getString('user_role');
        _branchId = prefs.getString('branch_id');

        if (userId != null) {
          _user = {
            'id': userId,
            'name': userName,
            'role': userRole,
            'branchId': _branchId,
          };
          _isAuthenticated = true;
        }
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.login(email, password);

      if (response['accessToken'] != null) {
        _user = response['user'];
        _branchId = _user?['branchId'];
        _isAuthenticated = true;

        // Extrair nome do usuário (pode vir como name ou do email)
        final userName = _user?['name'] ??
            _user?['email']?.toString().split('@').first ??
            'Usuário';

        // Salvar dados do usuário
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_id', _user?['id'] ?? '');
        await prefs.setString('user_name', userName);
        await prefs.setString('user_role', _user?['role'] ?? '');
        if (_branchId != null) {
          await prefs.setString('branch_id', _branchId!);
        }

        // Salvar usuário no banco local (usando INSERT OR REPLACE para evitar conflitos)
        try {
          await _db.insert('users', {
            'id': _user?['id'] ?? '',
            'email': email,
            'name': userName,
            'role': _user?['role'] ?? 'user',
            'branch_id': _branchId ?? '',
            'synced': 1,
          });
        } catch (dbError) {
          // Ignorar erro de banco - usuário já pode existir
          debugPrint('Erro ao salvar usuário localmente: $dbError');
        }

        // Iniciar sincronização
        SyncService.instance.syncAll();

        _isLoading = false;
        notifyListeners();
        return true;
      }

      _error = 'Credenciais inválidas';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.logout();

      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('user_id');
      await prefs.remove('user_name');
      await prefs.remove('user_role');
      await prefs.remove('branch_id');
      await prefs.remove('auth_token');

      _user = null;
      _branchId = null;
      _isAuthenticated = false;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
