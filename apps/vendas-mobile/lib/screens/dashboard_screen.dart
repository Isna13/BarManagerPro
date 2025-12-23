import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/app_theme.dart';
import '../utils/currency_helper.dart';
import '../utils/responsive_helper.dart';
import '../widgets/modern_widgets.dart';
import '../providers/cash_box_provider.dart';
import '../providers/products_provider.dart';
import '../services/sync_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _hasLoadedInitialData = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Garantir que Dashboard sempre tenha dados atualizados do caixa
    if (!_hasLoadedInitialData) {
      _hasLoadedInitialData = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          debugPrint('📊 DashboardScreen: Carregando dados do caixa...');
          context.read<CashBoxProvider>().loadCurrentCashBox();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPadding;

    return RefreshIndicator(
      onRefresh: () async {
        await SyncService.instance.syncAll();
        if (mounted) {
          await context.read<CashBoxProvider>().loadCurrentCashBox();
        }
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(padding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCashBoxCard(),
            SizedBox(height: context.responsiveSpacing()),
            _buildMetricsGrid(),
            SizedBox(height: context.responsiveSpacing(base: 20)),
            _buildConnectionCard(),
            SizedBox(height: context.responsiveSpacing(base: 20)),
            _buildLowStockSection(),
            SizedBox(height: context.responsiveSpacing(base: 20)),
          ],
        ),
      ),
    );
  }

  Widget _buildCashBoxCard() {
    return Consumer<CashBoxProvider>(
      builder: (context, cashBox, _) {
        final current = cashBox.currentCashBox;
        final hasOpenCashBox = cashBox.hasOpenCashBox;
        // Ler de stats se existir, ou diretamente do objeto
        final stats = current?['stats'] as Map<String, dynamic>? ?? {};
        final totalSales = current?['total_sales'] ??
            current?['totalSales'] ??
            stats['totalSales'] ??
            0;

        return StatusCard(
          icon: hasOpenCashBox ? Icons.lock_open_rounded : Icons.lock_rounded,
          color: hasOpenCashBox ? AppTheme.successColor : AppTheme.warningColor,
          title: hasOpenCashBox ? 'Caixa Aberto' : 'Caixa Fechado',
          subtitle: hasOpenCashBox
              ? 'Caixa: ${current?['box_number'] ?? current?['boxNumber'] ?? '-'}'
              : 'Abra o caixa para iniciar vendas',
          trailing: hasOpenCashBox && current != null
              ? Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.successColor,
                    borderRadius: AppTheme.borderRadiusSmall,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Total',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.9),
                          fontSize: context.responsiveFontSize(11),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        CurrencyHelper.format(totalSales),
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: context.responsiveFontSize(14),
                        ),
                      ),
                    ],
                  ),
                )
              : null,
        );
      },
    );
  }

  Widget _buildMetricsGrid() {
    return Consumer<CashBoxProvider>(
      builder: (context, cashBox, _) {
        final current = cashBox.currentCashBox;
        // Ler de stats se existir, ou diretamente do objeto
        final stats = current?['stats'] as Map<String, dynamic>? ?? {};
        final openingCash =
            current?['opening_cash'] ?? current?['openingCash'] ?? 0;
        final totalCash = current?['total_cash'] ??
            current?['totalCash'] ??
            stats['cashPayments'] ??
            0;
        final totalCard = current?['total_card'] ??
            current?['totalCard'] ??
            stats['cardPayments'] ??
            0;
        final totalMobileMoney = current?['total_mobile_money'] ??
            current?['totalMobileMoney'] ??
            stats['mobileMoneyPayments'] ??
            0;

        return LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth < 360 ? 2 : 2;
            final spacing = context.responsiveSpacing(base: 12);
            final itemWidth =
                (constraints.maxWidth - spacing * (columns - 1)) / columns;

            return Wrap(
              spacing: spacing,
              runSpacing: spacing,
              children: [
                SizedBox(
                  width: itemWidth,
                  child: MetricCard(
                    title: 'Abertura',
                    value: CurrencyHelper.format(openingCash),
                    icon: Icons.account_balance_wallet_rounded,
                    color: AppTheme.infoColor,
                  ),
                ),
                SizedBox(
                  width: itemWidth,
                  child: MetricCard(
                    title: 'Dinheiro',
                    value: CurrencyHelper.format(totalCash),
                    icon: Icons.payments_rounded,
                    color: AppTheme.successColor,
                  ),
                ),
                SizedBox(
                  width: itemWidth,
                  child: MetricCard(
                    title: 'Cartão',
                    value: CurrencyHelper.format(totalCard),
                    icon: Icons.credit_card_rounded,
                    color: Colors.purple,
                  ),
                ),
                SizedBox(
                  width: itemWidth,
                  child: MetricCard(
                    title: 'Mobile Money',
                    value: CurrencyHelper.format(totalMobileMoney),
                    icon: Icons.phone_android_rounded,
                    color: Colors.orange,
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildConnectionCard() {
    return StreamBuilder<SyncStatus>(
      stream: SyncService.instance.syncStatusStream,
      builder: (context, snapshot) {
        final isOnline = SyncService.instance.isOnline;
        final status = snapshot.data;
        final isSyncing = status?.isSyncing == true;

        String statusMessage = status?.message ??
            (isOnline ? 'Dados sincronizados' : 'Trabalhando offline');
        if (statusMessage.length > 40) {
          statusMessage = '${statusMessage.substring(0, 37)}...';
        }

        return ModernCard(
          padding: EdgeInsets.all(context.responsiveSpacing(base: 14)),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isOnline ? AppTheme.successLight : AppTheme.errorLight,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                  color: isOnline ? AppTheme.successColor : AppTheme.errorColor,
                  size: 22,
                ),
              ),
              SizedBox(width: context.responsiveSpacing(base: 12)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isOnline ? 'Conectado' : 'Offline',
                      style: TextStyle(
                        fontSize: context.responsiveFontSize(15),
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      statusMessage,
                      style: TextStyle(
                        fontSize: context.responsiveFontSize(12),
                        color: AppTheme.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              isSyncing
                  ? const SizedBox(
                      width: 32,
                      height: 32,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : TextButton.icon(
                      onPressed: () => SyncService.instance.syncAll(),
                      icon: Icon(
                        Icons.sync_rounded,
                        size: context.responsiveIconSize(base: 18),
                      ),
                      label: Text(
                        'Sync',
                        style: TextStyle(
                          fontSize: context.responsiveFontSize(13),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLowStockSection() {
    return Consumer<ProductsProvider>(
      builder: (context, products, _) {
        final lowStockItems = <Map<String, dynamic>>[];

        for (final product in products.products) {
          final productId = product['id'];
          final stock = products.getProductStock(productId);
          final lowAlert = product['low_stock_alert'] ?? 10;

          if (stock <= lowAlert) {
            lowStockItems.add({
              ...product,
              'currentStock': stock,
            });
          }
        }

        if (lowStockItems.isEmpty) {
          return const SizedBox.shrink();
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              icon: Icons.warning_amber_rounded,
              title: 'Estoque Baixo (${lowStockItems.length})',
              color: AppTheme.warningColor,
            ),
            ModernCard(
              padding: EdgeInsets.zero,
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: lowStockItems.take(5).length,
                separatorBuilder: (_, __) => Divider(
                  height: 1,
                  color: Colors.grey.shade100,
                ),
                itemBuilder: (context, index) {
                  final item = lowStockItems[index];
                  final stock = item['currentStock'] as int;

                  return ListTile(
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: context.responsiveSpacing(base: 14),
                      vertical: 4,
                    ),
                    leading: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: stock == 0
                            ? AppTheme.errorLight
                            : AppTheme.warningLight,
                        borderRadius: AppTheme.borderRadiusSmall,
                      ),
                      child: Center(
                        child: Text(
                          '$stock',
                          style: TextStyle(
                            color: stock == 0
                                ? AppTheme.errorColor
                                : AppTheme.warningColor,
                            fontWeight: FontWeight.bold,
                            fontSize: context.responsiveFontSize(14),
                          ),
                        ),
                      ),
                    ),
                    title: Text(
                      item['name'] ?? 'Produto',
                      style: TextStyle(
                        fontSize: context.responsiveFontSize(14),
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      'SKU: ${item['sku'] ?? '-'}',
                      style: TextStyle(
                        fontSize: context.responsiveFontSize(12),
                        color: AppTheme.textSecondary,
                      ),
                    ),
                    trailing: ModernBadge(
                      text: stock == 0 ? 'Esgotado' : 'Baixo',
                      color: stock == 0
                          ? AppTheme.errorLight
                          : AppTheme.warningLight,
                      textColor: stock == 0
                          ? AppTheme.errorColor
                          : AppTheme.warningColor,
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
