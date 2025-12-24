import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/data_provider.dart';
import '../providers/sync_provider.dart';
import '../widgets/modern_nav_bar.dart';
import 'dashboard_screen.dart';
import 'sales_screen.dart';
import 'inventory_screen.dart';
import 'customers_screen.dart';
import 'products_screen.dart';
import 'suppliers_screen.dart';
import 'purchases_screen.dart';
import 'debts_screen.dart';
import 'cash_register_screen.dart';
import 'cash_history_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  StreamSubscription<bool>? _syncSubscription;

  final List<Widget> _mainScreens = [
    const DashboardScreen(),
    const SalesScreen(),
    const InventoryScreen(),
    const CustomersScreen(),
  ];

  final List<Widget> _moreScreens = [
    const ProductsScreen(),
    const SuppliersScreen(),
    const PurchasesScreen(),
    const DebtsScreen(),
    const CashRegisterScreen(),
    const CashHistoryScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _setupSyncListener();
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    super.dispose();
  }

  /// Escuta o stream do SyncProvider para atualizar todos os dados
  void _setupSyncListener() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final syncProvider = context.read<SyncProvider>();
      _syncSubscription = syncProvider.onSyncComplete.listen((success) async {
        if (success && mounted) {
          debugPrint('🔄 HomeScreen: Sync completou, atualizando DataProvider...');
          final dataProvider = context.read<DataProvider>();
          await dataProvider.refreshAll();
          debugPrint('✅ HomeScreen: Todos os dados atualizados após sync!');
        }
      });
    });
  }

  Future<void> _loadInitialData() async {
    final dataProvider = context.read<DataProvider>();
    await dataProvider.initialize();
    await dataProvider.refreshAll();
  }

  void _onNavTap(int index) {
    if (index == 4) {
      _showMoreOptions();
    } else {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  void _showMoreOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => ModernMoreOptionsSheet(
        selectedIndex: _currentIndex,
        onSelect: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
      ),
    );
  }

  Widget _getCurrentScreen() {
    if (_currentIndex < 4) {
      return _mainScreens[_currentIndex];
    } else {
      return _moreScreens[_currentIndex - 5];
    }
  }

  String _getTitle() {
    switch (_currentIndex) {
      case 0:
        return 'Dashboard';
      case 1:
        return 'Vendas';
      case 2:
        return 'Estoque';
      case 3:
        return 'Clientes';
      case 5:
        return 'Produtos';
      case 6:
        return 'Fornecedores';
      case 7:
        return 'Compras';
      case 8:
        return 'Dívidas';
      case 9:
        return 'Caixa Atual';
      case 10:
        return 'Histórico de Caixa';
      default:
        return 'BarManager';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        elevation: 0,
        scrolledUnderElevation: 1,
        title: Text(
          _getTitle(),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        actions: [
          Consumer<DataProvider>(
            builder: (context, provider, _) {
              return IconButton(
                tooltip: 'Atualizar',
                icon: provider.isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.primaryColor,
                        ),
                      )
                    : const Icon(Icons.refresh_rounded),
                onPressed:
                    provider.isLoading ? null : () => provider.refreshAll(),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            onSelected: (value) {
              if (value == 'logout') {
                _showLogoutDialog();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.dangerColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.logout_rounded,
                        color: AppTheme.dangerColor,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text('Sair da conta'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: _getCurrentScreen(),
      bottomNavigationBar: isLandscape
          ? null
          : ModernNavBar(
              currentIndex: _currentIndex < 5 ? _currentIndex : 4,
              onTap: _onNavTap,
            ),
      // Navigation rail para landscape em tablets
      drawer: isLandscape ? _buildNavigationDrawer() : null,
    );
  }

  Widget _buildNavigationDrawer() {
    return NavigationDrawer(
      selectedIndex: _currentIndex,
      onDestinationSelected: (index) {
        setState(() => _currentIndex = index);
        Navigator.pop(context);
      },
      children: const [
        Padding(
          padding: EdgeInsets.fromLTRB(28, 16, 16, 10),
          child: Text(
            'BarManager Pro',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        NavigationDrawerDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: Text('Dashboard'),
        ),
        NavigationDrawerDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: Text('Vendas'),
        ),
        NavigationDrawerDestination(
          icon: Icon(Icons.inventory_2_outlined),
          selectedIcon: Icon(Icons.inventory_2),
          label: Text('Estoque'),
        ),
        NavigationDrawerDestination(
          icon: Icon(Icons.people_outlined),
          selectedIcon: Icon(Icons.people),
          label: Text('Clientes'),
        ),
      ],
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.dangerColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.logout_rounded,
                color: AppTheme.dangerColor,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            const Text('Sair'),
          ],
        ),
        content: const Text('Tem certeza que deseja sair da sua conta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.dangerColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () {
              Navigator.pop(context);
              context.read<AuthProvider>().logout();
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
            child: const Text('Sair'),
          ),
        ],
      ),
    );
  }
}
