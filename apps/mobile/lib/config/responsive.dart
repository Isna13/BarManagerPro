import 'package:flutter/material.dart';

/// Utilitário para design responsivo
class Responsive {
  static late MediaQueryData _mediaQueryData;
  static late double screenWidth;
  static late double screenHeight;
  static late double blockSizeHorizontal;
  static late double blockSizeVertical;
  static late double safeAreaHorizontal;
  static late double safeAreaVertical;
  static late double safeBlockHorizontal;
  static late double safeBlockVertical;
  static late bool isTablet;
  static late bool isSmallScreen;
  static late bool isLargeScreen;
  static late Orientation orientation;

  static void init(BuildContext context) {
    _mediaQueryData = MediaQuery.of(context);
    screenWidth = _mediaQueryData.size.width;
    screenHeight = _mediaQueryData.size.height;
    blockSizeHorizontal = screenWidth / 100;
    blockSizeVertical = screenHeight / 100;
    orientation = _mediaQueryData.orientation;

    final safeAreaH = _mediaQueryData.padding.left + _mediaQueryData.padding.right;
    final safeAreaV = _mediaQueryData.padding.top + _mediaQueryData.padding.bottom;
    safeAreaHorizontal = (screenWidth - safeAreaH) / 100;
    safeAreaVertical = (screenHeight - safeAreaV) / 100;
    safeBlockHorizontal = safeAreaHorizontal;
    safeBlockVertical = safeAreaVertical;

    // Detectar tipo de dispositivo
    isTablet = screenWidth >= 600;
    isSmallScreen = screenWidth < 360;
    isLargeScreen = screenWidth >= 768;
  }

  /// Retorna o número de colunas baseado no tamanho da tela
  static int getGridColumns({int mobile = 2, int tablet = 3, int desktop = 4}) {
    if (isLargeScreen) return desktop;
    if (isTablet) return tablet;
    return mobile;
  }

  /// Retorna o aspect ratio baseado no tamanho da tela
  static double getCardAspectRatio({double mobile = 1.4, double tablet = 1.3, double desktop = 1.2}) {
    if (isLargeScreen) return desktop;
    if (isTablet) return tablet;
    return mobile;
  }

  /// Retorna um valor proporcional à largura da tela
  static double wp(double percentage) => screenWidth * percentage / 100;

  /// Retorna um valor proporcional à altura da tela
  static double hp(double percentage) => screenHeight * percentage / 100;

  /// Retorna font size responsivo
  static double sp(double size) {
    final scaleFactor = screenWidth / 375; // Base iPhone width
    return size * scaleFactor.clamp(0.8, 1.3);
  }

  /// Padding responsivo
  static EdgeInsets get screenPadding => EdgeInsets.symmetric(
        horizontal: isTablet ? 24.0 : 16.0,
        vertical: 16.0,
      );

  /// Spacing responsivo
  static double get spacing => isTablet ? 20.0 : 16.0;
  static double get smallSpacing => isTablet ? 12.0 : 8.0;
  static double get largeSpacing => isTablet ? 32.0 : 24.0;
}

/// Extension para facilitar uso em widgets
extension ResponsiveContext on BuildContext {
  double get screenWidth => MediaQuery.of(this).size.width;
  double get screenHeight => MediaQuery.of(this).size.height;
  bool get isTablet => screenWidth >= 600;
  bool get isSmallScreen => screenWidth < 360;
  bool get isLandscape => MediaQuery.of(this).orientation == Orientation.landscape;
  
  /// Padding seguro considerando notch e navigation bar
  EdgeInsets get safePadding => MediaQuery.of(this).padding;
}
