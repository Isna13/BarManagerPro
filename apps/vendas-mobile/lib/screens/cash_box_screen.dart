import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../utils/app_theme.dart';
import '../utils/currency_helper.dart';
import '../utils/responsive_helper.dart';
import '../widgets/modern_widgets.dart';
import '../providers/auth_provider.dart';
import '../providers/cash_box_provider.dart';

class CashBoxScreen extends StatefulWidget {
  const CashBoxScreen({super.key});

  @override
  State<CashBoxScreen> createState() => _CashBoxScreenState();
}

class _CashBoxScreenState extends State<CashBoxScreen> {
  final _openingCashController = TextEditingController();
  final _closingCashController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _openingCashController.dispose();
    _closingCashController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<CashBoxProvider>(
      builder: (context, cashBox, _) {
        if (cashBox.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (cashBox.hasOpenCashBox) {
          return _buildOpenCashBoxView(cashBox);
        }

        return _buildClosedCashBoxView(cashBox);
      },
    );
  }

  Widget _buildClosedCashBoxView(CashBoxProvider cashBox) {
    final padding = context.horizontalPadding;

    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(padding),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: ModernCard(
            padding: EdgeInsets.all(context.responsiveSpacing(base: 28)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    gradient: AppTheme.warningGradient,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.warningColor.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.lock_rounded,
                    size: context.responsiveIconSize(base: 40),
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: context.responsiveSpacing(base: 28)),
                Text(
                  'Caixa Fechado',
                  style: TextStyle(
                    fontSize: context.responsiveFontSize(24),
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                SizedBox(height: context.responsiveSpacing(base: 8)),
                Text(
                  'Abra o caixa para começar\na registrar vendas',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: context.responsiveFontSize(14),
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
                SizedBox(height: context.responsiveSpacing(base: 32)),
                TextField(
                  controller: _openingCashController,
                  keyboardType: TextInputType.number,
                  style: TextStyle(fontSize: context.responsiveFontSize(16)),
                  decoration: InputDecoration(
                    labelText: 'Valor de Abertura (FCFA)',
                    prefixIcon: const Icon(Icons.monetization_on_rounded),
                    hintText: '0',
                    labelStyle:
                        TextStyle(fontSize: context.responsiveFontSize(14)),
                  ),
                ),
                SizedBox(height: context.responsiveSpacing(base: 24)),
                GradientButton(
                  text: 'Abrir Caixa',
                  icon: Icons.lock_open_rounded,
                  gradient: AppTheme.successGradient,
                  onPressed: () => _openCashBox(cashBox),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOpenCashBoxView(CashBoxProvider cashBox) {
    final current = cashBox.currentCashBox!;
    final openingCash = current['opening_cash'] ?? current['openingCash'] ?? 0;
    final totalCash = current['total_cash'] ?? current['totalCash'] ?? 0;
    final totalCard = current['total_card'] ?? current['totalCard'] ?? 0;
    final totalMobileMoney =
        current['total_mobile_money'] ?? current['totalMobileMoney'] ?? 0;
    final totalDebt = current['total_debt'] ?? current['totalDebt'] ?? 0;
    final totalSales = current['total_sales'] ?? current['totalSales'] ?? 0;
    final expectedCash = openingCash + totalCash;

    final openedAt = current['opened_at'] ?? current['openedAt'];
    String openedAtFormatted = '-';
    if (openedAt != null) {
      try {
        final date = DateTime.parse(openedAt);
        openedAtFormatted = DateFormat('dd/MM/yyyy HH:mm').format(date);
      } catch (_) {}
    }

    final padding = context.horizontalPadding;

    return SingleChildScrollView(
      padding: EdgeInsets.all(padding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header com status
          StatusCard(
            icon: Icons.lock_open_rounded,
            color: AppTheme.successColor,
            title: 'Caixa Aberto',
            subtitle: 'Aberto em: $openedAtFormatted',
          ),
          SizedBox(height: context.responsiveSpacing()),

          // Resumo de valores
          ModernCard(
            padding: EdgeInsets.all(context.responsiveSpacing(base: 18)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Resumo do Caixa',
                  style: TextStyle(
                    fontSize: context.responsiveFontSize(17),
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                SizedBox(height: context.responsiveSpacing(base: 16)),
                DetailRow(
                  label: 'Valor de Abertura',
                  value: CurrencyHelper.format(openingCash),
                  valueColor: AppTheme.infoColor,
                ),
                Divider(height: 1, color: Colors.grey.shade100),
                DetailRow(
                  label: 'Vendas em Dinheiro',
                  value: CurrencyHelper.format(totalCash),
                  valueColor: AppTheme.successColor,
                ),
                DetailRow(
                  label: 'Vendas em Cartão',
                  value: CurrencyHelper.format(totalCard),
                  valueColor: Colors.purple,
                ),
                DetailRow(
                  label: 'Mobile Money',
                  value: CurrencyHelper.format(totalMobileMoney),
                  valueColor: Colors.orange,
                ),
                DetailRow(
                  label: 'Vendas a Prazo',
                  value: CurrencyHelper.format(totalDebt),
                  valueColor: AppTheme.errorColor,
                ),
                Divider(height: 1, color: Colors.grey.shade100),
                DetailRow(
                  label: 'Total de Vendas',
                  value: CurrencyHelper.format(totalSales),
                  valueFontWeight: FontWeight.bold,
                ),
                SizedBox(height: context.responsiveSpacing(base: 12)),
                Container(
                  padding: EdgeInsets.all(context.responsiveSpacing(base: 14)),
                  decoration: BoxDecoration(
                    color: AppTheme.infoLight,
                    borderRadius: AppTheme.borderRadiusMedium,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          'Dinheiro Esperado',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: context.responsiveFontSize(14),
                            color: AppTheme.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        CurrencyHelper.format(expectedCash),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: context.responsiveFontSize(16),
                          color: AppTheme.infoColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: context.responsiveSpacing(base: 24)),

          // Botão fechar caixa
          GradientButton(
            text: 'Fechar Caixa',
            icon: Icons.lock_rounded,
            gradient: const LinearGradient(
              colors: [Color(0xFFEF5350), Color(0xFFD32F2F)],
            ),
            onPressed: () => _showCloseCashBoxDialog(cashBox, expectedCash),
          ),
          SizedBox(height: context.responsiveSpacing(base: 20)),
        ],
      ),
    );
  }

  Future<void> _openCashBox(CashBoxProvider cashBox) async {
    final auth = context.read<AuthProvider>();
    final openingCash = int.tryParse(_openingCashController.text) ?? 0;

    final success = await cashBox.openCashBox(
      boxNumber:
          'CX${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}',
      branchId: auth.branchId ?? '',
      openedBy: auth.userId ?? '',
      openingCash: openingCash,
    );

    if (!mounted) return;

    if (success) {
      _openingCashController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Caixa aberto com sucesso!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (cashBox.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(cashBox.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _showCloseCashBoxDialog(
      CashBoxProvider cashBox, int expectedCash) async {
    _closingCashController.text = expectedCash.toString();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Fechar Caixa'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Valor esperado: ${CurrencyHelper.format(expectedCash)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _closingCashController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Valor em Caixa (FCFA)',
                prefixIcon: Icon(Icons.monetization_on_outlined),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _notesController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Observações (opcional)',
                prefixIcon: Icon(Icons.notes),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Fechar Caixa'),
          ),
        ],
      ),
    );

    if (result != true) return;

    final auth = context.read<AuthProvider>();
    final closingCash = int.tryParse(_closingCashController.text) ?? 0;

    final success = await cashBox.closeCashBox(
      closingCash: closingCash,
      closedBy: auth.userId ?? '',
      notes: _notesController.text.isEmpty ? null : _notesController.text,
    );

    if (!mounted) return;

    if (success) {
      _closingCashController.clear();
      _notesController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Caixa fechado com sucesso!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (cashBox.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(cashBox.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}
