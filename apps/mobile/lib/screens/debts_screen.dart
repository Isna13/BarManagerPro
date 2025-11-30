import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../providers/auth_provider.dart';

class DebtsScreen extends StatefulWidget {
  const DebtsScreen({super.key});

  @override
  State<DebtsScreen> createState() => _DebtsScreenState();
}

class _DebtsScreenState extends State<DebtsScreen> {
  late ApiService _apiService;
  final _currencyFormat =
      NumberFormat.currency(symbol: 'XOF ', decimalDigits: 0);
  final _dateFormat = DateFormat('dd/MM/yyyy');

  bool _isLoading = true;
  String _filterStatus = 'all'; // all, pending, overdue, paid

  List<dynamic> _debts = [];
  Map<String, dynamic> _summary = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _apiService = Provider.of<AuthProvider>(context, listen: false).apiService;
      _loadDebts();
    });
  }

  Future<void> _loadDebts() async {
    setState(() => _isLoading = true);

    try {
      final debts = await _apiService.getDebts(
          status: _filterStatus != 'all' ? _filterStatus : null);
      final summary = await _apiService.getDebtsSummary();

      setState(() {
        _debts = debts;
        _summary = summary;
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading debts: $e');
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao carregar dívidas: $e')),
        );
      }
    }
  }

  Future<void> _showPaymentDialog(Map<String, dynamic> debt) async {
    final amountController =
        TextEditingController(text: debt['remainingAmount'].toString());

    return showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Registrar Pagamento'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Cliente: ${debt['customer']['fullName']}'),
            const SizedBox(height: 16),
            TextField(
              controller: amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Valor do Pagamento',
                prefixText: 'XOF ',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountController.text) ?? 0;
              if (amount <= 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Valor inválido')),
                );
                return;
              }

              try {
                await _apiService.registerDebtPayment(debt['id'], amount);
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Pagamento registrado com sucesso')),
                  );
                  _loadDebts();
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Erro ao registrar pagamento: $e')),
                  );
                }
              }
            },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalPending = _summary['totalPending'] ?? 0;
    final totalOverdue = _summary['totalOverdue'] ?? 0;
    final overdueCount = _summary['overdueCount'] ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dívidas Pendentes'),
        backgroundColor: Colors.red.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDebts,
          ),
        ],
      ),
      body: Column(
        children: [
          // Summary Cards
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.grey.shade100,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Card(
                        color: Colors.orange.shade50,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.pending_actions,
                                      color: Colors.orange.shade700, size: 20),
                                  const SizedBox(width: 8),
                                  const Text('Total Pendente',
                                      style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _currencyFormat.format(totalPending),
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.orange.shade700,
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
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.error_outline,
                                      color: Colors.red.shade700, size: 20),
                                  const SizedBox(width: 8),
                                  const Text('Vencidas',
                                      style: TextStyle(fontSize: 12)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _currencyFormat.format(totalOverdue),
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red.shade700,
                                ),
                              ),
                              Text(
                                '$overdueCount dívidas',
                                style: TextStyle(
                                    fontSize: 10, color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('Todas'),
                        selected: _filterStatus == 'all',
                        onSelected: (_) {
                          setState(() => _filterStatus = 'all');
                          _loadDebts();
                        },
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Pendentes'),
                        selected: _filterStatus == 'pending',
                        onSelected: (_) {
                          setState(() => _filterStatus = 'pending');
                          _loadDebts();
                        },
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Vencidas'),
                        selected: _filterStatus == 'overdue',
                        onSelected: (_) {
                          setState(() => _filterStatus = 'overdue');
                          _loadDebts();
                        },
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Pagas'),
                        selected: _filterStatus == 'paid',
                        onSelected: (_) {
                          setState(() => _filterStatus = 'paid');
                          _loadDebts();
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Debts List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _debts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_outline,
                                size: 64, color: Colors.grey.shade400),
                            const SizedBox(height: 16),
                            Text(
                              'Nenhuma dívida encontrada',
                              style: TextStyle(color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _debts.length,
                        itemBuilder: (context, index) =>
                            _buildDebtCard(_debts[index]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildDebtCard(Map<String, dynamic> debt) {
    final customer = debt['customer'] ?? {};
    final customerName = customer['fullName'] ?? 'Cliente';
    final amount = debt['amount'] ?? 0;
    final remainingAmount = debt['remainingAmount'] ?? 0;
    final dueDate =
        debt['dueDate'] != null ? DateTime.parse(debt['dueDate']) : null;
    final status = debt['status'] ?? 'pending';
    final isOverdue = status == 'overdue';

    Color statusColor = Colors.orange;
    IconData statusIcon = Icons.pending_actions;
    String statusText = 'Pendente';

    if (status == 'paid') {
      statusColor = Colors.green;
      statusIcon = Icons.check_circle;
      statusText = 'Paga';
    } else if (isOverdue) {
      statusColor = Colors.red;
      statusIcon = Icons.error;
      statusText = 'Vencida';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: isOverdue ? 4 : 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isOverdue
            ? BorderSide(color: Colors.red.shade200, width: 2)
            : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customerName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(statusIcon, size: 14, color: statusColor),
                          const SizedBox(width: 4),
                          Text(
                            statusText,
                            style: TextStyle(fontSize: 12, color: statusColor),
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
                      _currencyFormat.format(remainingAmount),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                      ),
                    ),
                    if (remainingAmount < amount)
                      Text(
                        'de ${_currencyFormat.format(amount)}',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (dueDate != null)
                  Row(
                    children: [
                      Icon(Icons.calendar_today,
                          size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(
                        'Vencimento: ${_dateFormat.format(dueDate)}',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                if (status == 'pending' || status == 'overdue')
                  TextButton.icon(
                    onPressed: () => _showPaymentDialog(debt),
                    icon: const Icon(Icons.payment, size: 16),
                    label: const Text('Registrar Pagamento'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.blue.shade700,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    super.dispose();
  }
}
