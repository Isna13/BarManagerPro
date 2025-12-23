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
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final dateFormat = DateFormat('dd/MM/yyyy');
  String _selectedFilter = 'all';
  String _searchQuery = '';
  bool _groupByCustomer = true; // 🔴 CORREÇÃO: Agrupar por cliente por padrão

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
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
                  const SizedBox(width: AppTheme.spacingMD),
                  // Toggle para agrupar por cliente
                  FilterChip(
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _groupByCustomer ? Icons.group : Icons.list,
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(_groupByCustomer ? 'Por Cliente' : 'Lista'),
                      ],
                    ),
                    selected: _groupByCustomer,
                    onSelected: (_) => setState(() => _groupByCustomer = !_groupByCustomer),
                    selectedColor: AppTheme.primaryColor.withOpacity(0.2),
                    checkmarkColor: AppTheme.primaryColor,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingMD),
            Expanded(
              child: _groupByCustomer
                  ? _buildGroupedDebtsList(provider)
                  : _buildFlatDebtsList(debts),
            ),
          ],
        );
      },
    );
  }

  // 🔴 CORREÇÃO: Lista agrupada por cliente
  Widget _buildGroupedDebtsList(DataProvider provider) {
    var grouped = provider.debtsByCustomer;

    // Aplicar filtro de busca
    if (_searchQuery.isNotEmpty) {
      grouped = grouped
          .where((g) => g.customerName.toLowerCase().contains(_searchQuery.toLowerCase()))
          .toList();
    }

    // Aplicar filtro de status
    if (_selectedFilter != 'all') {
      grouped = grouped.where((g) {
        if (_selectedFilter == 'pending') return g.pendingCount > 0;
        if (_selectedFilter == 'overdue') return g.overdueCount > 0;
        if (_selectedFilter == 'paid') return g.pendingCount == 0 && g.overdueCount == 0;
        return true;
      }).toList();
    }

    if (grouped.isEmpty) {
      return const EmptyState(
        icon: Icons.money_off,
        title: 'Nenhuma dívida encontrada',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
        itemCount: grouped.length,
        itemBuilder: (context, index) {
          final summary = grouped[index];
          return _CustomerDebtCard(
            summary: summary,
            currencyFormat: currencyFormat,
            dateFormat: dateFormat,
            onTap: () => _showCustomerDebtsDetails(summary),
          );
        },
      ),
    );
  }

  // Lista plana (original)
  Widget _buildFlatDebtsList(List<Debt> debts) {
    if (debts.isEmpty) {
      return const EmptyState(
        icon: Icons.money_off,
        title: 'Nenhuma dívida encontrada',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
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

  // 🔴 CORREÇÃO: Mostrar detalhes das dívidas de um cliente
  void _showCustomerDebtsDetails(CustomerDebtSummary summary) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CustomerDebtsSheet(
        summary: summary,
        currencyFormat: currencyFormat,
        dateFormat: dateFormat,
      ),
    );
  }
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

// 🔴 CORREÇÃO: Card para exibir dívidas agrupadas por cliente
class _CustomerDebtCard extends StatelessWidget {
  final CustomerDebtSummary summary;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;
  final VoidCallback onTap;

  const _CustomerDebtCard({
    required this.summary,
    required this.currencyFormat,
    required this.dateFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isPaid = summary.pendingCount == 0 && summary.overdueCount == 0;
    final hasOverdue = summary.overdueCount > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
        border: hasOverdue
            ? Border.all(color: Colors.orange.shade300, width: 2)
            : null,
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
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: hasOverdue
                          ? Colors.orange.withOpacity(0.1)
                          : AppTheme.dangerColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    ),
                    child: Center(
                      child: Text(
                        summary.customerName[0].toUpperCase(),
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              color: hasOverdue ? Colors.orange : AppTheme.dangerColor,
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
                        Text(
                          summary.customerName,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${summary.debtCount} dívida${summary.debtCount > 1 ? 's' : ''}',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppTheme.primaryColor,
                                      fontWeight: FontWeight.w500,
                                    ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (summary.overdueCount > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.orange.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  '${summary.overdueCount} vencida${summary.overdueCount > 1 ? 's' : ''}',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: Colors.orange,
                                        fontWeight: FontWeight.w500,
                                      ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        currencyFormat.format(summary.totalRemainingAmount),
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: isPaid ? AppTheme.accentColor : AppTheme.dangerColor,
                            ),
                      ),
                      Text(
                        'restante',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.textSecondary,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacingMD),
              // Barra de progresso
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: summary.paymentProgress,
                  backgroundColor: AppTheme.dangerColor.withOpacity(0.2),
                  valueColor: AlwaysStoppedAnimation(
                    isPaid ? AppTheme.accentColor : AppTheme.primaryColor,
                  ),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Pago: ${currencyFormat.format(summary.totalPaidAmount)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.accentColor,
                        ),
                  ),
                  Text(
                    '${(summary.paymentProgress * 100).toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  Text(
                    'Total: ${currencyFormat.format(summary.totalOriginalAmount)}',
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

// 🔴 CORREÇÃO: Sheet para mostrar dívidas consolidadas de um cliente
class _CustomerDebtsSheet extends StatelessWidget {
  final CustomerDebtSummary summary;
  final NumberFormat currencyFormat;
  final DateFormat dateFormat;

  const _CustomerDebtsSheet({
    required this.summary,
    required this.currencyFormat,
    required this.dateFormat,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header com resumo do cliente
          Container(
            margin: const EdgeInsets.all(AppTheme.spacingMD),
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: summary.hasOverdue
                    ? [Colors.orange.shade600, Colors.orange.shade800]
                    : [AppTheme.dangerColor, const Color(0xFFB91C1C)],
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Center(
                        child: Text(
                          summary.customerName[0].toUpperCase(),
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                color: Colors.white,
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
                          Text(
                            summary.customerName,
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                          Text(
                            '${summary.debtCount} dívida${summary.debtCount > 1 ? 's' : ''} • ${summary.overdueCount} vencida${summary.overdueCount > 1 ? 's' : ''}',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Colors.white70,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppTheme.spacingMD),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _SummaryItem(
                      label: 'Total Original',
                      value: currencyFormat.format(summary.totalOriginalAmount),
                    ),
                    _SummaryItem(
                      label: 'Pago',
                      value: currencyFormat.format(summary.totalPaidAmount),
                    ),
                    _SummaryItem(
                      label: 'Restante',
                      value: currencyFormat.format(summary.totalRemainingAmount),
                      highlight: true,
                    ),
                  ],
                ),
                const SizedBox(height: AppTheme.spacingSM),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: summary.paymentProgress,
                    backgroundColor: Colors.white24,
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${(summary.paymentProgress * 100).toStringAsFixed(0)}% pago',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white70,
                      ),
                ),
              ],
            ),
          ),
          // Lista de dívidas individuais
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
            child: Row(
              children: [
                const Icon(Icons.list, size: 20, color: AppTheme.textSecondary),
                const SizedBox(width: 8),
                Text(
                  'Histórico de Dívidas',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingSM),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              itemCount: summary.debts.length,
              itemBuilder: (context, index) {
                final debt = summary.debts[index];
                final isPaid = debt.status == 'paid';
                final isOverdue = debt.status == 'overdue';

                return Container(
                  margin: const EdgeInsets.only(bottom: AppTheme.spacingSM),
                  padding: const EdgeInsets.all(AppTheme.spacingMD),
                  decoration: BoxDecoration(
                    color: AppTheme.cardColor,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    border: isOverdue
                        ? Border.all(color: Colors.orange.shade300)
                        : isPaid
                            ? Border.all(color: AppTheme.accentColor.withOpacity(0.5))
                            : null,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isPaid
                                ? Icons.check_circle
                                : isOverdue
                                    ? Icons.warning
                                    : Icons.pending,
                            color: isPaid
                                ? AppTheme.accentColor
                                : isOverdue
                                    ? Colors.orange
                                    : AppTheme.dangerColor,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Dívida de ${dateFormat.format(debt.createdAt)}',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w500,
                                  ),
                            ),
                          ),
                          Text(
                            currencyFormat.format(debt.originalAmount),
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                        ],
                      ),
                      if (debt.dueDate != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Vencimento: ${dateFormat.format(debt.dueDate!)}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: isOverdue ? Colors.orange : AppTheme.textSecondary,
                              ),
                        ),
                      ],
                      if (debt.paidAmount > 0) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(2),
                                child: LinearProgressIndicator(
                                  value: debt.originalAmount > 0
                                      ? (debt.paidAmount / debt.originalAmount).clamp(0.0, 1.0)
                                      : 0,
                                  backgroundColor: Colors.grey.shade200,
                                  valueColor: AlwaysStoppedAnimation(
                                    isPaid ? AppTheme.accentColor : AppTheme.primaryColor,
                                  ),
                                  minHeight: 4,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Pago: ${currencyFormat.format(debt.paidAmount)}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.accentColor,
                                  ),
                            ),
                          ],
                        ),
                      ],
                      // Pagamentos desta dívida
                      if (debt.payments.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ...debt.payments.map((p) => Padding(
                              padding: const EdgeInsets.only(left: 28, top: 4),
                              child: Row(
                                children: [
                                  const Icon(Icons.subdirectory_arrow_right,
                                      size: 16, color: AppTheme.textSecondary),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${dateFormat.format(p.paidAt)}: ',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                  Text(
                                    currencyFormat.format(p.amount),
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: AppTheme.accentColor,
                                          fontWeight: FontWeight.w500,
                                        ),
                                  ),
                                ],
                              ),
                            )),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _SummaryItem({
    required this.label,
    required this.value,
    this.highlight = false,
  });

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
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Colors.white,
                fontWeight: highlight ? FontWeight.bold : FontWeight.normal,
              ),
        ),
      ],
    );
  }
}