import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/data_provider.dart';
import '../widgets/bottom_nav_bar.dart';
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

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

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
      builder: (context) => MoreOptionsSheet(
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
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: Text(_getTitle()),
        actions: [
          Consumer<DataProvider>(
            builder: (context, provider, _) {
              return IconButton(
                icon: provider.isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppTheme.primaryColor,
                        ),
                      )
                    : const Icon(Icons.refresh),
                onPressed:
                    provider.isLoading ? null : () => provider.refreshAll(),
              );
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'logout') {
                _showLogoutDialog();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: AppTheme.dangerColor),
                    SizedBox(width: AppTheme.spacingSM),
                    Text('Sair'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: _getCurrentScreen(),
      bottomNavigationBar: BottomNavBar(
        currentIndex: _currentIndex < 5 ? _currentIndex : 4,
        onTap: _onNavTap,
      ),
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sair'),
        content: const Text('Tem certeza que deseja sair?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.dangerColor,
            ),
            onPressed: () {
              Navigator.pop(context);
              context.read<AuthProvider>().logout();
              Navigator.of(context).pushReplacementNamed('/login');
            },
            child: const Text('Sair'),
          ),
        ],
      ),
    );
  }
}
