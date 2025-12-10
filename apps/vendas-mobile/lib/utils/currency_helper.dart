import 'package:intl/intl.dart';

/// Classe utilitária para formatação de moeda
/// Os valores são armazenados em centavos no banco de dados
/// Esta classe converte para o formato correto ao exibir
class CurrencyHelper {
  static final NumberFormat _formatter = NumberFormat.currency(
    locale: 'fr_FR',
    symbol: 'FCFA ',
    decimalDigits: 0,
  );

  /// Formata um valor de centavos para moeda
  /// [valueInCents] - valor em centavos (ex: 40000 = 400 FCFA)
  static String format(dynamic valueInCents) {
    if (valueInCents == null) return 'FCFA 0';

    final num cents = valueInCents is num
        ? valueInCents
        : num.tryParse(valueInCents.toString()) ?? 0;

    // Dividir por 100 para converter de centavos para valor real
    final double realValue = cents / 100;

    return _formatter.format(realValue);
  }

  /// Converte valor em centavos para valor real
  static double toReal(dynamic valueInCents) {
    if (valueInCents == null) return 0;

    final num cents = valueInCents is num
        ? valueInCents
        : num.tryParse(valueInCents.toString()) ?? 0;

    return cents / 100;
  }

  /// Converte valor real para centavos
  static int toCents(dynamic realValue) {
    if (realValue == null) return 0;

    final num value =
        realValue is num ? realValue : num.tryParse(realValue.toString()) ?? 0;

    return (value * 100).round();
  }
}
