import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final dateFormat = DateFormat('dd/MM/yyyy');
  String _selectedFilter = 'all';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    String? status;

    if (_selectedFilter != 'all') {
      status = _selectedFilter;
    }

    await provider.loadPurchases(status: status);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        final purchases = provider.purchases;
        final totalPurchases = purchases.fold(0.0, (sum, p) => sum + p.total);

        return Column(
          children: [
            // Summary Card
            Container(
              margin: const EdgeInsets.all(AppTheme.spacingMD),
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
                ),
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
                          'Total em Compras',
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Colors.white70,
                                  ),
                        ),
                        const SizedBox(height: AppTheme.spacingSM),
                        Text(
                          currencyFormat.format(totalPurchases),
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
                        '${purchases.length}',
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(
                        'pedidos',
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
                    label: 'Todos',
                    isSelected: _selectedFilter == 'all',
                    onTap: () => _onFilterChanged('all'),
                  ),
                  _FilterChip(
                    label: 'Pendentes',
                    isSelected: _selectedFilter == 'pending',
                    onTap: () => _onFilterChanged('pending'),
                  ),
                  _FilterChip(
                    label: 'Recebidos',
                    isSelected: _selectedFilter == 'received',
                    onTap: () => _onFilterChanged('received'),
                  ),
                  _FilterChip(
                    label: 'Cancelados',
                    isSelected: _selectedFilter == 'cancelled',
                    onTap: () => _onFilterChanged('cancelled'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingMD),

            // Purchases List
            Expanded(
              child: provider.isLoading
                  ? const LoadingIndicator()
                  : purchases.isEmpty
                      ? const EmptyState(
                          icon: Icons.shopping_cart,
                          title: 'Nenhuma compra encontrada',
                        )
                      : RefreshIndicator(
                          onRefresh: _loadData,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppTheme.spacingMD),
                            itemCount: purchases.length,
                            itemBuilder: (context, index) {
                              final purchase = purchases[index];
                              return _PurchaseCard(
                                purchase: purchase,
                                currencyFormat: currencyFormat,
                                dateFormat: dateFormat,
                                onTap: () => _showPurchaseDetails(purchase),
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

  void _showPurchaseDetails(Purchase purchase) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _PurchaseDetailsSheet(
        purchase: purchase,
        currencyFormat: currencyFormat,
        dateFormat: dateFormat,
      ),
    );
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
      ),
    );
  }
}

class _PurchaseCard extends StatelessWidget {
  final Purchase purchase;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  const _PurchaseCard({
    required this.purchase,
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
                      Icons.local_shipping,
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
                          purchase.supplierName ?? 'Fornecedor',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: AppTheme.spacingXS),
                        Text(
                          dateFormat.format(purchase.purchaseDate),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        currencyFormat.format(purchase.total),
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
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
              if (purchase.invoiceNumber != null) ...[
                const SizedBox(height: AppTheme.spacingSM),
                Text(
                  'Fatura: ${purchase.invoiceNumber}',
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
    switch (purchase.status.toLowerCase()) {
      case 'received':
      case 'recebido':
        return AppTheme.accentColor;
      case 'pending':
      case 'pendente':
        return AppTheme.warningColor;
      case 'cancelled':
      case 'cancelado':
        return AppTheme.dangerColor;
      default:
        return AppTheme.textMuted;
    }
  }

  StatusType _getStatusType() {
    switch (purchase.status.toLowerCase()) {
      case 'received':
      case 'recebido':
        return StatusType.success;
      case 'pending':
      case 'pendente':
        return StatusType.warning;
      case 'cancelled':
      case 'cancelado':
        return StatusType.danger;
      default:
        return StatusType.neutral;
    }
  }

  String _getStatusLabel() {
    switch (purchase.status.toLowerCase()) {
      case 'received':
        return 'Recebido';
      case 'pending':
        return 'Pendente';
      case 'cancelled':
        return 'Cancelado';
      default:
        return purchase.status;
    }
  }
}

class _PurchaseDetailsSheet extends StatelessWidget {
  final Purchase purchase;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;

  const _PurchaseDetailsSheet({
    required this.purchase,
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
                  'Detalhes da Compra',
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
                  _InfoRow(
                      label: 'Fornecedor', value: purchase.supplierName ?? '-'),
                  _InfoRow(
                      label: 'Data',
                      value: dateFormat.format(purchase.purchaseDate)),
                  _InfoRow(
                      label: 'Fatura', value: purchase.invoiceNumber ?? '-'),
                  _InfoRow(label: 'Status', value: purchase.status),
                  if (purchase.receivedAt != null)
                    _InfoRow(
                        label: 'Recebido em',
                        value: dateFormat.format(purchase.receivedAt!)),
                  const SizedBox(height: AppTheme.spacingMD),
                  if (purchase.items.isNotEmpty) ...[
                    Text('Itens',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppTheme.spacingSM),
                    ...purchase.items.map((item) => _ItemRow(
                          item: item,
                          currencyFormat: currencyFormat,
                        )),
                  ],
                  const SizedBox(height: AppTheme.spacingMD),
                  const Divider(),
                  _TotalRow(
                      label: 'Subtotal',
                      value: currencyFormat.format(purchase.subtotal)),
                  if (purchase.tax > 0)
                    _TotalRow(
                        label: 'Imposto',
                        value: currencyFormat.format(purchase.tax)),
                  if (purchase.discount > 0)
                    _TotalRow(
                      label: 'Desconto',
                      value: '- ${currencyFormat.format(purchase.discount)}',
                      valueColor: AppTheme.dangerColor,
                    ),
                  _TotalRow(
                    label: 'Total',
                    value: currencyFormat.format(purchase.total),
                    isBold: true,
                  ),
                  if (purchase.notes != null && purchase.notes!.isNotEmpty) ...[
                    const SizedBox(height: AppTheme.spacingMD),
                    Text('Observações',
                        style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: AppTheme.spacingSM),
                    Text(purchase.notes!,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
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
  final PurchaseItem item;
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
                  '${item.quantity}x ${currencyFormat.format(item.unitCost)}',
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
