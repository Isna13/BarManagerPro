import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'config/app_theme.dart';
import 'config/responsive.dart';
import 'providers/auth_provider.dart';
import 'providers/data_provider.dart';
import 'providers/sync_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Desabilitar logs em release
  if (kReleaseMode) {
    debugPrint = (String? message, {int? wrapWidth}) {};
  }

  // Initialize date formatting for pt_BR
  await initializeDateFormatting('pt_BR', null);

  // Set preferred orientations - permitir rotação em tablets
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Configurar tamanho máximo de imagem em cache
  PaintingBinding.instance.imageCache.maximumSizeBytes = 100 << 20; // 100 MB

  runApp(const BarManagerApp());
}

class BarManagerApp extends StatelessWidget {
  const BarManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => SyncProvider()),
        ChangeNotifierProxyProvider<AuthProvider, DataProvider>(
          create: (_) => DataProvider(),
          update: (_, auth, data) {
            if (auth.isAuthenticated) {
              data?.setApiService(auth.apiService);
            }
            return data ?? DataProvider();
          },
        ),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return MaterialApp(
            title: 'BarManager Pro',
            debugShowCheckedModeBanner: false,
            debugShowMaterialGrid: false,
            theme: AppTheme.lightTheme,
            locale: const Locale('pt', 'BR'),
            supportedLocales: const [
              Locale('pt', 'BR'),
              Locale('en', 'US'),
            ],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            builder: (context, child) {
              // Inicializar Responsive
              Responsive.init(context);

              // Limitar scale factor para melhor consistência
              final mediaQuery = MediaQuery.of(context);
              final constrainedTextScaleFactor = mediaQuery.textScaler.clamp(
                minScaleFactor: 0.8,
                maxScaleFactor: 1.2,
              );

              return MediaQuery(
                data: mediaQuery.copyWith(
                  textScaler: constrainedTextScaleFactor,
                ),
                child: child ?? const SizedBox.shrink(),
              );
            },
            home: auth.isLoading
                ? const SplashScreen()
                : auth.isAuthenticated
                    ? const HomeScreen()
                    : const LoginScreen(),
          );
        },
      ),
    );
  }
}
