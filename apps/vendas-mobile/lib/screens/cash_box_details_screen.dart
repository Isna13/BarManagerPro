import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/currency_helper.dart';

/// 🎯 Tela de Detalhes do Caixa - PARIDADE COM ELECTRON
///
/// Esta tela exibe EXATAMENTE os mesmos dados que o Electron mostra
/// na aba "Histórico de Caixa → Detalhes do Caixa Fechado":
///
/// ✅ Lista de produtos vendidos com quantidade
/// ✅ Total em dinheiro por produto (receita)
/// ✅ Valor de reposição (custo)
/// ✅ Lucro bruto por produto
/// ✅ Totais consolidados:
///    - Valor total da venda
///    - Valor da reposição
///    - Lucro bruto
///    - Lucro líquido
///    - Margem (%)
///    - Vales (crédito)
///
/// 📌 IMPORTANTE: Todos os dados vêm do servidor Railway
/// 📌 O app NÃO recalcula valores - apenas exibe
class CashBoxDetailsScreen extends StatefulWidget {
  final String cashBoxId;
  final String? boxNumber;

  const CashBoxDetailsScreen({
    super.key,
    required this.cashBoxId,
    this.boxNumber,
  });

  @override
  State<CashBoxDetailsScreen> createState() => _CashBoxDetailsScreenState();
}

class _CashBoxDetailsScreenState extends State<CashBoxDetailsScreen> {
  final _dateFormat = DateFormat('dd/MM/yyyy');
  final _timeFormat = DateFormat('HH:mm');

  Map<String, dynamic>? _details;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final details =
          await ApiService.instance.getCashBoxDetails(widget.cashBoxId);

      setState(() {
        _details = details;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Caixa ${widget.boxNumber ?? ''}'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDetails,
            tooltip: 'Atualizar',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(
              'Erro ao carregar detalhes',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _error!,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadDetails,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      );
    }

    if (_details == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'Detalhes não encontrados',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDetails,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Informações do caixa
            _buildCashBoxInfoCard(),
            const SizedBox(height: 16),

            // Cards de resumo (métricas de lucro)
            _buildProfitMetricsCards(),
            const SizedBox(height: 16),

            // Métodos de pagamento
            _buildPaymentMethodsCard(),
            const SizedBox(height: 16),

            // Lista de produtos vendidos
            _buildSalesItemsList(),
          ],
        ),
      ),
    );
  }

  // Helper para obter valor numérico em reais (dividir por 100)
  double _getValue(dynamic value) {
    if (value == null) return 0;
    return (value is num ? value.toDouble() : 0) / 100;
  }

  // Helper para obter valor inteiro
  int _getInt(dynamic value) {
    if (value == null) return 0;
    return value is int ? value : (value as num).toInt();
  }

  // Helper para formatar duração
  String _getDuration() {
    final openedAtStr = _details!['openedAt'] ?? _details!['opened_at'];
    final closedAtStr = _details!['closedAt'] ?? _details!['closed_at'];

    if (openedAtStr == null) return 'N/A';

    final openedAt = DateTime.tryParse(openedAtStr.toString());
    if (openedAt == null) return 'N/A';

    if (closedAtStr == null) return 'Aberto';

    final closedAt = DateTime.tryParse(closedAtStr.toString());
    if (closedAt == null) return 'Aberto';

    final diff = closedAt.difference(openedAt);
    if (diff.inHours > 0) {
      return '${diff.inHours}h ${diff.inMinutes % 60}min';
    }
    return '${diff.inMinutes}min';
  }

  Widget _buildCashBoxInfoCard() {
    final boxNumber = _details!['boxNumber'] ?? _details!['box_number'] ?? '';
    final status = _details!['status'] ?? 'closed';
    final openedBy =
        _details!['openedBy'] ?? _details!['opened_by'] ?? 'Desconhecido';
    final openingCash =
        _getValue(_details!['openingCash'] ?? _details!['opening_cash']);
    final closingCash = _details!['closingCash'] ?? _details!['closing_cash'];
    final difference = _details!['difference'];
    final salesCount =
        _getInt(_details!['salesCount'] ?? _details!['sales_count']);
    final notes = _details!['notes'];

    String openedAt = '-';
    String closedAt = '-';

    try {
      final openedAtStr = _details!['openedAt'] ?? _details!['opened_at'];
      if (openedAtStr != null) {
        final date = DateTime.parse(openedAtStr);
        openedAt = '${_dateFormat.format(date)} ${_timeFormat.format(date)}';
      }

      final closedAtStr = _details!['closedAt'] ?? _details!['closed_at'];
      if (closedAtStr != null) {
        final date = DateTime.parse(closedAtStr);
        closedAt = '${_dateFormat.format(date)} ${_timeFormat.format(date)}';
      }
    } catch (_) {}

    final differenceValue = difference != null ? _getValue(difference) : null;
    final differenceColor = differenceValue == null
        ? Colors.grey
        : differenceValue == 0
            ? Colors.green
            : differenceValue > 0
                ? Colors.blue
                : Colors.red;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: status == 'open'
                        ? Colors.green.withOpacity(0.1)
                        : Colors.grey.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    status == 'open' ? Icons.lock_open : Icons.lock,
                    color: status == 'open' ? Colors.green : Colors.grey,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Caixa $boxNumber',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                      ),
                      Text(
                        'Operador: $openedBy',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: status == 'open' ? Colors.green : Colors.grey,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    status == 'open' ? 'Aberto' : 'Fechado',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _buildInfoRow('Abertura', openedAt),
            if (status != 'open') _buildInfoRow('Fechamento', closedAt),
            _buildInfoRow('Duração', _getDuration()),
            _buildInfoRow('Vendas',
                '$salesCount ${salesCount == 1 ? 'venda' : 'vendas'}'),
            const Divider(height: 16),
            _buildInfoRow('Valor Inicial', CurrencyHelper.format(openingCash)),
            if (closingCash != null)
              _buildInfoRow('Valor no Fechamento',
                  CurrencyHelper.format(_getValue(closingCash))),
            if (differenceValue != null)
              _buildInfoRow(
                'Diferença',
                differenceValue == 0
                    ? 'Exato'
                    : CurrencyHelper.format(differenceValue),
                valueColor: differenceColor,
              ),
            if (notes != null && notes.toString().isNotEmpty) ...[
              const Divider(height: 16),
              Text(
                'Observações:',
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(notes.toString()),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildProfitMetricsCards() {
    final profitMetrics =
        _details!['profitMetrics'] as Map<String, dynamic>? ?? {};

    final totalRevenue = _getValue(profitMetrics['totalRevenue']);
    final totalCOGS = _getValue(profitMetrics['totalCOGS']);
    final grossProfit = _getValue(profitMetrics['grossProfit']);
    final profitMargin = (profitMetrics['profitMargin'] ?? 0).toDouble();
    final netProfit = _getValue(profitMetrics['netProfit']);
    final netMargin = (profitMetrics['netMargin'] ?? 0).toDouble();
    final totalDebt =
        _getValue(_details!['totalDebt'] ?? _details!['total_debt']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Resumo Financeiro',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),

        // Primeira linha: Valor da Venda e Valor da Reposição
        Row(
          children: [
            Expanded(
              child: _buildMetricCard(
                title: 'Valor da Venda',
                value: CurrencyHelper.format(totalRevenue),
                color: Colors.blue,
                icon: Icons.attach_money,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                title: 'Reposição (Custo)',
                value: CurrencyHelper.format(totalCOGS),
                color: Colors.orange,
                icon: Icons.shopping_cart,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Segunda linha: Lucro Bruto e Lucro Líquido
        Row(
          children: [
            Expanded(
              child: _buildMetricCard(
                title: 'Lucro Bruto',
                value: CurrencyHelper.format(grossProfit),
                subtitle: 'Margem: ${profitMargin.toStringAsFixed(1)}%',
                color: Colors.green,
                icon: Icons.trending_up,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                title: 'Lucro Líquido',
                value: CurrencyHelper.format(netProfit),
                subtitle: 'Margem: ${netMargin.toStringAsFixed(1)}%',
                color: Colors.purple,
                icon: Icons.account_balance_wallet,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Terceira linha: Vales
        _buildMetricCard(
          title: 'Vales (Crédito)',
          value: CurrencyHelper.format(totalDebt),
          subtitle: 'A receber dos clientes',
          color: Colors.amber.shade700,
          icon: Icons.credit_card,
          fullWidth: true,
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    String? subtitle,
    required Color color,
    required IconData icon,
    bool fullWidth = false,
  }) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color.withOpacity(0.9),
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: color.withOpacity(0.7),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaymentMethodsCard() {
    final totalSales =
        _getValue(_details!['totalSales'] ?? _details!['total_sales']);
    final totalCash =
        _getValue(_details!['totalCash'] ?? _details!['total_cash']);
    final totalMobile = _getValue(
        _details!['totalMobileMoney'] ?? _details!['total_mobile_money']);
    final totalCard =
        _getValue(_details!['totalCard'] ?? _details!['total_card']);
    final totalDebt =
        _getValue(_details!['totalDebt'] ?? _details!['total_debt']);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Métodos de Pagamento',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 12),
            _buildPaymentRow(
              label: '💵 Dinheiro',
              value: CurrencyHelper.format(totalCash),
              color: Colors.green,
            ),
            _buildPaymentRow(
              label: '📱 Orange & TeleTaku',
              value: CurrencyHelper.format(totalMobile),
              color: Colors.purple,
            ),
            _buildPaymentRow(
              label: '💳 Cartão/Misto',
              value: CurrencyHelper.format(totalCard),
              color: Colors.blue,
            ),
            _buildPaymentRow(
              label: '📋 Vale (Fiado)',
              value: CurrencyHelper.format(totalDebt),
              color: Colors.amber.shade700,
            ),
            const Divider(height: 16),
            _buildPaymentRow(
              label: 'TOTAL',
              value: CurrencyHelper.format(totalSales),
              color: Colors.black,
              bold: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentRow({
    required String label,
    required String value,
    required Color color,
    bool bold = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesItemsList() {
    final profitMetrics =
        _details!['profitMetrics'] as Map<String, dynamic>? ?? {};
    final items = (profitMetrics['salesItems'] as List<dynamic>?) ?? [];

    if (items.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              children: [
                Icon(Icons.inventory_2, size: 48, color: Colors.grey[300]),
                const SizedBox(height: 12),
                Text(
                  'Nenhum produto vendido',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Produtos Vendidos',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            Text(
              '${items.length} ${items.length == 1 ? 'produto' : 'produtos'}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Lista de produtos
        ...items
            .map((item) => _buildProductCard(item as Map<String, dynamic>))
            .toList(),

        // Totais da lista
        const SizedBox(height: 12),
        _buildTotalsCard(),
      ],
    );
  }

  Widget _buildProductCard(Map<String, dynamic> item) {
    final productName =
        item['productName'] ?? item['product_name'] ?? 'Produto';
    final qtySold = _getInt(item['qtySold'] ?? item['qty_sold']);
    final revenue = _getValue(item['revenue']);
    final cost = _getValue(item['cost']);
    final profit = _getValue(item['profit']);
    final hasNoCost = cost == 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: hasNoCost ? Colors.yellow.shade50 : null,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    productName,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                if (hasNoCost)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.yellow.shade100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      '⚠️ Sem custo',
                      style: TextStyle(fontSize: 10, color: Colors.orange),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildProductStat(
                    'Qtd',
                    '$qtySold',
                    Colors.grey,
                  ),
                ),
                Expanded(
                  child: _buildProductStat(
                    'Venda',
                    CurrencyHelper.format(revenue),
                    Colors.blue,
                  ),
                ),
                Expanded(
                  child: _buildProductStat(
                    'Custo',
                    CurrencyHelper.format(cost),
                    Colors.orange,
                  ),
                ),
                Expanded(
                  child: _buildProductStat(
                    'Lucro',
                    CurrencyHelper.format(profit),
                    Colors.green,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey[600],
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildTotalsCard() {
    final profitMetrics =
        _details!['profitMetrics'] as Map<String, dynamic>? ?? {};
    final items = (profitMetrics['salesItems'] as List<dynamic>?) ?? [];
    final totalRevenue = _getValue(profitMetrics['totalRevenue']);
    final totalCOGS = _getValue(profitMetrics['totalCOGS']);
    final grossProfit = _getValue(profitMetrics['grossProfit']);

    int totalQty = 0;
    for (final item in items) {
      totalQty += _getInt(
          (item as Map<String, dynamic>)['qtySold'] ?? item['qty_sold']);
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade100),
      ),
      child: Column(
        children: [
          const Text(
            'TOTAIS',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.blue,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildTotalStat(
                  'Quantidade',
                  '$totalQty unid.',
                  Colors.grey,
                ),
              ),
              Expanded(
                child: _buildTotalStat(
                  'Vendas',
                  CurrencyHelper.format(totalRevenue),
                  Colors.blue,
                ),
              ),
              Expanded(
                child: _buildTotalStat(
                  'Custo',
                  CurrencyHelper.format(totalCOGS),
                  Colors.orange,
                ),
              ),
              Expanded(
                child: _buildTotalStat(
                  'Lucro',
                  CurrencyHelper.format(grossProfit),
                  Colors.green,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTotalStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: color,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.grey[600]),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
