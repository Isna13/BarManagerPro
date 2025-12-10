import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/cash_box_provider.dart';
import '../providers/products_provider.dart';
import '../providers/tables_provider.dart';
import '../services/sync_service.dart';
import 'dashboard_screen.dart';
import 'cash_box_screen.dart';
import 'cash_box_history_screen.dart';
import 'pos_screen.dart';
import 'tables_screen.dart';
import 'inventory_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const DashboardScreen(),
    const CashBoxScreen(),
    const CashBoxHistoryScreen(),
    const POSScreen(),
    const TablesScreen(),
    const InventoryScreen(),
  ];

  final List<String> _titles = [
    'Dashboard',
    'Caixa',
    'Histórico de Caixa',
    'PDV',
    'Mesas',
    'Estoque',
  ];

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final auth = context.read<AuthProvider>();
    final branchId = auth.branchId;

    // Carregar dados em paralelo
    await Future.wait([
      context.read<CashBoxProvider>().loadCurrentCashBox(),
      context.read<ProductsProvider>().loadCategories(),
      context.read<ProductsProvider>().loadProducts(),
      context.read<ProductsProvider>().loadInventory(branchId: branchId),
      if (branchId != null)
        context.read<TablesProvider>().loadTables(branchId: branchId),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final isWideScreen = MediaQuery.of(context).size.width > 800;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_currentIndex]),
        actions: [
          // Indicador de sincronização
          StreamBuilder<SyncStatus>(
            stream: SyncService.instance.syncStatusStream,
            builder: (context, snapshot) {
              final status = snapshot.data;
              if (status?.isSyncing == true) {
                return const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  ),
                );
              }
              return IconButton(
                icon: Icon(
                  SyncService.instance.isOnline
                      ? Icons.cloud_done
                      : Icons.cloud_off,
                ),
                onPressed: () => SyncService.instance.syncAll(),
                tooltip: SyncService.instance.isOnline ? 'Online' : 'Offline',
              );
            },
          ),
          // Menu do usuário
          PopupMenuButton<String>(
            icon: const Icon(Icons.account_circle),
            onSelected: (value) async {
              if (value == 'logout') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Sair'),
                    content: const Text('Deseja realmente sair?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancelar'),
                      ),
                      ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Sair'),
                      ),
                    ],
                  ),
                );

                if (confirm == true) {
                  await context.read<AuthProvider>().logout();
                }
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'user',
                enabled: false,
                child: Consumer<AuthProvider>(
                  builder: (context, auth, _) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        auth.userName ?? 'Usuário',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        auth.userRole ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Sair', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Row(
        children: [
          // Navigation Rail para telas largas
          if (isWideScreen)
            NavigationRail(
              selectedIndex: _currentIndex,
              onDestinationSelected: (index) {
                setState(() => _currentIndex = index);
              },
              labelType: NavigationRailLabelType.all,
              destinations: const [
                NavigationRailDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  selectedIcon: Icon(Icons.dashboard),
                  label: Text('Dashboard'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.point_of_sale_outlined),
                  selectedIcon: Icon(Icons.point_of_sale),
                  label: Text('Caixa'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.history_outlined),
                  selectedIcon: Icon(Icons.history),
                  label: Text('Histórico'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.shopping_cart_outlined),
                  selectedIcon: Icon(Icons.shopping_cart),
                  label: Text('PDV'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.table_restaurant_outlined),
                  selectedIcon: Icon(Icons.table_restaurant),
                  label: Text('Mesas'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.inventory_2_outlined),
                  selectedIcon: Icon(Icons.inventory_2),
                  label: Text('Estoque'),
                ),
              ],
            ),

          // Conteúdo principal
          Expanded(child: _screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: isWideScreen
          ? null
          : BottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: (index) {
                setState(() => _currentIndex = index);
              },
              type: BottomNavigationBarType.fixed,
              items: const [
                BottomNavigationBarItem(
                  icon: Icon(Icons.dashboard_outlined),
                  activeIcon: Icon(Icons.dashboard),
                  label: 'Dashboard',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.point_of_sale_outlined),
                  activeIcon: Icon(Icons.point_of_sale),
                  label: 'Caixa',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.history_outlined),
                  activeIcon: Icon(Icons.history),
                  label: 'Histórico',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.shopping_cart_outlined),
                  activeIcon: Icon(Icons.shopping_cart),
                  label: 'PDV',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.table_restaurant_outlined),
                  activeIcon: Icon(Icons.table_restaurant),
                  label: 'Mesas',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.inventory_2_outlined),
                  activeIcon: Icon(Icons.inventory_2),
                  label: 'Estoque',
                ),
              ],
            ),
    );
  }
}
