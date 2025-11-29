import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/sync_provider.dart';
import '../services/api_service.dart';
import 'package:intl/intl.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _currencyFormat = NumberFormat.currency(
    symbol: 'XOF ',
    decimalDigits: 0,
  );

  Map<String, dynamic> _stats = {};
  bool _isLoadingStats = true;

  @override
  void initState() {
    super.initState();
    _loadDashboardStats();
  }

  Future<void> _loadDashboardStats() async {
    try {
      final apiService = ApiService();
      await apiService.loadToken();

      final data = await apiService.getDashboardStats();

      if (mounted) {
        setState(() {
          _stats = data;
          _isLoadingStats = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingStats = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao carregar dados: ${e.toString()}'),
            backgroundColor: Colors.red,
            action: SnackBarAction(
              label: 'Tentar novamente',
              textColor: Colors.white,
              onPressed: () {
                setState(() => _isLoadingStats = true);
                _loadDashboardStats();
              },
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final syncProvider = Provider.of<SyncProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        backgroundColor: Colors.blue.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: syncProvider.isSyncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Icon(
                    syncProvider.pendingItems > 0
                        ? Icons.cloud_upload
                        : Icons.cloud_done,
                  ),
            onPressed:
                syncProvider.isSyncing ? null : () => syncProvider.startSync(),
            tooltip: syncProvider.pendingItems > 0
                ? '${syncProvider.pendingItems} itens pendentes'
                : 'Sincronizado',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await authProvider.logout();
              if (!context.mounted) return;
              Navigator.pushReplacementNamed(context, '/login');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Stats Cards
            _isLoadingStats
                ? const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : Container(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        // Primary Stats - Vendas e Lucro de Hoje
                        Row(
                          children: [
                            Expanded(
                              child: _buildStatCard(
                                'Vendas Hoje',
                                _currencyFormat
                                    .format(_stats['todaySales'] ?? 0),
                                Icons.attach_money,
                                Colors.green,
                                subtitle:
                                    'Lucro: ${_currencyFormat.format(_stats['todayProfit'] ?? 0)}',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildStatCard(
                                'Margem Hoje',
                                '${(_stats['todayMargin'] ?? 0).toStringAsFixed(1)}%',
                                Icons.trending_up,
                                Colors.blue,
                                subtitle:
                                    'Semanal: ${_currencyFormat.format(_stats['weekRevenue'] ?? 0)}',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Secondary Stats
                        Row(
                          children: [
                            Expanded(
                              child: _buildStatCard(
                                'Dívidas Pendentes',
                                _currencyFormat
                                    .format(_stats['pendingDebts'] ?? 0),
                                Icons.money_off,
                                Colors.orange,
                                subtitle:
                                    '${_stats['overdueDebts'] ?? 0} vencidas',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildStatCard(
                                'Estoque Baixo',
                                '${_stats['lowStockCount'] ?? 0}',
                                Icons.warning,
                                Colors.red,
                                subtitle: 'Requer atenção',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        // Tertiary Stats
                        Row(
                          children: [
                            Expanded(
                              child: _buildStatCard(
                                'Produtos',
                                '${_stats['productsCount'] ?? 0}',
                                Icons.inventory_2,
                                Colors.purple,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildStatCard(
                                'Clientes',
                                '${_stats['customersCount'] ?? 0}',
                                Icons.people,
                                Colors.teal,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
            // Menu Grid
            Padding(
              padding: const EdgeInsets.all(16),
              child: GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  _buildMenuCard(
                    context,
                    'PDV',
                    Icons.point_of_sale,
                    '/pos',
                    Colors.blue,
                  ),
                  _buildMenuCard(
                    context,
                    'Vendas',
                    Icons.shopping_cart,
                    '/sales',
                    Colors.green,
                  ),
                  _buildMenuCard(
                    context,
                    'Inventário',
                    Icons.inventory,
                    '/inventory',
                    Colors.orange,
                  ),
                  _buildMenuCard(
                    context,
                    'Relatórios',
                    Icons.bar_chart,
                    '/reports',
                    Colors.indigo,
                  ),
                  _buildMenuCard(
                    context,
                    'Dívidas',
                    Icons.money_off,
                    '/debts',
                    Colors.red,
                  ),
                  _buildMenuCard(
                    context,
                    'Scanner QR',
                    Icons.qr_code_scanner,
                    '/qr-scanner',
                    Colors.purple,
                  ),
                ],
              ),
            ),
            // Sync Status
            if (syncProvider.lastSync != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Card(
                  child: ListTile(
                    leading: Icon(Icons.sync, color: Colors.green.shade700),
                    title: const Text('Última Sincronização'),
                    subtitle: Text(_formatLastSync(syncProvider.lastSync!)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(
    String title,
    String value,
    IconData icon,
    Color color, {
    String? subtitle,
  }) {
    return Card(
      elevation: 3,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.grey.shade700,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 20, color: color),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: color,
                letterSpacing: -0.5,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w400,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMenuCard(
    BuildContext context,
    String title,
    IconData icon,
    String route,
    Color color,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, route),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 32, color: color),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade800,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatLastSync(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return 'Agora mesmo';
    } else if (difference.inMinutes < 60) {
      return 'Há ${difference.inMinutes} minutos';
    } else if (difference.inHours < 24) {
      return 'Há ${difference.inHours} horas';
    } else {
      return DateFormat('dd/MM/yyyy HH:mm').format(dateTime);
    }
  }
}
