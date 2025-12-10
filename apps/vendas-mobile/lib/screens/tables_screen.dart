import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/currency_helper.dart';
import '../providers/auth_provider.dart';
import '../providers/products_provider.dart';
import '../providers/tables_provider.dart';

class TablesScreen extends StatefulWidget {
  const TablesScreen({super.key});

  @override
  State<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends State<TablesScreen> {
  @override
  Widget build(BuildContext context) {
    return Consumer<TablesProvider>(
      builder: (context, tables, _) {
        if (tables.isLoading && tables.tables.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (tables.tables.isEmpty) {
          return _buildEmptyState();
        }

        return RefreshIndicator(
          onRefresh: () async {
            final auth = context.read<AuthProvider>();
            await tables.loadTables(branchId: auth.branchId);
          },
          child: GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: MediaQuery.of(context).size.width > 600 ? 4 : 2,
              childAspectRatio: 1,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: tables.tables.length,
            itemBuilder: (context, index) {
              return _buildTableCard(tables.tables[index], tables);
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
            Icons.table_restaurant,
            size: 80,
            color: Colors.grey[300],
          ),
          const SizedBox(height: 16),
          Text(
            'Nenhuma mesa cadastrada',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'As mesas serão sincronizadas do servidor',
            style: TextStyle(
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTableCard(Map<String, dynamic> table, TablesProvider tables) {
    final tableId = table['id'];
    final number = table['number'] ?? '-';
    final status = table['status'] ?? 'available';
    final currentSession = table['current_session'] ?? table['currentSession'];

    final isOccupied = status == 'occupied' || currentSession != null;
    final totalAmount =
        currentSession?['total_amount'] ?? currentSession?['totalAmount'] ?? 0;

    Color statusColor;
    IconData statusIcon;
    String statusText;

    switch (status) {
      case 'occupied':
        statusColor = Colors.red;
        statusIcon = Icons.people;
        statusText = 'Ocupada';
        break;
      case 'reserved':
        statusColor = Colors.orange;
        statusIcon = Icons.event;
        statusText = 'Reservada';
        break;
      default:
        statusColor = Colors.green;
        statusIcon = Icons.check_circle;
        statusText = 'Disponível';
    }

    return Card(
      elevation: isOccupied ? 4 : 1,
      color: isOccupied ? statusColor.withOpacity(0.1) : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: isOccupied
            ? BorderSide(color: statusColor, width: 2)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: () => _onTableTap(table, tables),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Número da mesa
              Text(
                'Mesa $number',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),

              // Ícone de status
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Icon(
                  statusIcon,
                  color: statusColor,
                  size: 28,
                ),
              ),
              const SizedBox(height: 8),

              // Status text
              Text(
                statusText,
                style: TextStyle(
                  color: statusColor,
                  fontWeight: FontWeight.w500,
                ),
              ),

              // Total (se ocupada)
              if (isOccupied && totalAmount > 0) ...[
                const SizedBox(height: 4),
                Text(
                  CurrencyHelper.format(totalAmount),
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _onTableTap(Map<String, dynamic> table, TablesProvider tables) {
    final status = table['status'] ?? 'available';
    final currentSession = table['current_session'] ?? table['currentSession'];

    if (currentSession != null) {
      // Mesa ocupada - abrir detalhes
      _showTableDetails(table, currentSession, tables);
    } else if (status == 'available') {
      // Mesa disponível - perguntar se quer abrir
      _showOpenTableDialog(table, tables);
    }
  }

  Future<void> _showOpenTableDialog(
      Map<String, dynamic> table, TablesProvider tables) async {
    final number = table['number'] ?? '-';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Abrir Mesa $number'),
        content: const Text('Deseja abrir esta mesa para atendimento?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Abrir Mesa'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final auth = context.read<AuthProvider>();

    final success = await tables.openTable(
      tableId: table['id'],
      branchId: auth.branchId ?? '',
      openedBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      // Recarregar mesas
      await tables.loadTables(branchId: auth.branchId);

      // Abrir detalhes da sessão
      final updatedTable = tables.tables.firstWhere(
        (t) => t['id'] == table['id'],
        orElse: () => table,
      );
      final session =
          updatedTable['current_session'] ?? updatedTable['currentSession'];
      if (session != null) {
        _showTableDetails(updatedTable, session, tables);
      }
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tables.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showTableDetails(Map<String, dynamic> table,
      Map<String, dynamic> session, TablesProvider tables) {
    final sessionId = session['id'];
    tables.loadSession(sessionId);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => TableSessionSheet(
          table: table,
          scrollController: scrollController,
        ),
      ),
    );
  }
}

class TableSessionSheet extends StatefulWidget {
  final Map<String, dynamic> table;
  final ScrollController scrollController;

  const TableSessionSheet({
    super.key,
    required this.table,
    required this.scrollController,
  });

  @override
  State<TableSessionSheet> createState() => _TableSessionSheetState();
}

class _TableSessionSheetState extends State<TableSessionSheet> {
  final _customerNameController = TextEditingController();
  String? _selectedCustomerId;

  @override
  void dispose() {
    _customerNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final number = widget.table['number'] ?? '-';

    return Consumer<TablesProvider>(
      builder: (context, tables, _) {
        final session = tables.currentSession;
        final customers = tables.currentCustomers;

        if (tables.isLoading && session == null) {
          return const Center(child: CircularProgressIndicator());
        }

        return Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.blue.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        number.toString(),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Mesa $number',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${customers.length} cliente(s)',
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  // Total
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(fontSize: 12),
                      ),
                      Text(
                        CurrencyHelper.format(session?['total_amount'] ??
                            session?['totalAmount'] ??
                            0),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const Divider(height: 1),

            // Lista de clientes
            Expanded(
              child: customers.isEmpty
                  ? _buildEmptyCustomers()
                  : ListView.builder(
                      controller: widget.scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: customers.length,
                      itemBuilder: (context, index) {
                        return _buildCustomerCard(customers[index], tables);
                      },
                    ),
            ),

            // Ações
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.grey.withOpacity(0.2),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showAddCustomerDialog(tables),
                      icon: const Icon(Icons.person_add),
                      label: const Text('Add Cliente'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: customers.isNotEmpty
                          ? () => _showPaymentOptions(tables)
                          : null,
                      icon: const Icon(Icons.payment),
                      label: const Text('Pagar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildEmptyCustomers() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 48,
            color: Colors.grey[400],
          ),
          const SizedBox(height: 16),
          Text(
            'Nenhum cliente na mesa',
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Adicione clientes para fazer pedidos',
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerCard(
      Map<String, dynamic> customer, TablesProvider tables) {
    final customerId = customer['id'];
    final customerName =
        customer['customer_name'] ?? customer['customerName'] ?? 'Cliente';
    final total = customer['total'] ?? 0;
    final paidAmount = customer['paid_amount'] ?? customer['paidAmount'] ?? 0;
    final paymentStatus =
        customer['payment_status'] ?? customer['paymentStatus'] ?? 'pending';
    final isPaid = paymentStatus == 'paid';

    final orders = tables.getOrdersForCustomer(customerId);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isPaid ? Colors.green.shade50 : null,
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: isPaid ? Colors.green : Colors.blue,
          child: Icon(
            isPaid ? Icons.check : Icons.person,
            color: Colors.white,
          ),
        ),
        title: Text(
          customerName,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Row(
          children: [
            Text(
              CurrencyHelper.format(total),
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isPaid ? Colors.green : Colors.black87,
              ),
            ),
            if (isPaid) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.green,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '✓ Pago',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
        trailing: !isPaid
            ? IconButton(
                icon: const Icon(Icons.add_shopping_cart),
                onPressed: () =>
                    _showAddOrderDialog(customerId, customerName, tables),
              )
            : null,
        children: [
          if (orders.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Nenhum pedido'),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final order = orders[index];
                final productName = order['product_name'] ?? 'Produto';
                final qty = order['qty_units'] ?? 1;
                final orderTotal = order['total'] ?? 0;
                final status = order['status'] ?? 'pending';
                final isOrderPaid = status == 'paid';

                return ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 16,
                    backgroundColor: isOrderPaid
                        ? Colors.green.shade100
                        : Colors.grey.shade100,
                    child: Text(
                      qty.toString(),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isOrderPaid ? Colors.green : Colors.grey[700],
                      ),
                    ),
                  ),
                  title: Text(
                    productName,
                    style: TextStyle(
                      decoration:
                          isOrderPaid ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  trailing: Text(
                    CurrencyHelper.format(orderTotal),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isOrderPaid ? Colors.green : Colors.black87,
                    ),
                  ),
                );
              },
            ),

          // Botão para pagar este cliente
          if (!isPaid && total > 0)
            Padding(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _showCustomerPaymentDialog(
                      customerId, total - paidAmount, tables),
                  icon: const Icon(Icons.payment),
                  label: Text(
                      'Pagar ${CurrencyHelper.format(total - paidAmount)}'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _showAddCustomerDialog(TablesProvider tables) async {
    _customerNameController.clear();

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Adicionar Cliente'),
        content: TextField(
          controller: _customerNameController,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Nome do Cliente',
            prefixIcon: Icon(Icons.person),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              if (_customerNameController.text.isNotEmpty) {
                Navigator.pop(ctx, _customerNameController.text);
              }
            },
            child: const Text('Adicionar'),
          ),
        ],
      ),
    );

    if (result == null || result.isEmpty) return;

    final auth = context.read<AuthProvider>();
    final session = tables.currentSession;

    if (session == null) return;

    final success = await tables.addCustomer(
      sessionId: session['id'],
      customerName: result,
      addedBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (!success && tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tables.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _showAddOrderDialog(
      String customerId, String customerName, TablesProvider tables) async {
    final products = context.read<ProductsProvider>();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Adicionar Pedido - $customerName',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            Expanded(
              child: GridView.builder(
                controller: scrollController,
                padding: const EdgeInsets.all(12),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 0.85,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: products.filteredProducts.length,
                itemBuilder: (context, index) {
                  final product = products.filteredProducts[index];
                  final productId = product['id'];
                  final name = product['name'] ?? '';
                  final price =
                      product['price_unit'] ?? product['priceUnit'] ?? 0;
                  final stock = products.getProductStock(productId);

                  return Card(
                    child: InkWell(
                      onTap: stock > 0
                          ? () =>
                              _addOrderToCustomer(customerId, product, tables)
                          : null,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.local_drink,
                              size: 32,
                              color: stock > 0 ? Colors.blue : Colors.grey,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              name,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              CurrencyHelper.format(price),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.green,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addOrderToCustomer(String customerId,
      Map<String, dynamic> product, TablesProvider tables) async {
    final auth = context.read<AuthProvider>();
    final session = tables.currentSession;

    if (session == null) return;

    final success = await tables.addOrder(
      sessionId: session['id'],
      tableCustomerId: customerId,
      productId: product['id'],
      productName: product['name'] ?? '',
      quantity: 1,
      unitPrice: product['price_unit'] ?? product['priceUnit'] ?? 0,
      isMuntu: false,
      orderedBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${product['name']} adicionado!'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 1),
        ),
      );
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tables.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _showCustomerPaymentDialog(
      String customerId, int amount, TablesProvider tables) async {
    final method = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Forma de Pagamento'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Total: ${CurrencyHelper.format(amount)}',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _paymentButton(ctx, 'cash', 'Dinheiro', Icons.money),
                _paymentButton(ctx, 'card', 'Cartão', Icons.credit_card),
                _paymentButton(
                    ctx, 'mobile_money', 'Mobile Money', Icons.phone_android),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );

    if (method == null) return;

    final auth = context.read<AuthProvider>();
    final session = tables.currentSession;

    if (session == null) return;

    final success = await tables.processPayment(
      sessionId: session['id'],
      tableCustomerId: customerId,
      method: method,
      amount: amount,
      processedBy: auth.userId ?? '',
      isSessionPayment: false,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pagamento realizado!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tables.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Widget _paymentButton(
      BuildContext ctx, String value, String label, IconData icon) {
    return InkWell(
      onTap: () => Navigator.pop(ctx, value),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 100,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          border: Border.all(color: Colors.grey[300]!),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.grey[600]),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[700],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPaymentOptions(TablesProvider tables) {
    final pendingCustomers = tables.currentCustomers.where((c) {
      final status = c['payment_status'] ?? c['paymentStatus'] ?? 'pending';
      return status != 'paid';
    }).toList();

    if (pendingCustomers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Todos os clientes já foram pagos'),
          backgroundColor: Colors.green,
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Selecione quem pagar',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            ...pendingCustomers.map((customer) {
              final total = customer['total'] ?? 0;
              final paidAmount =
                  customer['paid_amount'] ?? customer['paidAmount'] ?? 0;
              final pending = total - paidAmount;

              return ListTile(
                leading: const CircleAvatar(
                  child: Icon(Icons.person),
                ),
                title: Text(customer['customer_name'] ??
                    customer['customerName'] ??
                    'Cliente'),
                subtitle: Text(CurrencyHelper.format(pending)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(context);
                  _showCustomerPaymentDialog(customer['id'], pending, tables);
                },
              );
            }),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
