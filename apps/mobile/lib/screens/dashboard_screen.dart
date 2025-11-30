import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../widgets/common_widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final numberFormat = NumberFormat('#,##0', 'pt_AO');

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    await provider.loadDashboardStats();
    await provider.loadSales(limit: 5);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.dashboardStats == null) {
          return const LoadingIndicator(message: 'Carregando dashboard...');
        }

        if (provider.error != null && provider.dashboardStats == null) {
          return ErrorState(
            message: provider.error!,
            onRetry: _loadData,
          );
        }

        final stats = provider.dashboardStats;

        return RefreshIndicator(
          onRefresh: _loadData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Greeting
                _buildGreeting(),
                const SizedBox(height: AppTheme.spacingLG),

                // Stats Cards
                _buildStatsGrid(stats),
                const SizedBox(height: AppTheme.spacingLG),

                // Quick Stats
                _buildQuickStats(stats, provider),
                const SizedBox(height: AppTheme.spacingLG),

                // Recent Sales
                _buildRecentSales(provider),
                const SizedBox(height: AppTheme.spacingLG),

                // Top Products
                _buildTopProducts(stats),
                const SizedBox(height: AppTheme.spacingMD),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildGreeting() {
    final hour = DateTime.now().hour;
    String greeting;
    IconData icon;

    if (hour < 12) {
      greeting = 'Bom dia';
      icon = Icons.wb_sunny;
    } else if (hour < 18) {
      greeting = 'Boa tarde';
      icon = Icons.wb_cloudy;
    } else {
      greeting = 'Boa noite';
      icon = Icons.nightlight_round;
    }

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(AppTheme.spacingSM),
          decoration: BoxDecoration(
            gradient: AppTheme.primaryGradient,
            borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
          ),
          child: Icon(icon, color: Colors.white, size: 24),
        ),
        const SizedBox(width: AppTheme.spacingMD),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              greeting,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Text(
              DateFormat('EEEE, d MMMM', 'pt_BR').format(DateTime.now()),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatsGrid(stats) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: AppTheme.spacingMD,
      mainAxisSpacing: AppTheme.spacingMD,
      childAspectRatio: 1.4,
      children: [
        StatCard(
          title: 'Vendas Hoje',
          value: currencyFormat.format(stats?.todaySales ?? 0),
          icon: Icons.trending_up,
          gradient: AppTheme.successGradient,
          subtitle: '${stats?.todayTransactions ?? 0} transações',
        ),
        StatCard(
          title: 'Vendas Semana',
          value: currencyFormat.format(stats?.weekSales ?? 0),
          icon: Icons.calendar_today,
          gradient: AppTheme.primaryGradient,
        ),
        StatCard(
          title: 'Vendas Mês',
          value: currencyFormat.format(stats?.monthSales ?? 0),
          icon: Icons.date_range,
          gradient: const LinearGradient(
            colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
          ),
        ),
        StatCard(
          title: 'Dívidas Pendentes',
          value: currencyFormat.format(stats?.pendingDebts ?? 0),
          icon: Icons.receipt_long,
          gradient: AppTheme.warningGradient,
        ),
      ],
    );
  }

  Widget _buildQuickStats(stats, DataProvider provider) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        children: [
          Expanded(
            child: _QuickStatItem(
              icon: Icons.warning_amber,
              iconColor: AppTheme.dangerColor,
              label: 'Estoque Baixo',
              value: numberFormat.format(
                  stats?.lowStockCount ?? provider.lowStockItems.length),
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: AppTheme.dividerColor,
          ),
          Expanded(
            child: _QuickStatItem(
              icon: Icons.people,
              iconColor: AppTheme.infoColor,
              label: 'Clientes Ativos',
              value: numberFormat
                  .format(stats?.activeCustomers ?? provider.customers.length),
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: AppTheme.dividerColor,
          ),
          Expanded(
            child: _QuickStatItem(
              icon: Icons.inventory,
              iconColor: AppTheme.accentColor,
              label: 'Produtos',
              value: numberFormat.format(provider.products.length),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentSales(DataProvider provider) {
    final recentSales = provider.sales.take(5).toList();

    return InfoCard(
      title: 'Vendas Recentes',
      icon: Icons.receipt,
      child: recentSales.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(AppTheme.spacingLG),
              child: Center(
                child: Text(
                  'Nenhuma venda recente',
                  style: TextStyle(color: AppTheme.textMuted),
                ),
              ),
            )
          : Column(
              children: recentSales.map((sale) {
                return ListTileCard(
                  title: sale.customerName ?? 'Cliente avulso',
                  subtitle:
                      DateFormat('dd/MM/yyyy HH:mm').format(sale.createdAt),
                  trailing: currencyFormat.format(sale.total),
                  leadingIcon: Icons.shopping_cart,
                  leadingColor: _getPaymentMethodColor(sale.paymentMethod),
                  showDivider: sale != recentSales.last,
                );
              }).toList(),
            ),
    );
  }

  Widget _buildTopProducts(stats) {
    final topProducts = stats?.topProducts ?? [];

    return InfoCard(
      title: 'Produtos Mais Vendidos',
      icon: Icons.star,
      child: topProducts.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(AppTheme.spacingLG),
              child: Center(
                child: Text(
                  'Nenhum dado disponível',
                  style: TextStyle(color: AppTheme.textMuted),
                ),
              ),
            )
          : Column(
              children:
                  topProducts.take(5).toList().asMap().entries.map((entry) {
                final index = entry.key;
                final product = entry.value;
                return ListTileCard(
                  title: product.productName,
                  subtitle:
                      '${numberFormat.format(product.quantitySold)} unidades vendidas',
                  trailing: currencyFormat.format(product.totalRevenue),
                  leadingIcon: _getRankIcon(index),
                  leadingColor: _getRankColor(index),
                  showDivider: index < topProducts.length - 1,
                );
              }).toList(),
            ),
    );
  }

  Color _getPaymentMethodColor(String method) {
    switch (method.toLowerCase()) {
      case 'cash':
      case 'dinheiro':
        return AppTheme.accentColor;
      case 'card':
      case 'cartao':
      case 'cartão':
        return AppTheme.infoColor;
      case 'transfer':
      case 'transferencia':
      case 'transferência':
        return AppTheme.primaryColor;
      case 'credit':
      case 'credito':
      case 'crédito':
        return AppTheme.warningColor;
      default:
        return AppTheme.textMuted;
    }
  }

  IconData _getRankIcon(int index) {
    switch (index) {
      case 0:
        return Icons.emoji_events;
      case 1:
        return Icons.looks_one;
      case 2:
        return Icons.looks_two;
      default:
        return Icons.tag;
    }
  }

  Color _getRankColor(int index) {
    switch (index) {
      case 0:
        return const Color(0xFFFFD700);
      case 1:
        return const Color(0xFFC0C0C0);
      case 2:
        return const Color(0xFFCD7F32);
      default:
        return AppTheme.textMuted;
    }
  }
}

class _QuickStatItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _QuickStatItem({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, color: iconColor, size: 24),
        const SizedBox(height: AppTheme.spacingSM),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
