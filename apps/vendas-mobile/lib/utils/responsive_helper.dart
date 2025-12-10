import 'package:flutter/material.dart';

/// Alias para facilitar uso nos arquivos
typedef Responsive = ResponsiveHelper;

/// Helper class para responsividade
class ResponsiveHelper {
  static double screenWidth(BuildContext context) =>
      MediaQuery.of(context).size.width;

  static double screenHeight(BuildContext context) =>
      MediaQuery.of(context).size.height;

  static bool isMobile(BuildContext context) => screenWidth(context) < 600;

  static bool isTablet(BuildContext context) =>
      screenWidth(context) >= 600 && screenWidth(context) < 1024;

  static bool isDesktop(BuildContext context) => screenWidth(context) >= 1024;

  static bool isSmallMobile(BuildContext context) => screenWidth(context) < 360;

  static bool isLargeMobile(BuildContext context) =>
      screenWidth(context) >= 360 && screenWidth(context) < 600;

  /// Retorna o número de colunas para grids baseado no tamanho da tela
  static int gridCrossAxisCount(BuildContext context) {
    final width = screenWidth(context);
    if (width < 400) return 2;
    if (width < 600) return 2;
    if (width < 900) return 3;
    if (width < 1200) return 4;
    return 5;
  }

  /// Padding horizontal responsivo
  static double horizontalPadding(BuildContext context) {
    final width = screenWidth(context);
    if (width < 400) return 12;
    if (width < 600) return 16;
    if (width < 900) return 24;
    return 32;
  }

  /// Padding geral responsivo
  static double padding(BuildContext context) {
    final width = screenWidth(context);
    if (width < 360) return 12;
    if (width < 400) return 14;
    if (width < 600) return 16;
    if (width < 900) return 20;
    return 24;
  }

  /// Tamanho de fonte responsivo
  static double fontSize(BuildContext context, double baseSize) {
    final width = screenWidth(context);
    if (width < 360) return baseSize * 0.85;
    if (width < 400) return baseSize * 0.9;
    if (width < 600) return baseSize;
    return baseSize * 1.1;
  }

  /// Espaçamento responsivo
  static double spacing(BuildContext context, {double base = 16}) {
    final width = screenWidth(context);
    if (width < 360) return base * 0.7;
    if (width < 400) return base * 0.85;
    if (width < 600) return base;
    return base * 1.2;
  }

  /// Tamanho de ícone responsivo
  static double iconSize(BuildContext context, {double base = 24}) {
    final width = screenWidth(context);
    if (width < 360) return base * 0.85;
    if (width < 400) return base * 0.9;
    return base;
  }

  /// Altura de card responsiva
  static double cardHeight(BuildContext context, {double base = 100}) {
    final width = screenWidth(context);
    if (width < 360) return base * 0.85;
    if (width < 400) return base * 0.9;
    return base;
  }
}

/// Extension para facilitar o uso
extension ResponsiveExtension on BuildContext {
  bool get isMobile => ResponsiveHelper.isMobile(this);
  bool get isTablet => ResponsiveHelper.isTablet(this);
  bool get isDesktop => ResponsiveHelper.isDesktop(this);
  double get screenWidth => ResponsiveHelper.screenWidth(this);
  double get screenHeight => ResponsiveHelper.screenHeight(this);
  double get horizontalPadding => ResponsiveHelper.horizontalPadding(this);
  int get gridColumns => ResponsiveHelper.gridCrossAxisCount(this);

  double responsiveFontSize(double base) =>
      ResponsiveHelper.fontSize(this, base);
  double responsiveSpacing({double base = 16}) =>
      ResponsiveHelper.spacing(this, base: base);
  double responsiveIconSize({double base = 24}) =>
      ResponsiveHelper.iconSize(this, base: base);
}
