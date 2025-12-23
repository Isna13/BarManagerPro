import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/cash_box_provider.dart';
import '../providers/products_provider.dart';
import '../providers/tables_provider.dart';
import '../providers/sync_provider.dart' as sync_prov;
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
  StreamSubscription<SyncStatus>? _syncSubscription;
  StreamSubscription<bool>? _syncProviderSubscription;

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
    _setupSyncListener();
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    _syncProviderSubscription?.cancel();
    super.dispose();
  }

  /// Escuta eventos de sincronização para recarregar dados após sync
  void _setupSyncListener() {
    // Escutar SyncService principal - SEMPRE recarregar CashBox após sync bem-sucedido
    _syncSubscription = SyncService.instance.syncStatusStream.listen((status) {
      if (!mounted) return;
      
      // Após qualquer sync bem-sucedido, recarregar CashBox e Dashboard
      if (status.success == true && !status.isSyncing) {
        debugPrint('🔄 HomeScreen: SyncService completou, atualizando CashBox...');
        context.read<CashBoxProvider>().loadCurrentCashBox();
      }
      
      // Se requer reload completo (ex: reset remoto)
      if (status.requiresReload) {
        debugPrint('🔄 HomeScreen: Recebido sinal de reload, recarregando providers...');
        _loadInitialData().then((_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(status.message),
                backgroundColor:
                    status.success == true ? Colors.green : Colors.orange,
              ),
            );
          }
        });
      }
    });

    // Escutar sync periódico do SyncProvider para atualizar CashBox
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final syncProvider = context.read<sync_prov.SyncProvider>();
      _syncProviderSubscription = syncProvider.onSyncComplete.listen((success) {
        if (success && mounted) {
          debugPrint(
              '🔄 HomeScreen: SyncProvider completou, atualizando CashBox...');
          context.read<CashBoxProvider>().loadCurrentCashBox();
        }
      });
    });
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

  Future<void> _showResetSyncDialog() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.orange),
            SizedBox(width: 8),
            Text('Sincronizar do Servidor'),
          ],
        ),
        content: const Text(
          'Esta ação irá:\n\n'
          '• Apagar todos os dados locais\n'
          '• Baixar dados atualizados do servidor Railway\n\n'
          'Dados não sincronizados serão perdidos.\n\n'
          'Deseja continuar?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sincronizar'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      // Mostrar loading
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => const AlertDialog(
          content: Row(
            children: [
              CircularProgressIndicator(),
              SizedBox(width: 16),
              Text('Sincronizando dados do servidor...'),
            ],
          ),
        ),
      );

      // Executar reset e sync
      final success = await SyncService.instance.resetAndSyncFromServer();

      if (!mounted) return;
      Navigator.pop(context); // Fechar loading

      if (success) {
        // Recarregar dados nos providers
        await _loadInitialData();

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Dados sincronizados com sucesso!'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('❌ Erro ao sincronizar. Verifique a conexão.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
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
              } else if (value == 'reset_sync') {
                await _showResetSyncDialog();
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
                value: 'reset_sync',
                child: Row(
                  children: [
                    Icon(Icons.sync, color: Colors.blue),
                    SizedBox(width: 8),
                    Text('Sincronizar do Servidor'),
                  ],
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
