import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class CashRegisterScreen extends StatefulWidget {
  const CashRegisterScreen({super.key});

  @override
  State<CashRegisterScreen> createState() => _CashRegisterScreenState();
}

class _CashRegisterScreenState extends State<CashRegisterScreen> {
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final dateTimeFormat = DateFormat('dd/MM/yyyy HH:mm');
  final timeFormat = DateFormat('HH:mm');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    await provider.loadCurrentCashBox();
    if (provider.currentCashBox != null) {
      await provider.loadCashMovements(cashBoxId: provider.currentCashBox!.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading) {
          return const LoadingIndicator();
        }

        final currentCash = provider.currentCashBox;

        if (currentCash == null) {
          return const EmptyState(
            icon: Icons.point_of_sale,
            title: 'Nenhum caixa aberto',
            subtitle: 'Não há caixa aberto no momento',
          );
        }

        final isOpen =
            currentCash.status == 'open' || currentCash.status == 'aberto';
        final movements = provider.cashMovements;

        return RefreshIndicator(
          onRefresh: _loadData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status Card
                _CashStatusCard(
                  cash: currentCash,
                  currencyFormat: currencyFormat,
                  dateTimeFormat: dateTimeFormat,
                  isOpen: isOpen,
                ),

                const SizedBox(height: AppTheme.spacingLG),

                // Summary Cards
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: AppTheme.spacingMD,
                  mainAxisSpacing: AppTheme.spacingMD,
                  childAspectRatio: 1.5,
                  children: [
                    _SummaryCard(
                      title: 'Abertura',
                      value: currencyFormat.format(currentCash.openingBalance),
                      icon: Icons.lock_open,
                      color: AppTheme.primaryColor,
                    ),
                    _SummaryCard(
                      title: 'Vendas',
                      value: currencyFormat.format(currentCash.totalSales ?? 0),
                      icon: Icons.point_of_sale,
                      color: AppTheme.accentColor,
                    ),
                    _SummaryCard(
                      title: 'Entradas',
                      value:
                          currencyFormat.format(currentCash.totalCashIn ?? 0),
                      icon: Icons.arrow_downward,
                      color: const Color(0xFF0EA5E9),
                    ),
                    _SummaryCard(
                      title: 'Saídas',
                      value:
                          currencyFormat.format(currentCash.totalCashOut ?? 0),
                      icon: Icons.arrow_upward,
                      color: AppTheme.dangerColor,
                    ),
                  ],
                ),

                const SizedBox(height: AppTheme.spacingLG),

                // Expected Balance
                Container(
                  padding: const EdgeInsets.all(AppTheme.spacingMD),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceColor,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                    boxShadow: AppTheme.cardShadow,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Saldo Esperado',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: AppTheme.textMuted,
                                ),
                          ),
                          const SizedBox(height: AppTheme.spacingXS),
                          Text(
                            currencyFormat.format(currentCash.expectedBalance),
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryColor,
                                ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.all(AppTheme.spacingMD),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withOpacity(0.1),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusMedium),
                        ),
                        child: const Icon(
                          Icons.account_balance_wallet,
                          color: AppTheme.primaryColor,
                          size: 28,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: AppTheme.spacingLG),

                // Recent Movements
                if (movements.isNotEmpty) ...[
                  const SectionHeader(title: 'Movimentações Recentes'),
                  const SizedBox(height: AppTheme.spacingSM),
                  ...movements.take(10).map((movement) => _MovementCard(
                        movement: movement,
                        currencyFormat: currencyFormat,
                        timeFormat: timeFormat,
                      )),
                ],

                if (movements.isEmpty)
                  const EmptyState(
                    icon: Icons.receipt_long,
                    title: 'Sem movimentações',
                    subtitle: 'Nenhuma movimentação registrada',
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CashStatusCard extends StatelessWidget {
  final CashBox cash;
  final NumberFormat currencyFormat;
  final DateFormat dateTimeFormat;
  final bool isOpen;

  const _CashStatusCard({
    required this.cash,
    required this.currencyFormat,
    required this.dateTimeFormat,
    required this.isOpen,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppTheme.spacingLG),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isOpen
              ? [AppTheme.accentColor, const Color(0xFF059669)]
              : [AppTheme.textMuted, const Color(0xFF64748B)],
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusLarge),
        boxShadow: AppTheme.elevatedShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppTheme.spacingSM),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                ),
                child: Icon(
                  isOpen ? Icons.lock_open : Icons.lock,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppTheme.spacingMD),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isOpen ? 'CAIXA ABERTO' : 'CAIXA FECHADO',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                    ),
                    if (cash.userName != null)
                      Text(
                        cash.userName!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.white70,
                            ),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMD,
                  vertical: AppTheme.spacingXS,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                ),
                child: Text(
                  isOpen ? 'Ativo' : 'Fechado',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTheme.spacingLG),
          const Divider(color: Colors.white24),
          const SizedBox(height: AppTheme.spacingMD),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Abertura',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    dateTimeFormat.format(cash.openedAt),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              if (cash.closedAt != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Fechamento',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.7),
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      dateTimeFormat.format(cash.closedAt!),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
        border: Border.all(
          color: color.withOpacity(0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: AppTheme.spacingXS),
              Text(
                title,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.textMuted,
                    ),
              ),
            ],
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MovementCard extends StatelessWidget {
  final CashMovement movement;
  final NumberFormat currencyFormat;
  final DateFormat timeFormat;

  const _MovementCard({
    required this.movement,
    required this.currencyFormat,
    required this.timeFormat,
  });

  @override
  Widget build(BuildContext context) {
    // Normalizar movementType para lowercase para comparação consistente
    final type = movement.movementType.toLowerCase();
    
    // cash_in, cash, entry, entrada = entrada de dinheiro físico (vendas em dinheiro)
    // vale, orange, orange_money, teletaku, mixed = pagamento digital (não entra no caixa físico)
    final isEntry = type == 'entry' ||
        type == 'entrada' ||
        type == 'cash_in' ||
        type == 'cash';
    
    final color = isEntry ? AppTheme.accentColor : AppTheme.dangerColor;
    final icon = isEntry ? Icons.arrow_downward : Icons.arrow_upward;

    String typeLabel;
    switch (type) {
      case 'entry':
      case 'entrada':
        typeLabel = 'Entrada';
        break;
      case 'exit':
      case 'saida':
      case 'saída':
      case 'cash_out':
        typeLabel = 'Saída';
        break;
      case 'sale':
      case 'venda':
      case 'cash_in':
      case 'cash':
        typeLabel = 'Venda';
        break;
      case 'vale':
      case 'debt':
        typeLabel = 'Venda (Vale)';
        break;
      case 'orange':
      case 'orange_money':
        typeLabel = 'Venda (Orange)';
        break;
      case 'teletaku':
        typeLabel = 'Venda (TeleTaku)';
        break;
      case 'mixed':
        typeLabel = 'Venda (Misto)';
        break;
      default:
        typeLabel = movement.movementType;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSM),
      padding: const EdgeInsets.all(AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        border: Border.all(
          color: color.withOpacity(0.2),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingSM),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: AppTheme.spacingMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  typeLabel,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (movement.description != null)
                  Text(
                    movement.description!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.textMuted,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isEntry ? '+' : '-'} ${currencyFormat.format(movement.amount)}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
              ),
              Text(
                timeFormat.format(movement.createdAt),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.textMuted,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
