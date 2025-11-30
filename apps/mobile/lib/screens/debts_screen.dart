import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class DebtsScreen extends StatefulWidget {
  const DebtsScreen({super.key});

  @override
  State<DebtsScreen> createState() => _DebtsScreenState();
}

class _DebtsScreenState extends State<DebtsScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'pt_AO', symbol: 'Kz ');
  final dateFormat = DateFormat('dd/MM/yyyy');
  String _selectedFilter = 'all';
  String _searchQuery = '';

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
    await provider.loadDebts(status: status);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        var debts = provider.debts;

        if (_searchQuery.isNotEmpty) {
          debts = debts
              .where((d) => (d.customerName?.toLowerCase() ?? '')
                  .contains(_searchQuery.toLowerCase()))
              .toList();
        }

        final totalDebt = debts.fold(0.0, (sum, d) => sum + d.remainingAmount);
        final pendingCount = debts.where((d) => d.status == 'pending').length;
        final overdueCount = debts.where((d) => d.status == 'overdue').length;

        if (provider.isLoading) {
          return const LoadingIndicator();
        }

        return Column(
          children: [
            Container(
              margin: const EdgeInsets.all(AppTheme.spacingMD),
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFDC2626), Color(0xFFB91C1C)],
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
                          'Total em Dívidas',
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: Colors.white70,
                                  ),
                        ),
                        const SizedBox(height: AppTheme.spacingSM),
                        Text(
                          currencyFormat.format(totalDebt),
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
                      Text('$pendingCount pendentes',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: Colors.white70)),
                      const SizedBox(height: 4),
                      Text('$overdueCount vencidas',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: Colors.amber)),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: TextField(
                onChanged: (value) => setState(() => _searchQuery = value),
                decoration: InputDecoration(
                  hintText: 'Buscar por cliente...',
                  prefixIcon: const Icon(Icons.search),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  ),
                  filled: true,
                  fillColor: AppTheme.cardColor,
                ),
              ),
            ),
            const SizedBox(height: AppTheme.spacingSM),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: Row(
                children: [
                  _buildFilterChip('Todas', 'all'),
                  _buildFilterChip('Pendentes', 'pending'),
                  _buildFilterChip('Vencidas', 'overdue'),
                  _buildFilterChip('Pagas', 'paid'),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingMD),
            Expanded(
              child: debts.isEmpty
                  ? const EmptyState(
                      icon: Icons.money_off, title: 'Nenhuma dívida encontrada')
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppTheme.spacingMD),
                        itemCount: debts.length,
                        itemBuilder: (context, index) {
                          final debt = debts[index];
                          return _DebtCard(
                            debt: debt,
                            currencyFormat: currencyFormat,
                            dateFormat: dateFormat,
                            onTap: () => _showDebtDetails(debt),
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

  Widget _buildFilterChip(String label, String filter) {
    return Padding(
      padding: const EdgeInsets.only(right: AppTheme.spacingSM),
      child: FilterChip(
        label: Text(label),
        selected: _selectedFilter == filter,
        onSelected: (_) {
          setState(() => _selectedFilter = filter);
          _loadData();
        },
        selectedColor: AppTheme.dangerColor.withOpacity(0.2),
        checkmarkColor: AppTheme.dangerColor,
      ),
    );
  }

  void _showDebtDetails(Debt debt) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _DebtDetailsSheet(
        debt: debt,
        currencyFormat: currencyFormat,
        dateFormat: dateFormat,
      ),
    );
  }
}

class _DebtCard extends StatelessWidget {
  final Debt debt;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  const _DebtCard({
    required this.debt,
    required this.currencyFormat,
    required this.dateFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isPaid = debt.status == 'paid';
    final progress = debt.originalAmount > 0
        ? (debt.paidAmount / debt.originalAmount).clamp(0.0, 1.0)
        : 0.0;

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
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppTheme.dangerColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    ),
                    child: Center(
                      child: Text(
                        (debt.customerName ?? 'C')[0].toUpperCase(),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: AppTheme.dangerColor,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingMD),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(debt.customerName ?? 'Cliente',
                            style: Theme.of(context).textTheme.titleSmall),
                        if (debt.dueDate != null)
                          Text('Vence: ${dateFormat.format(debt.dueDate!)}',
                              style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  Text(
                    currencyFormat.format(debt.remainingAmount),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: isPaid
                              ? AppTheme.accentColor
                              : AppTheme.dangerColor,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacingSM),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: AppTheme.borderColor,
                  valueColor: AlwaysStoppedAnimation(
                      isPaid ? AppTheme.accentColor : AppTheme.primaryColor),
                  minHeight: 6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DebtDetailsSheet extends StatelessWidget {
  final Debt debt;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;

  const _DebtDetailsSheet({
    required this.debt,
    required this.currencyFormat,
    required this.dateFormat,
  });

  @override
  Widget build(BuildContext context) {
    final progress = debt.originalAmount > 0
        ? (debt.paidAmount / debt.originalAmount).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXLarge)),
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
                borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Row(
              children: [
                Text('Detalhes da Dívida',
                    style: Theme.of(context).textTheme.titleLarge),
                const Spacer(),
                IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context)),
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
                  Center(
                    child: Text(debt.customerName ?? 'Cliente',
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  const SizedBox(height: AppTheme.spacingLG),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppTheme.spacingMD),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [AppTheme.dangerColor, Color(0xFFB91C1C)]),
                      borderRadius:
                          BorderRadius.circular(AppTheme.radiusMedium),
                    ),
                    child: Column(
                      children: [
                        Text('Valor Restante',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(color: Colors.white70)),
                        Text(currencyFormat.format(debt.remainingAmount),
                            style: Theme.of(context)
                                .textTheme
                                .headlineMedium
                                ?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold)),
                        const SizedBox(height: AppTheme.spacingSM),
                        LinearProgressIndicator(
                          value: progress,
                          backgroundColor: Colors.white24,
                          valueColor:
                              const AlwaysStoppedAnimation(Colors.white),
                          minHeight: 8,
                        ),
                        const SizedBox(height: AppTheme.spacingSM),
                        Text('${(progress * 100).toStringAsFixed(0)}% pago',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: Colors.white70)),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppTheme.spacingLG),
                  _DetailRow(
                      label: 'Valor Total',
                      value: currencyFormat.format(debt.originalAmount)),
                  _DetailRow(
                      label: 'Valor Pago',
                      value: currencyFormat.format(debt.paidAmount)),
                  if (debt.dueDate != null)
                    _DetailRow(
                        label: 'Vencimento',
                        value: dateFormat.format(debt.dueDate!)),
                  _DetailRow(
                      label: 'Criado em',
                      value: dateFormat.format(debt.createdAt)),
                  if (debt.payments.isNotEmpty) ...[
                    const Divider(height: 32),
                    Text('Histórico de Pagamentos',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppTheme.spacingSM),
                    ...debt.payments.map((p) => Container(
                          margin:
                              const EdgeInsets.only(bottom: AppTheme.spacingSM),
                          padding: const EdgeInsets.all(AppTheme.spacingSM),
                          decoration: BoxDecoration(
                            color: AppTheme.accentColor.withOpacity(0.1),
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSmall),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle,
                                  color: AppTheme.accentColor, size: 20),
                              const SizedBox(width: AppTheme.spacingSM),
                              Text(currencyFormat.format(p.amount),
                                  style:
                                      Theme.of(context).textTheme.titleSmall),
                              const Spacer(),
                              Text(dateFormat.format(p.paidAt),
                                  style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        )),
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

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

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
