import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../utils/currency_helper.dart';
import '../providers/cash_box_provider.dart';

class CashBoxHistoryScreen extends StatefulWidget {
  const CashBoxHistoryScreen({super.key});

  @override
  State<CashBoxHistoryScreen> createState() => _CashBoxHistoryScreenState();
}

class _CashBoxHistoryScreenState extends State<CashBoxHistoryScreen> {
  final _dateFormat = DateFormat('dd/MM/yyyy');
  final _timeFormat = DateFormat('HH:mm');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CashBoxProvider>().loadHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<CashBoxProvider>(
      builder: (context, cashBox, _) {
        if (cashBox.isLoading && cashBox.history.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (cashBox.history.isEmpty) {
          return _buildEmptyState();
        }

        return RefreshIndicator(
          onRefresh: () => cashBox.loadHistory(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: cashBox.history.length,
            itemBuilder: (context, index) {
              final item = cashBox.history[index];
              return _buildHistoryCard(item);
            },
          ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.history,
            size: 80,
            color: Colors.grey[300],
          ),
          const SizedBox(height: 16),
          Text(
            'Nenhum histórico',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'O histórico de caixas fechados aparecerá aqui',
            style: TextStyle(
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryCard(Map<String, dynamic> item) {
    final boxNumber = item['box_number'] ?? item['boxNumber'] ?? '-';
    final openingCash = item['opening_cash'] ?? item['openingCash'] ?? 0;
    // Ler de stats se existir, ou diretamente do objeto
    final stats = item['stats'] as Map<String, dynamic>? ?? {};
    final totalSales = item['total_sales'] ?? item['totalSales'] ?? stats['totalSales'] ?? 0;
    final closingCash = item['closing_cash'] ?? item['closingCash'] ?? 0;
    final difference = item['difference'] ?? 0;
    final notes = item['notes'];

    String openedAt = '-';
    String closedAt = '-';
    String duration = '-';

    try {
      final openedAtStr = item['opened_at'] ?? item['openedAt'];
      final closedAtStr = item['closed_at'] ?? item['closedAt'];

      if (openedAtStr != null) {
        final openDate = DateTime.parse(openedAtStr);
        openedAt =
            '${_dateFormat.format(openDate)} ${_timeFormat.format(openDate)}';

        if (closedAtStr != null) {
          final closeDate = DateTime.parse(closedAtStr);
          closedAt =
              '${_dateFormat.format(closeDate)} ${_timeFormat.format(closeDate)}';

          final diff = closeDate.difference(openDate);
          if (diff.inHours > 0) {
            duration = '${diff.inHours}h ${diff.inMinutes % 60}min';
          } else {
            duration = '${diff.inMinutes}min';
          }
        }
      }
    } catch (_) {}

    final differenceColor = difference == 0
        ? Colors.green
        : difference > 0
            ? Colors.blue
            : Colors.red;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.blue.shade100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(
            Icons.receipt_long,
            color: Colors.blue,
          ),
        ),
        title: Text(
          'Caixa $boxNumber',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              closedAt,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  'Total: ${CurrencyHelper.format(totalSales)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w500,
                    color: Colors.green,
                  ),
                ),
                const SizedBox(width: 16),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: differenceColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    difference == 0
                        ? 'Exato'
                        : difference > 0
                            ? '+${CurrencyHelper.format(difference)}'
                            : CurrencyHelper.format(difference),
                    style: TextStyle(
                      color: differenceColor,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildDetailRow('Aberto em', openedAt),
                _buildDetailRow('Fechado em', closedAt),
                _buildDetailRow('Duração', duration),
                const Divider(),
                _buildDetailRow('Abertura', CurrencyHelper.format(openingCash)),
                _buildDetailRow(
                  'Vendas em Dinheiro',
                  CurrencyHelper.format(
                      item['total_cash'] ?? item['totalCash'] ?? 0),
                ),
                _buildDetailRow(
                  'Vendas em Cartão',
                  CurrencyHelper.format(
                      item['total_card'] ?? item['totalCard'] ?? 0),
                ),
                _buildDetailRow(
                  'Mobile Money',
                  CurrencyHelper.format(item['total_mobile_money'] ??
                      item['totalMobileMoney'] ??
                      0),
                ),
                _buildDetailRow(
                  'Vendas a Prazo',
                  CurrencyHelper.format(
                      item['total_debt'] ?? item['totalDebt'] ?? 0),
                ),
                const Divider(),
                _buildDetailRow(
                  'Total de Vendas',
                  CurrencyHelper.format(totalSales),
                  valueStyle: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
                _buildDetailRow(
                  'Valor no Fechamento',
                  CurrencyHelper.format(closingCash),
                ),
                _buildDetailRow(
                  'Diferença',
                  difference == 0
                      ? 'FCFA 0 (Exato)'
                      : CurrencyHelper.format(difference),
                  valueStyle: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: differenceColor,
                  ),
                ),
                if (notes != null && notes.toString().isNotEmpty) ...[
                  const Divider(),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Observações:',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 12,
                      ),
                    ),
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
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {TextStyle? valueStyle}) {
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
            style: valueStyle ?? const TextStyle(fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
