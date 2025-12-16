/// Enum global de métodos de pagamento - DEVE SER IDÊNTICO em todos os apps
/// Mobile, Backend e Electron devem usar os mesmos valores
class PaymentMethod {
  // Constantes globais - usar EXATAMENTE estes valores
  static const String cash = 'CASH';
  static const String orangeMoney = 'ORANGE_MONEY';
  static const String teletaku = 'TELETAKU';
  static const String vale = 'VALE';
  static const String mixed = 'MIXED';
  
  // Lista de todos os métodos válidos
  static const List<String> validMethods = [
    cash,
    orangeMoney,
    teletaku,
    vale,
    mixed,
  ];
  
  /// Valida se o método é válido
  static bool isValid(String? method) {
    if (method == null || method.isEmpty) return false;
    return validMethods.contains(method.toUpperCase());
  }
  
  /// Normaliza o método de pagamento para o padrão global
  static String normalize(String? method) {
    if (method == null || method.isEmpty) {
      throw ArgumentError('Método de pagamento não pode ser nulo ou vazio');
    }
    
    final upperMethod = method.toUpperCase();
    
    // Mapeamento de valores antigos/alternativos para o padrão
    switch (upperMethod) {
      case 'CASH':
      case 'DINHEIRO':
      case 'MONEY':
        return cash;
      case 'ORANGE_MONEY':
      case 'ORANGE':
      case 'MOBILE_MONEY':
        return orangeMoney;
      case 'TELETAKU':
        return teletaku;
      case 'VALE':
      case 'DEBT':
      case 'CREDIT':
      case 'FIADO':
        return vale;
      case 'MIXED':
      case 'MISTO':
      case 'MULTIPLE':
        return mixed;
      default:
        throw ArgumentError('Método de pagamento inválido: $method');
    }
  }
  
  /// Retorna nome amigável para exibição
  static String getDisplayName(String method) {
    switch (method.toUpperCase()) {
      case 'CASH':
        return 'Dinheiro';
      case 'ORANGE_MONEY':
        return 'Orange Money';
      case 'TELETAKU':
        return 'TeleTaku';
      case 'VALE':
        return 'Vale';
      case 'MIXED':
        return 'Pagamento Misto';
      default:
        return method;
    }
  }
}
