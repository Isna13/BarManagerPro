import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../widgets/common_widgets.dart';

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
  final currencyFormat = NumberFormat.currency(
    locale: 'fr_FR',
    symbol: 'FCFA ',
    decimalDigits: 0,
  );
  final dateFormat = DateFormat('dd/MM/yyyy');
  final timeFormat = DateFormat('HH:mm');
  
  CashBoxDetails? _details;
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
      final apiService = ApiService();
      await apiService.loadToken();
      final details = await apiService.getCashBoxDetails(widget.cashBoxId);
      
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
      return const LoadingIndicator();
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
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
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
      return const EmptyState(
        icon: Icons.receipt_long,
        title: 'Detalhes não encontrados',
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
  
  Widget _buildCashBoxInfoCard() {
    final details = _details!;
    
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
                    color: details.status == 'open'
                        ? Colors.green.withOpacity(0.1)
                        : Colors.grey.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    details.status == 'open' ? Icons.lock_open : Icons.lock,
                    color: details.status == 'open' ? Colors.green : Colors.grey,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Caixa ${details.boxNumber}',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (details.openedBy != null)
                        Text(
                          'Operador: ${details.openedBy}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
                StatusBadge(
                  label: details.status == 'open' ? 'Aberto' : 'Fechado',
                  type: details.status == 'open'
                      ? StatusType.success
                      : StatusType.neutral,
                ),
              ],
            ),
            const Divider(height: 24),
            _buildInfoRow('Abertura', '${dateFormat.format(details.openedAt)} ${timeFormat.format(details.openedAt)}'),
            if (details.closedAt != null)
              _buildInfoRow('Fechamento', '${dateFormat.format(details.closedAt!)} ${timeFormat.format(details.closedAt!)}'),
            _buildInfoRow('Duração', details.duration),
            _buildInfoRow('Vendas', '${details.salesCount} ${details.salesCount == 1 ? 'venda' : 'vendas'}'),
            const Divider(height: 16),
            _buildInfoRow('Valor Inicial', currencyFormat.format(details.openingCash)),
            if (details.closingCash != null)
              _buildInfoRow('Valor no Fechamento', currencyFormat.format(details.closingCash!)),
            if (details.difference != null)
              _buildInfoRow(
                'Diferença',
                details.difference == 0
                    ? 'Exato'
                    : currencyFormat.format(details.difference!),
                valueColor: details.difference == 0
                    ? Colors.green
                    : details.difference! > 0
                        ? Colors.blue
                        : Colors.red,
              ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildProfitMetricsCards() {
    final metrics = _details!.profitMetrics;
    
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
                value: currencyFormat.format(metrics.totalRevenue),
                color: Colors.blue,
                icon: Icons.attach_money,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                title: 'Reposição (Custo)',
                value: currencyFormat.format(metrics.totalCOGS),
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
                value: currencyFormat.format(metrics.grossProfit),
                subtitle: 'Margem: ${metrics.profitMargin.toStringAsFixed(1)}%',
                color: Colors.green,
                icon: Icons.trending_up,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                title: 'Lucro Líquido',
                value: currencyFormat.format(metrics.netProfit),
                subtitle: 'Margem: ${metrics.netMargin.toStringAsFixed(1)}%',
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
          value: currencyFormat.format(_details!.totalDebt),
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
    final details = _details!;
    
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
              value: currencyFormat.format(details.totalCash),
              color: Colors.green,
            ),
            _buildPaymentRow(
              label: '📱 Orange & TeleTaku',
              value: currencyFormat.format(details.totalMobileMoney),
              color: Colors.purple,
            ),
            _buildPaymentRow(
              label: '💳 Cartão/Misto',
              value: currencyFormat.format(details.totalCard),
              color: Colors.blue,
            ),
            _buildPaymentRow(
              label: '📋 Vale (Fiado)',
              value: currencyFormat.format(details.totalDebt),
              color: Colors.amber.shade700,
            ),
            const Divider(height: 16),
            _buildPaymentRow(
              label: 'TOTAL',
              value: currencyFormat.format(details.totalSales),
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
    final items = _details!.profitMetrics.salesItems;
    
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
        ...items.map((item) => _buildProductCard(item)).toList(),
        
        // Totais da lista
        const SizedBox(height: 12),
        _buildTotalsCard(),
      ],
    );
  }
  
  Widget _buildProductCard(SalesItemDetail item) {
    final hasNoCost = item.cost == 0;
    
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
                    item.productName,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                if (hasNoCost)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                    '${item.qtySold}',
                    Colors.grey,
                  ),
                ),
                Expanded(
                  child: _buildProductStat(
                    'Venda',
                    currencyFormat.format(item.revenue),
                    Colors.blue,
                  ),
                ),
                Expanded(
                  child: _buildProductStat(
                    'Custo',
                    currencyFormat.format(item.cost),
                    Colors.orange,
                  ),
                ),
                Expanded(
                  child: _buildProductStat(
                    'Lucro',
                    currencyFormat.format(item.profit),
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
    final metrics = _details!.profitMetrics;
    final totalQty = metrics.salesItems.fold<int>(0, (sum, item) => sum + item.qtySold);
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.primaryColor.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.primaryColor.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Text(
            'TOTAIS',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: AppTheme.primaryColor,
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
                  currencyFormat.format(metrics.totalRevenue),
                  Colors.blue,
                ),
              ),
              Expanded(
                child: _buildTotalStat(
                  'Custo',
                  currencyFormat.format(metrics.totalCOGS),
                  Colors.orange,
                ),
              ),
              Expanded(
                child: _buildTotalStat(
                  'Lucro',
                  currencyFormat.format(metrics.grossProfit),
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
