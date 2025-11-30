class ApiConfig {
  // URL do Backend no Railway (produção)
  static const String _productionUrl =
      'https://barmanagerbackend-production.up.railway.app/api/v1';

  // URL local para desenvolvimento (descomente se precisar)
  // static const String _localUrl = 'http://192.168.1.228:3000/api/v1';

  static String get baseUrl {
    // Usando Railway (produção) para todas as plataformas
    return _productionUrl;
  }

  // Timeout configurations
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
