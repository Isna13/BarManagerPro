import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await context.read<DataProvider>().loadCustomers();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        var customers = provider.customers;

        // Filter by search
        if (_searchController.text.isNotEmpty) {
          final query = _searchController.text.toLowerCase();
          customers = customers
              .where((c) =>
                  c.fullName.toLowerCase().contains(query) ||
                  (c.phone?.toLowerCase().contains(query) ?? false) ||
                  (c.code?.toLowerCase().contains(query) ?? false))
              .toList();
        }

        // Stats
        final totalCustomers = customers.length;
        final totalDebt = customers.fold(0.0, (sum, c) => sum + c.currentDebt);
        final customersWithDebt =
            customers.where((c) => c.currentDebt > 0).length;

        return Column(
          children: [
            // Summary Cards
            Container(
              margin: const EdgeInsets.all(AppTheme.spacingMD),
              child: Row(
                children: [
                  Expanded(
                    child: _SummaryCard(
                      icon: Icons.people,
                      label: 'Total',
                      value: '$totalCustomers',
                      color: AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSM),
                  Expanded(
                    child: _SummaryCard(
                      icon: Icons.warning,
                      label: 'Com Dívida',
                      value: '$customersWithDebt',
                      color: AppTheme.warningColor,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSM),
                  Expanded(
                    child: _SummaryCard(
                      icon: Icons.account_balance_wallet,
                      label: 'Dívida Total',
                      value: currencyFormat.format(totalDebt),
                      color: AppTheme.dangerColor,
                      isSmallText: true,
                    ),
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: CustomSearchBar(
                controller: _searchController,
                hintText: 'Buscar clientes...',
                onChanged: (_) => setState(() {}),
                onClear: () => setState(() {}),
              ),
            ),
            const SizedBox(height: AppTheme.spacingMD),

            // Customers List
            Expanded(
              child: provider.isLoading
                  ? const LoadingIndicator()
                  : customers.isEmpty
                      ? const EmptyState(
                          icon: Icons.people,
                          title: 'Nenhum cliente encontrado',
                        )
                      : RefreshIndicator(
                          onRefresh: _loadData,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppTheme.spacingMD),
                            itemCount: customers.length,
                            itemBuilder: (context, index) {
                              final customer = customers[index];
                              return _CustomerCard(
                                customer: customer,
                                currencyFormat: currencyFormat,
                                onTap: () => _showCustomerDetails(customer),
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

  void _showCustomerDetails(Customer customer) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CustomerDetailsSheet(
        customer: customer,
        currencyFormat: currencyFormat,
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _SummaryCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool isSmallText;

  const _SummaryCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.isSmallText = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: AppTheme.spacingSM),
          Text(
            value,
            style: TextStyle(
              fontSize: isSmallText ? 12 : 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  final Customer customer;
  final NumberFormat currencyFormat;
  final VoidCallback onTap;

  const _CustomerCard({
    required this.customer,
    required this.currencyFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasDebt = customer.currentDebt > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
        border: hasDebt
            ? Border.all(
                color: AppTheme.warningColor.withOpacity(0.5), width: 1)
            : null,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMD),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: hasDebt
                      ? AppTheme.warningGradient
                      : AppTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                ),
                child: Center(
                  child: Text(
                    customer.fullName.substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppTheme.spacingMD),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer.fullName,
                      style: Theme.of(context).textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (customer.phone != null) ...[
                      const SizedBox(height: AppTheme.spacingXS),
                      Row(
                        children: [
                          const Icon(Icons.phone,
                              size: 14, color: AppTheme.textMuted),
                          const SizedBox(width: AppTheme.spacingXS),
                          Text(
                            customer.phone!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: AppTheme.spacingXS),
                    Row(
                      children: [
                        const Icon(Icons.star,
                            size: 14, color: AppTheme.warningColor),
                        const SizedBox(width: AppTheme.spacingXS),
                        Text(
                          '${customer.loyaltyPoints} pontos',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (hasDebt) ...[
                    Text(
                      'Dívida',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Text(
                      currencyFormat.format(customer.currentDebt),
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: AppTheme.dangerColor,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ] else ...[
                    StatusBadge(
                      label: 'Sem dívida',
                      type: StatusType.success,
                    ),
                  ],
                  const SizedBox(height: AppTheme.spacingSM),
                  Text(
                    'Total: ${currencyFormat.format(customer.totalPurchases)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CustomerDetailsSheet extends StatelessWidget {
  final Customer customer;
  final NumberFormat currencyFormat;

  const _CustomerDetailsSheet({
    required this.customer,
    required this.currencyFormat,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
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
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  ),
                  child: Center(
                    child: Text(
                      customer.fullName.substring(0, 1).toUpperCase(),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMD),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customer.fullName,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      if (customer.code != null)
                        Text(
                          'Código: ${customer.code}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
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
                  // Stats Row
                  Row(
                    children: [
                      Expanded(
                        child: _StatItem(
                          label: 'Total Compras',
                          value: currencyFormat.format(customer.totalPurchases),
                          color: AppTheme.accentColor,
                        ),
                      ),
                      Expanded(
                        child: _StatItem(
                          label: 'Dívida Atual',
                          value: currencyFormat.format(customer.currentDebt),
                          color: customer.currentDebt > 0
                              ? AppTheme.dangerColor
                              : AppTheme.accentColor,
                        ),
                      ),
                      Expanded(
                        child: _StatItem(
                          label: 'Pontos',
                          value: '${customer.loyaltyPoints}',
                          color: AppTheme.warningColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppTheme.spacingLG),

                  // Contact Info
                  _InfoRow(
                    icon: Icons.phone,
                    label: 'Telefone',
                    value: customer.phone ?? 'Não informado',
                  ),
                  _InfoRow(
                    icon: Icons.email,
                    label: 'E-mail',
                    value: customer.email ?? 'Não informado',
                  ),
                  _InfoRow(
                    icon: Icons.location_on,
                    label: 'Endereço',
                    value: customer.address ?? 'Não informado',
                  ),
                  _InfoRow(
                    icon: Icons.credit_card,
                    label: 'Limite de Crédito',
                    value: currencyFormat.format(customer.creditLimit),
                  ),

                  const SizedBox(height: AppTheme.spacingMD),

                  // Credit Status
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppTheme.spacingMD),
                    decoration: BoxDecoration(
                      color: customer.currentDebt > 0
                          ? AppTheme.warningColor.withOpacity(0.1)
                          : AppTheme.accentColor.withOpacity(0.1),
                      borderRadius:
                          BorderRadius.circular(AppTheme.radiusMedium),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          customer.currentDebt > 0
                              ? Icons.warning_amber
                              : Icons.check_circle,
                          color: customer.currentDebt > 0
                              ? AppTheme.warningColor
                              : AppTheme.accentColor,
                          size: 32,
                        ),
                        const SizedBox(height: AppTheme.spacingSM),
                        Text(
                          customer.currentDebt > 0
                              ? 'Cliente com dívida pendente'
                              : 'Cliente em dia',
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    color: customer.currentDebt > 0
                                        ? AppTheme.warningColor
                                        : AppTheme.accentColor,
                                  ),
                        ),
                        if (customer.currentDebt > 0)
                          Text(
                            'Crédito disponível: ${currencyFormat.format(customer.creditLimit - customer.currentDebt)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
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

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingSM),
      margin: const EdgeInsets.symmetric(horizontal: AppTheme.spacingXS),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingSM),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
            ),
            child: Icon(icon, size: 20, color: AppTheme.primaryColor),
          ),
          const SizedBox(width: AppTheme.spacingMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                Text(value, style: Theme.of(context).textTheme.titleSmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
