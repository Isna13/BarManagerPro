import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class CashHistoryScreen extends StatefulWidget {
  const CashHistoryScreen({super.key});

  @override
  State<CashHistoryScreen> createState() => _CashHistoryScreenState();
}

class _CashHistoryScreenState extends State<CashHistoryScreen> {
  final currencyFormat = NumberFormat.currency(locale: 'pt_AO', symbol: 'Kz ');
  final dateFormat = DateFormat('dd/MM/yyyy');
  final timeFormat = DateFormat('HH:mm');
  DateTime? _selectedDate;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    await provider.loadCashBoxHistory();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        var cashRegisters = provider.cashRegisters;

        // Filter by date if selected
        if (_selectedDate != null) {
          cashRegisters = cashRegisters.where((cash) {
            return cash.openedAt.year == _selectedDate!.year &&
                cash.openedAt.month == _selectedDate!.month &&
                cash.openedAt.day == _selectedDate!.day;
          }).toList();
        }

        // Calculate totals
        final totalOpening =
            cashRegisters.fold(0.0, (sum, c) => sum + c.openingBalance);
        final totalSales =
            cashRegisters.fold(0.0, (sum, c) => sum + (c.totalSales ?? 0));
        final totalCashIn =
            cashRegisters.fold(0.0, (sum, c) => sum + (c.totalCashIn ?? 0));
        final totalCashOut =
            cashRegisters.fold(0.0, (sum, c) => sum + (c.totalCashOut ?? 0));

        if (provider.isLoading) {
          return const LoadingIndicator();
        }

        return Column(
          children: [
            // Date Filter
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              color: AppTheme.surfaceColor,
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => _selectDate(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacingMD,
                          vertical: AppTheme.spacingSM,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppTheme.borderColor),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusSmall),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today, size: 18),
                            const SizedBox(width: AppTheme.spacingSM),
                            Text(
                              _selectedDate != null
                                  ? dateFormat.format(_selectedDate!)
                                  : 'Todos os períodos',
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (_selectedDate != null) ...[
                    const SizedBox(width: AppTheme.spacingSM),
                    IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        setState(() {
                          _selectedDate = null;
                        });
                      },
                    ),
                  ],
                ],
              ),
            ),

            // Summary
            Container(
              margin: const EdgeInsets.all(AppTheme.spacingMD),
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0EA5E9), Color(0xFF0284C7)],
                ),
                borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                boxShadow: AppTheme.elevatedShadow,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryColumn(
                          label: 'Aberturas',
                          value: currencyFormat.format(totalOpening),
                        ),
                      ),
                      Container(width: 1, height: 40, color: Colors.white24),
                      Expanded(
                        child: _SummaryColumn(
                          label: 'Vendas',
                          value: currencyFormat.format(totalSales),
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.white24, height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryColumn(
                          label: 'Entradas',
                          value: currencyFormat.format(totalCashIn),
                        ),
                      ),
                      Container(width: 1, height: 40, color: Colors.white24),
                      Expanded(
                        child: _SummaryColumn(
                          label: 'Saídas',
                          value: currencyFormat.format(totalCashOut),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Cash Registers List
            Expanded(
              child: cashRegisters.isEmpty
                  ? const EmptyState(
                      icon: Icons.history,
                      title: 'Nenhum histórico encontrado',
                    )
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppTheme.spacingMD),
                        itemCount: cashRegisters.length,
                        itemBuilder: (context, index) {
                          final cash = cashRegisters[index];
                          return _CashHistoryCard(
                            cash: cash,
                            currencyFormat: currencyFormat,
                            dateFormat: dateFormat,
                            timeFormat: timeFormat,
                            onTap: () => _showCashDetails(cash),
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

  Future<void> _selectDate(BuildContext context) async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      locale: const Locale('pt', 'BR'),
    );

    if (date != null) {
      setState(() {
        _selectedDate = date;
      });
    }
  }

  void _showCashDetails(CashBox cash) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CashDetailsSheet(
        cash: cash,
        currencyFormat: currencyFormat,
        dateFormat: dateFormat,
        timeFormat: timeFormat,
      ),
    );
  }
}

class _SummaryColumn extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryColumn({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white70,
              ),
        ),
        const SizedBox(height: AppTheme.spacingXS),
        Text(
          value,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _CashHistoryCard extends StatelessWidget {
  final CashBox cash;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final DateFormat timeFormat;
  final VoidCallback onTap;

  const _CashHistoryCard({
    required this.cash,
    required this.currencyFormat,
    required this.dateFormat,
    required this.timeFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isOpen = cash.status == 'open' || cash.status == 'aberto';

    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
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
                      color: isOpen
                          ? AppTheme.accentColor.withOpacity(0.1)
                          : AppTheme.textMuted.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    ),
                    child: Icon(
                      isOpen ? Icons.lock_open : Icons.lock,
                      size: 20,
                      color: isOpen ? AppTheme.accentColor : AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingMD),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          dateFormat.format(cash.openedAt),
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        Text(
                          '${timeFormat.format(cash.openedAt)}${cash.closedAt != null ? ' - ${timeFormat.format(cash.closedAt!)}' : ' (Aberto)'}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(
                    label: isOpen ? 'Aberto' : 'Fechado',
                    type: isOpen ? StatusType.success : StatusType.neutral,
                  ),
                ],
              ),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _InfoColumn(
                    label: 'Abertura',
                    value: currencyFormat.format(cash.openingBalance),
                  ),
                  _InfoColumn(
                    label: 'Vendas',
                    value: currencyFormat.format(cash.totalSales ?? 0),
                    valueColor: AppTheme.accentColor,
                  ),
                  _InfoColumn(
                    label: 'Entradas',
                    value: currencyFormat.format(cash.totalCashIn ?? 0),
                    valueColor: const Color(0xFF0EA5E9),
                  ),
                  _InfoColumn(
                    label: 'Saídas',
                    value: currencyFormat.format(cash.totalCashOut ?? 0),
                    valueColor: AppTheme.dangerColor,
                  ),
                ],
              ),
              if (cash.userName != null) ...[
                const SizedBox(height: AppTheme.spacingSM),
                Row(
                  children: [
                    const Icon(Icons.person,
                        size: 14, color: AppTheme.textMuted),
                    const SizedBox(width: AppTheme.spacingXS),
                    Text(
                      cash.userName!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoColumn extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoColumn({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textMuted,
                fontSize: 10,
              ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: valueColor,
              ),
        ),
      ],
    );
  }
}

class _CashDetailsSheet extends StatelessWidget {
  final CashBox cash;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final DateFormat timeFormat;

  const _CashDetailsSheet({
    required this.cash,
    required this.currencyFormat,
    required this.dateFormat,
    required this.timeFormat,
  });

  @override
  Widget build(BuildContext context) {
    final isOpen = cash.status == 'open' || cash.status == 'aberto';

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppTheme.radiusXLarge),
          ),
        ),
        child: Column(
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
                    padding: const EdgeInsets.all(AppTheme.spacingSM),
                    decoration: BoxDecoration(
                      color: isOpen
                          ? AppTheme.accentColor.withOpacity(0.1)
                          : AppTheme.textMuted.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    ),
                    child: Icon(
                      isOpen ? Icons.lock_open : Icons.lock,
                      color: isOpen ? AppTheme.accentColor : AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingMD),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Caixa - ${dateFormat.format(cash.openedAt)}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (cash.userName != null)
                          Text(
                            'Operador: ${cash.userName}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                  StatusBadge(
                    label: isOpen ? 'Aberto' : 'Fechado',
                    type: isOpen ? StatusType.success : StatusType.neutral,
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(AppTheme.spacingMD),
                children: [
                  // Time Info
                  Container(
                    padding: const EdgeInsets.all(AppTheme.spacingMD),
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundColor,
                      borderRadius:
                          BorderRadius.circular(AppTheme.radiusMedium),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Abertura'),
                            Text(
                              '${dateFormat.format(cash.openedAt)} ${timeFormat.format(cash.openedAt)}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                        if (cash.closedAt != null) ...[
                          const SizedBox(height: AppTheme.spacingSM),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Fechamento'),
                              Text(
                                '${dateFormat.format(cash.closedAt!)} ${timeFormat.format(cash.closedAt!)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: AppTheme.spacingMD),

                  // Financial Summary
                  const SectionHeader(title: 'Resumo Financeiro'),
                  const SizedBox(height: AppTheme.spacingSM),

                  _DetailRow(
                    label: 'Saldo Inicial',
                    value: currencyFormat.format(cash.openingBalance),
                    icon: Icons.lock_open,
                    color: AppTheme.primaryColor,
                  ),
                  _DetailRow(
                    label: 'Total de Vendas',
                    value: currencyFormat.format(cash.totalSales ?? 0),
                    icon: Icons.point_of_sale,
                    color: AppTheme.accentColor,
                  ),
                  _DetailRow(
                    label: 'Outras Entradas',
                    value: currencyFormat.format(cash.totalCashIn ?? 0),
                    icon: Icons.arrow_downward,
                    color: const Color(0xFF0EA5E9),
                  ),
                  _DetailRow(
                    label: 'Saídas',
                    value: currencyFormat.format(cash.totalCashOut ?? 0),
                    icon: Icons.arrow_upward,
                    color: AppTheme.dangerColor,
                  ),

                  const SizedBox(height: AppTheme.spacingMD),
                  const Divider(),
                  const SizedBox(height: AppTheme.spacingMD),

                  // Expected vs Actual
                  Container(
                    padding: const EdgeInsets.all(AppTheme.spacingMD),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.05),
                      borderRadius:
                          BorderRadius.circular(AppTheme.radiusMedium),
                      border: Border.all(
                        color: AppTheme.primaryColor.withOpacity(0.2),
                      ),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Saldo Esperado'),
                            Text(
                              currencyFormat.format(cash.expectedBalance),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppTheme.primaryColor,
                              ),
                            ),
                          ],
                        ),
                        if (cash.closingBalance != null) ...[
                          const SizedBox(height: AppTheme.spacingSM),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Saldo de Fechamento'),
                              Text(
                                currencyFormat.format(cash.closingBalance!),
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppTheme.spacingSM),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Diferença'),
                              Text(
                                currencyFormat.format(cash.difference ?? 0),
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: (cash.difference ?? 0) >= 0
                                      ? AppTheme.accentColor
                                      : AppTheme.dangerColor,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  if (cash.notes != null && cash.notes!.isNotEmpty) ...[
                    const SizedBox(height: AppTheme.spacingMD),
                    const SectionHeader(title: 'Observações'),
                    const SizedBox(height: AppTheme.spacingSM),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(AppTheme.spacingMD),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundColor,
                        borderRadius:
                            BorderRadius.circular(AppTheme.radiusMedium),
                      ),
                      child: Text(cash.notes!),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _DetailRow({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSM),
      padding: const EdgeInsets.all(AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingSM),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: AppTheme.spacingMD),
          Expanded(child: Text(label)),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
