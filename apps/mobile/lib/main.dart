import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'config/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/data_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize date formatting for pt_BR
  await initializeDateFormatting('pt_BR', null);

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const BarManagerApp());
}

class BarManagerApp extends StatelessWidget {
  const BarManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
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
            theme: AppTheme.lightTheme,
            home:
                auth.isAuthenticated ? const HomeScreen() : const LoginScreen(),
          );
        },
      ),
    );
  }
}
