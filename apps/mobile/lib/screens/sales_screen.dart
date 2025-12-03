import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../config/responsive.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  String _selectedFilter = 'today';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    final now = DateTime.now();
    DateTime startDate;
    DateTime endDate;

    // Debug: mostrar timezone do dispositivo
    debugPrint('🕐 DateTime.now(): $now');
    debugPrint('🕐 Timezone offset: ${now.timeZoneOffset}');
    debugPrint('🕐 Filtro selecionado: $_selectedFilter');

    switch (_selectedFilter) {
      case 'today':
        // Hoje: do início do dia local até o fim do dia local, convertido para UTC
        // Criar DateTime local (não UTC) primeiro, depois converter para UTC
        final localMidnight = DateTime(now.year, now.month, now.day, 0, 0, 0);
        final localEndOfDay =
            DateTime(now.year, now.month, now.day, 23, 59, 59, 999);
        startDate = localMidnight.toUtc();
        endDate = localEndOfDay.toUtc();
        debugPrint('📅 Hoje - Local: $localMidnight → UTC: $startDate');
        debugPrint('📅 Hoje - Local: $localEndOfDay → UTC: $endDate');
        break;
      case 'week':
        // Última semana: 7 dias atrás até fim de hoje
        final weekAgo = now.subtract(const Duration(days: 7));
        final localWeekStart =
            DateTime(weekAgo.year, weekAgo.month, weekAgo.day, 0, 0, 0);
        final localEndOfDay =
            DateTime(now.year, now.month, now.day, 23, 59, 59, 999);
        startDate = localWeekStart.toUtc();
        endDate = localEndOfDay.toUtc();
        debugPrint('📅 Semana - Local: $localWeekStart → UTC: $startDate');
        debugPrint('📅 Semana - Local: $localEndOfDay → UTC: $endDate');
        break;
      case 'month':
        // Este mês: do dia 1 até fim de hoje
        final localMonthStart = DateTime(now.year, now.month, 1, 0, 0, 0);
        final localEndOfDay =
            DateTime(now.year, now.month, now.day, 23, 59, 59, 999);
        startDate = localMonthStart.toUtc();
        endDate = localEndOfDay.toUtc();
        debugPrint('📅 Mês - Local: $localMonthStart → UTC: $startDate');
        debugPrint('📅 Mês - Local: $localEndOfDay → UTC: $endDate');
        break;
      default:
        final localMidnight = DateTime(now.year, now.month, now.day, 0, 0, 0);
        final localEndOfDay =
            DateTime(now.year, now.month, now.day, 23, 59, 59, 999);
        startDate = localMidnight.toUtc();
        endDate = localEndOfDay.toUtc();
    }

    debugPrint('🔍 Buscando vendas de $startDate até $endDate');
    await provider.loadSales(startDate: startDate, endDate: endDate);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        final sales = provider.sales;
        final totalSales = sales.fold(0.0, (sum, s) => sum + s.total);

        return Column(
          children: [
            // Summary Card
            Container(
              margin: const EdgeInsets.all(AppTheme.spacingMD),
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                boxShadow: AppTheme.elevatedShadow,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total em Vendas',
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Colors.white70,
                                  ),
                        ),
                        const SizedBox(height: AppTheme.spacingSM),
                        Text(
                          currencyFormat.format(totalSales),
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${sales.length}',
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(
                        'vendas',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.white70,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: Row(
                children: [
                  _FilterChip(
                    label: 'Hoje',
                    isSelected: _selectedFilter == 'today',
                    onTap: () => _onFilterChanged('today'),
                  ),
                  _FilterChip(
                    label: 'Semana',
                    isSelected: _selectedFilter == 'week',
                    onTap: () => _onFilterChanged('week'),
                  ),
                  _FilterChip(
                    label: 'Mês',
                    isSelected: _selectedFilter == 'month',
                    onTap: () => _onFilterChanged('month'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingMD),

            // Sales List
            Expanded(
              child: provider.isLoading
                  ? const LoadingIndicator()
                  : sales.isEmpty
                      ? const EmptyState(
                          icon: Icons.receipt_long,
                          title: 'Nenhuma venda encontrada',
                          subtitle: 'Não há vendas para o período selecionado',
                        )
                      : RefreshIndicator(
                          onRefresh: _loadData,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppTheme.spacingMD),
                            itemCount: sales.length,
                            itemBuilder: (context, index) {
                              final sale = sales[index];
                              return _SaleCard(
                                sale: sale,
                                currencyFormat: currencyFormat,
                                dateFormat: dateFormat,
                                onTap: () => _showSaleDetails(sale),
                              );
                            },
                          ),
                        ),
            ),
          ],
        );
      },
    );
  }

  void _onFilterChanged(String filter) {
    setState(() {
      _selectedFilter = filter;
    });
    _loadData();
  }

  void _showSaleDetails(Sale sale) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _SaleDetailsSheet(
        sale: sale,
        currencyFormat: currencyFormat,
        dateFormat: dateFormat,
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppTheme.spacingSM),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onTap(),
        selectedColor: AppTheme.primaryColor.withOpacity(0.2),
        checkmarkColor: AppTheme.primaryColor,
        labelStyle: TextStyle(
          color: isSelected ? AppTheme.primaryColor : AppTheme.textSecondary,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
    );
  }
}

class _SaleCard extends StatelessWidget {
  final Sale sale;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  const _SaleCard({
    required this.sale,
    required this.currencyFormat,
    required this.dateFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMD),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppTheme.spacingSM),
                    decoration: BoxDecoration(
                      color: _getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    ),
                    child: Icon(
                      _getPaymentIcon(),
                      size: 20,
                      color: _getStatusColor(),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingMD),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          sale.customerName ?? 'Cliente avulso',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: AppTheme.spacingXS),
                        Text(
                          dateFormat.format(sale.createdAt),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        currencyFormat.format(sale.total),
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.accentColor,
                                ),
                      ),
                      const SizedBox(height: AppTheme.spacingXS),
                      StatusBadge(
                        label: _getStatusLabel(),
                        type: _getStatusType(),
                      ),
                    ],
                  ),
                ],
              ),
              if (sale.items.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingMD),
                const Divider(height: 1),
                const SizedBox(height: AppTheme.spacingSM),
                Text(
                  '${sale.items.length} item(ns) • ${_getPaymentMethodLabel()}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor() {
    switch (sale.status.toLowerCase()) {
      case 'completed':
      case 'concluida':
        return AppTheme.accentColor;
      case 'pending':
      case 'pendente':
        return AppTheme.warningColor;
      case 'cancelled':
      case 'cancelada':
        return AppTheme.dangerColor;
      default:
        return AppTheme.textMuted;
    }
  }

  StatusType _getStatusType() {
    switch (sale.status.toLowerCase()) {
      case 'completed':
      case 'concluida':
        return StatusType.success;
      case 'pending':
      case 'pendente':
        return StatusType.warning;
      case 'cancelled':
      case 'cancelada':
        return StatusType.danger;
      default:
        return StatusType.neutral;
    }
  }

  String _getStatusLabel() {
    switch (sale.status.toLowerCase()) {
      case 'completed':
        return 'Concluída';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelada';
      default:
        return sale.status;
    }
  }

  IconData _getPaymentIcon() {
    switch (sale.paymentMethod.toLowerCase()) {
      case 'cash':
      case 'dinheiro':
        return Icons.payments;
      case 'card':
      case 'cartao':
        return Icons.credit_card;
      case 'transfer':
      case 'transferencia':
        return Icons.swap_horiz;
      case 'credit':
      case 'credito':
        return Icons.account_balance_wallet;
      default:
        return Icons.receipt;
    }
  }

  String _getPaymentMethodLabel() {
    switch (sale.paymentMethod.toLowerCase()) {
      case 'cash':
        return 'Dinheiro';
      case 'card':
        return 'Cartão';
      case 'transfer':
        return 'Transferência';
      case 'credit':
        return 'Crédito';
      default:
        return sale.paymentMethod;
    }
  }
}

class _SaleDetailsSheet extends StatelessWidget {
  final Sale sale;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;

  const _SaleDetailsSheet({
    required this.sale,
    required this.currencyFormat,
    required this.dateFormat,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.8,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusXLarge),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: AppTheme.spacingSM),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.borderColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Row(
              children: [
                Text(
                  'Detalhes da Venda',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Info
                  _InfoRow(
                      label: 'Cliente',
                      value: sale.customerName ?? 'Cliente avulso'),
                  _InfoRow(
                      label: 'Data', value: dateFormat.format(sale.createdAt)),
                  _InfoRow(label: 'Caixa', value: sale.cashierName ?? '-'),
                  _InfoRow(label: 'Pagamento', value: sale.paymentMethod),
                  _InfoRow(label: 'Status', value: sale.status),
                  const SizedBox(height: AppTheme.spacingMD),

                  // Items
                  if (sale.items.isNotEmpty) ...[
                    Text(
                      'Itens',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppTheme.spacingSM),
                    ...sale.items.map((item) => _ItemRow(
                          item: item,
                          currencyFormat: currencyFormat,
                        )),
                  ],

                  const SizedBox(height: AppTheme.spacingMD),
                  const Divider(),

                  // Totals
                  _TotalRow(
                      label: 'Subtotal',
                      value: currencyFormat.format(sale.subtotal)),
                  if (sale.discount > 0)
                    _TotalRow(
                      label: 'Desconto',
                      value: '- ${currencyFormat.format(sale.discount)}',
                      valueColor: AppTheme.dangerColor,
                    ),
                  _TotalRow(
                    label: 'Total',
                    value: currencyFormat.format(sale.total),
                    isBold: true,
                    valueColor: AppTheme.accentColor,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSM),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(value, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  final SaleItem item;
  final NumberFormat currencyFormat;

  const _ItemRow({required this.item, required this.currencyFormat});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSM),
      padding: const EdgeInsets.all(AppTheme.spacingSM),
      decoration: BoxDecoration(
        color: AppTheme.backgroundColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName ?? 'Produto',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  '${item.quantity}x ${currencyFormat.format(item.unitPrice)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Text(
            currencyFormat.format(item.subtotal),
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final Color? valueColor;

  const _TotalRow({
    required this.label,
    required this.value,
    this.isBold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSM),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
                ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
                  color: valueColor,
                ),
          ),
        ],
      ),
    );
  }
}
