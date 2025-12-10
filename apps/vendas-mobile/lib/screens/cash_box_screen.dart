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
    final stats = current['stats'] as Map<String, dynamic>? ?? {};
    
    // Valores do caixa
    final openingCash = current['opening_cash'] ?? current['openingCash'] ?? 0;
    
    // Totais por método de pagamento (ler de stats ou diretamente)
    final totalCash = current['total_cash'] ?? current['totalCash'] ?? stats['cashPayments'] ?? 0;
    final totalMobile = current['total_mobile_money'] ?? current['totalMobileMoney'] ?? stats['mobileMoneyPayments'] ?? 0;
    final totalMixed = current['total_card'] ?? current['totalCard'] ?? stats['cardPayments'] ?? 0;
    final totalDebt = current['total_debt'] ?? current['totalDebt'] ?? stats['debtPayments'] ?? 0;
    final totalSales = current['total_sales'] ?? current['totalSales'] ?? stats['totalSales'] ?? 0;
    final salesCount = stats['salesCount'] ?? current['sales_count'] ?? 0;
    
    // Dinheiro esperado = abertura + vendas em dinheiro
    final expectedCash = openingCash + totalCash;

    final openedAt = current['opened_at'] ?? current['openedAt'];
    String openedAtFormatted = '-';
    if (openedAt != null) {
      try {
        final date = DateTime.parse(openedAt);
        openedAtFormatted = DateFormat('dd/MM/yyyy, HH:mm').format(date);
      } catch (_) {}
    }

    final padding = context.horizontalPadding;

    return SingleChildScrollView(
      padding: EdgeInsets.all(padding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header com status do caixa (igual ao Electron)
          Container(
            padding: EdgeInsets.all(context.responsiveSpacing(base: 20)),
            decoration: BoxDecoration(
              gradient: AppTheme.successGradient,
              borderRadius: AppTheme.borderRadiusMedium,
              boxShadow: [
                BoxShadow(
                  color: AppTheme.successColor.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.lock_open_rounded, color: Colors.white, size: 28),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Caixa Aberto',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: context.responsiveFontSize(20),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            current['box_number'] ?? current['boxNumber'] ?? '-',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.9),
                              fontSize: context.responsiveFontSize(13),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Abertura',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: context.responsiveFontSize(11),
                          ),
                        ),
                        Text(
                          openedAtFormatted,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: context.responsiveFontSize(13),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Linha com Valor Inicial, Total de Vendas, Faturamento Total
                Row(
                  children: [
                    Expanded(
                      child: _buildHeaderStat('Valor Inicial', CurrencyHelper.format(openingCash), Colors.white),
                    ),
                    Container(width: 1, height: 40, color: Colors.white.withOpacity(0.3)),
                    Expanded(
                      child: _buildHeaderStat('Total de Vendas', '$salesCount venda${salesCount != 1 ? 's' : ''}', Colors.white, isBlue: true),
                    ),
                    Container(width: 1, height: 40, color: Colors.white.withOpacity(0.3)),
                    Expanded(
                      child: _buildHeaderStat('Faturamento Total', CurrencyHelper.format(totalSales), Colors.white, isGreen: true),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(height: context.responsiveSpacing(base: 20)),

          // Cards de métodos de pagamento (igual ao Electron)
          _buildPaymentMethodsGrid(
            totalCash: totalCash,
            totalMobile: totalMobile,
            totalMixed: totalMixed,
            totalDebt: totalDebt,
            totalSales: totalSales,
            expectedCash: expectedCash,
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

  Widget _buildHeaderStat(String label, String value, Color textColor, {bool isBlue = false, bool isGreen = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              color: textColor.withOpacity(0.8),
              fontSize: context.responsiveFontSize(11),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: isBlue ? const Color(0xFF2196F3) : (isGreen ? const Color(0xFF4CAF50) : textColor),
              fontSize: context.responsiveFontSize(14),
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodsGrid({
    required int totalCash,
    required int totalMobile,
    required int totalMixed,
    required int totalDebt,
    required int totalSales,
    required int expectedCash,
  }) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildPaymentCard(
                icon: Icons.attach_money_rounded,
                iconColor: Colors.green,
                iconBgColor: Colors.green.shade100,
                title: 'Dinheiro',
                value: totalCash,
                subtitle: 'Esperado: ${CurrencyHelper.format(expectedCash)}',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildPaymentCard(
                icon: Icons.smartphone_rounded,
                iconColor: Colors.purple,
                iconBgColor: Colors.purple.shade100,
                title: 'Orange & TeleTaku',
                value: totalMobile,
                subtitle: 'Mobile Money',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildPaymentCard(
                icon: Icons.credit_card_rounded,
                iconColor: Colors.blue,
                iconBgColor: Colors.blue.shade100,
                title: 'Misto',
                value: totalMixed,
                subtitle: 'Pagamento Combinado',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildPaymentCard(
                icon: Icons.receipt_long_rounded,
                iconColor: Colors.amber.shade700,
                iconBgColor: Colors.amber.shade100,
                title: 'Vale',
                value: totalDebt,
                subtitle: 'Crédito Concedido',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _buildPaymentCard(
          icon: Icons.trending_up_rounded,
          iconColor: Colors.orange,
          iconBgColor: Colors.orange.shade100,
          title: 'Total Geral',
          value: totalSales,
          isFullWidth: true,
        ),
      ],
    );
  }

  Widget _buildPaymentCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required int value,
    String? subtitle,
    bool isFullWidth = false,
  }) {
    return ModernCard(
      padding: EdgeInsets.all(context.responsiveSpacing(base: 16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconBgColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: context.responsiveFontSize(14),
                    color: AppTheme.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            CurrencyHelper.format(value),
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: context.responsiveFontSize(isFullWidth ? 22 : 18),
              color: iconColor,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: context.responsiveFontSize(11),
                color: AppTheme.textSecondary,
              ),
            ),
          ],
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
