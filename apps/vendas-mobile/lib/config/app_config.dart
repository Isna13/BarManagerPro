class AppConfig {
  // API Configuration
  static const String apiBaseUrl =
      'https://barmanagerbackend-production.up.railway.app/api/v1';

  // App Info
  static const String appName = 'Vendas Manager Pro';
  static const String appVersion = '1.0.0';

  // Sync Configuration
  static const int syncIntervalSeconds = 30;
  static const int maxRetryAttempts = 3;

  // Cache Configuration
  static const int cacheExpirationMinutes = 60;

  // Default Branch
  static const String defaultBranchId = 'main-branch';
}
