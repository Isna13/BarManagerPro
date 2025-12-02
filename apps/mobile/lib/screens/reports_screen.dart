import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../providers/auth_provider.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late ApiService _apiService;
  final _currencyFormat =
      NumberFormat.currency(symbol: 'XOF ', decimalDigits: 0);

  bool _isLoading = true;
  String _selectedPeriod = 'today';

  // Data
  Map<String, dynamic> _salesReport = {};
  Map<String, dynamic> _cashFlowReport = {};
  List<dynamic> _topProducts = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _apiService = Provider.of<AuthProvider>(context, listen: false).apiService;
      _loadReports();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadReports() async {
    setState(() => _isLoading = true);

    try {
      final now = DateTime.now();
      DateTime startDate;
      DateTime endDate = now;

      switch (_selectedPeriod) {
        case 'today':
          startDate = DateTime(now.year, now.month, now.day);
          break;
        case 'week':
          startDate = now.subtract(const Duration(days: 7));
          break;
        case 'month':
          startDate = DateTime(now.year, now.month, 1);
          break;
        default:
          startDate = DateTime(now.year, now.month, now.day);
      }

      // Load reports
      final sales = await _apiService.getSalesReport(
        startDate: startDate,
        endDate: endDate,
      );
      final cashFlow = await _apiService.getCashFlowReport(
        startDate: startDate,
        endDate: endDate,
      );
      final topProds = await _apiService.getTopProducts(limit: 10);

      setState(() {
        _salesReport = sales;
        _cashFlowReport = cashFlow;
        _topProducts = topProds;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao carregar relatórios: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Relatórios'),
        backgroundColor: Colors.indigo.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadReports,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'Faturamento'),
            Tab(text: 'Fluxo Caixa'),
            Tab(text: 'Top Produtos'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Period Selector
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.grey.shade100,
            child: Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'today', label: Text('Hoje')),
                      ButtonSegment(value: 'week', label: Text('Semana')),
                      ButtonSegment(value: 'month', label: Text('Mês')),
                    ],
                    selected: {_selectedPeriod},
                    onSelectionChanged: (Set<String> newSelection) {
                      setState(() => _selectedPeriod = newSelection.first);
                      _loadReports();
                    },
                  ),
                ),
              ],
            ),
          ),
          // Content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildRevenueTab(),
                      _buildCashFlowTab(),
                      _buildTopProductsTab(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildRevenueTab() {
    final totalRevenue = _salesReport['totalRevenue'] ?? 0;
    final totalCost = _salesReport['totalCost'] ?? 0;
    final profit = totalRevenue - totalCost;
    final margin = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0;
    final salesCount = _salesReport['salesCount'] ?? 0;
    final avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Revenue Card
          Card(
            elevation: 4,
            color: Colors.green.shade50,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.attach_money,
                          color: Colors.green.shade700, size: 32),
                      const SizedBox(width: 12),
                      const Text(
                        'Faturamento Total',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _currencyFormat.format(totalRevenue),
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.green.shade700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$salesCount vendas realizadas',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Profit & Margin
          Row(
            children: [
              Expanded(
                child: Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.trending_up,
                                color: Colors.blue.shade700, size: 20),
                            const SizedBox(width: 8),
                            const Text('Lucro', style: TextStyle(fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _currencyFormat.format(profit),
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: profit >= 0 ? Colors.green : Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.percent,
                                color: Colors.orange.shade700, size: 20),
                            const SizedBox(width: 8),
                            const Text('Margem',
                                style: TextStyle(fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${margin.toStringAsFixed(1)}%',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.orange.shade700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Additional Metrics
          Card(
            child: Column(
              children: [
                ListTile(
                  leading:
                      Icon(Icons.shopping_cart, color: Colors.blue.shade700),
                  title: const Text('Ticket Médio'),
                  trailing: Text(
                    _currencyFormat.format(avgTicket),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.money_off, color: Colors.red.shade700),
                  title: const Text('Custo Total'),
                  trailing: Text(
                    _currencyFormat.format(totalCost),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCashFlowTab() {
    final totalIn = _cashFlowReport['totalIn'] ?? 0;
    final totalOut = _cashFlowReport['totalOut'] ?? 0;
    final balance = totalIn - totalOut;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Balance Card
          Card(
            elevation: 4,
            color: balance >= 0 ? Colors.green.shade50 : Colors.red.shade50,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text(
                    'Saldo do Período',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade700),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _currencyFormat.format(balance),
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: balance >= 0
                          ? Colors.green.shade700
                          : Colors.red.shade700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Inflows & Outflows
          Row(
            children: [
              Expanded(
                child: Card(
                  color: Colors.green.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Icon(Icons.arrow_downward,
                            color: Colors.green.shade700, size: 32),
                        const SizedBox(height: 8),
                        const Text('Entradas', style: TextStyle(fontSize: 14)),
                        const SizedBox(height: 4),
                        Text(
                          _currencyFormat.format(totalIn),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Card(
                  color: Colors.red.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Icon(Icons.arrow_upward,
                            color: Colors.red.shade700, size: 32),
                        const SizedBox(height: 8),
                        const Text('Saídas', style: TextStyle(fontSize: 14)),
                        const SizedBox(height: 4),
                        Text(
                          _currencyFormat.format(totalOut),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.red.shade700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTopProductsTab() {
    if (_topProducts.isEmpty) {
      return const Center(
        child: Text('Nenhum produto vendido no período'),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _topProducts.length,
      itemBuilder: (context, index) {
        final product = _topProducts[index];
        final name = product['name'] ?? 'Produto';
        final quantity = product['quantity'] ?? 0;
        final revenue = product['revenue'] ?? 0;
        final position = index + 1;

        Color medalColor = Colors.grey;
        if (position == 1)
          medalColor = Colors.amber;
        else if (position == 2)
          medalColor = Colors.grey.shade400;
        else if (position == 3) medalColor = Colors.brown.shade300;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: medalColor,
              child: Text(
                '$position',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            title: Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            subtitle: Text('$quantity unidades vendidas'),
            trailing: Text(
              _currencyFormat.format(revenue),
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ),
        );
      },
    );
  }
}
