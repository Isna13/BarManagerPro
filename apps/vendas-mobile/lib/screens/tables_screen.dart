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

        return Scaffold(
          body: tables.tables.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: () async {
                    final auth = context.read<AuthProvider>();
                    await tables.loadTables(branchId: auth.branchId);
                  },
                  child: GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount:
                          MediaQuery.of(context).size.width > 600 ? 4 : 2,
                      childAspectRatio: 1,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: tables.tables.length,
                    itemBuilder: (context, index) {
                      return _buildTableCard(tables.tables[index], tables);
                    },
                  ),
                ),
          floatingActionButton: FloatingActionButton(
            onPressed: () => _showCreateTableDialog(tables),
            child: const Icon(Icons.add),
            tooltip: 'Criar nova mesa',
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

  /// Criar nova mesa
  Future<void> _showCreateTableDialog(TablesProvider tables) async {
    final numberController = TextEditingController();
    final seatsController = TextEditingController(text: '4');
    final areaController = TextEditingController();

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Criar Nova Mesa'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: numberController,
              decoration: const InputDecoration(
                labelText: 'Número da Mesa *',
                hintText: 'Ex: 01, A1, VIP1',
                prefixIcon: Icon(Icons.table_restaurant),
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: seatsController,
              decoration: const InputDecoration(
                labelText: 'Lugares',
                prefixIcon: Icon(Icons.people),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: areaController,
              decoration: const InputDecoration(
                labelText: 'Área (opcional)',
                hintText: 'Ex: Terraço, Interior, VIP',
                prefixIcon: Icon(Icons.location_on),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              if (numberController.text.isNotEmpty) {
                Navigator.pop(ctx, {
                  'number': numberController.text,
                  'seats': int.tryParse(seatsController.text) ?? 4,
                  'area': areaController.text.isNotEmpty
                      ? areaController.text
                      : null,
                });
              }
            },
            child: const Text('Criar'),
          ),
        ],
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.createTable(
      branchId: auth.branchId ?? '',
      number: result['number'],
      seats: result['seats'],
      area: result['area'],
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Mesa ${result['number']} criada com sucesso!'),
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
                  const SizedBox(width: 8),
                  // Botão fechar mesa
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.red),
                    onPressed: () => _closeTable(tables),
                    tooltip: 'Fechar mesa',
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
                  const SizedBox(width: 8),
                  // Menu de ações avançadas
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert),
                    tooltip: 'Mais opções',
                    onSelected: (value) => _handleAdvancedAction(value, tables),
                    itemBuilder: (ctx) => [
                      const PopupMenuItem(
                        value: 'transfer_table',
                        child: ListTile(
                          leading: Icon(Icons.swap_horiz, color: Colors.blue),
                          title: Text('Transferir Mesa'),
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'transfer_customers',
                        child: ListTile(
                          leading: Icon(Icons.people_alt, color: Colors.purple),
                          title: Text('Transferir Clientes'),
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'merge_tables',
                        child: ListTile(
                          leading: Icon(Icons.call_merge, color: Colors.teal),
                          title: Text('Unir com Outra Mesa'),
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        ),
                      ),
                      if (customers.length > 1)
                        const PopupMenuItem(
                          value: 'split_table',
                          child: ListTile(
                            leading:
                                Icon(Icons.call_split, color: Colors.orange),
                            title: Text('Separar Mesa'),
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                          ),
                        ),
                      const PopupMenuItem(
                        value: 'history',
                        child: ListTile(
                          leading: Icon(Icons.history, color: Colors.grey),
                          title: Text('Histórico'),
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        ),
                      ),
                    ],
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
                        : status == 'cancelled'
                            ? Colors.red.shade100
                            : Colors.grey.shade100,
                    child: Text(
                      qty.toString(),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isOrderPaid
                            ? Colors.green
                            : status == 'cancelled'
                                ? Colors.red
                                : Colors.grey[700],
                      ),
                    ),
                  ),
                  title: Text(
                    productName,
                    style: TextStyle(
                      decoration: isOrderPaid || status == 'cancelled'
                          ? TextDecoration.lineThrough
                          : null,
                      color: status == 'cancelled' ? Colors.red : null,
                    ),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        CurrencyHelper.format(orderTotal),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isOrderPaid
                              ? Colors.green
                              : status == 'cancelled'
                                  ? Colors.red
                                  : Colors.black87,
                        ),
                      ),
                      // Botão transferir item (só se houver mais de 1 cliente)
                      if (!isOrderPaid &&
                          status != 'cancelled' &&
                          tables.currentCustomers.length > 1)
                        IconButton(
                          icon: const Icon(Icons.swap_horiz,
                              color: Colors.blue, size: 20),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => _showTransferItemDialog(
                              order, customerId, tables),
                          tooltip: 'Transferir para outro cliente',
                        ),
                      // Botão cancelar pedido
                      if (!isOrderPaid && status != 'cancelled')
                        IconButton(
                          icon: const Icon(Icons.cancel,
                              color: Colors.red, size: 20),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => _cancelOrder(order, tables),
                          tooltip: 'Cancelar pedido',
                        ),
                    ],
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
                _paymentButton(
                    ctx, 'orange', 'Orange Money', Icons.phone_android),
                _paymentButton(
                    ctx, 'vale', 'Vale (Crédito)', Icons.credit_score),
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

    // Validação para Vale (crédito)
    if (method == 'vale') {
      // Buscar dados do cliente para verificar se é cadastrado
      final customer = tables.currentCustomers.firstWhere(
        (c) => c['id'] == customerId,
        orElse: () => {},
      );
      final registeredCustomerId =
          customer['customer_id'] ?? customer['customerId'];

      if (registeredCustomerId == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vale só disponível para clientes cadastrados!'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }

      // Carregar informações de crédito
      await tables.loadCustomerCredit(registeredCustomerId);
      final availableCredit = tables.getAvailableCredit(registeredCustomerId);

      if (amount > availableCredit) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Crédito insuficiente! Disponível: ${CurrencyHelper.format(availableCredit)}',
            ),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

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

  /// Transferir item para outro cliente
  Future<void> _showTransferItemDialog(Map<String, dynamic> order,
      String fromCustomerId, TablesProvider tables) async {
    final productName = order['product_name'] ?? 'Produto';
    final qty = order['qty_units'] ?? 1;

    // Filtrar clientes exceto o atual
    final otherCustomers = tables.currentCustomers
        .where((c) => c['id'] != fromCustomerId)
        .toList();

    if (otherCustomers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não há outros clientes para transferir'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    String? selectedCustomerId;
    int transferQty = qty;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Transferir Item'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Produto: $productName'),
              Text('Quantidade: $qty'),
              const SizedBox(height: 16),
              const Text('Transferir para:'),
              const SizedBox(height: 8),
              ...otherCustomers.map((c) => RadioListTile<String>(
                    title: Text(
                        c['customer_name'] ?? c['customerName'] ?? 'Cliente'),
                    value: c['id'],
                    groupValue: selectedCustomerId,
                    onChanged: (v) =>
                        setDialogState(() => selectedCustomerId = v),
                    dense: true,
                  )),
              if (qty > 1) ...[
                const SizedBox(height: 16),
                const Text('Quantidade a transferir:'),
                Slider(
                  value: transferQty.toDouble(),
                  min: 1,
                  max: qty.toDouble(),
                  divisions: qty - 1 > 0 ? qty - 1 : 1,
                  label: transferQty.toString(),
                  onChanged: (v) =>
                      setDialogState(() => transferQty = v.round()),
                ),
                Text('$transferQty de $qty'),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: selectedCustomerId != null
                  ? () => Navigator.pop(ctx, {
                        'toCustomerId': selectedCustomerId,
                        'qty': transferQty,
                      })
                  : null,
              child: const Text('Transferir'),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.transferOrder(
      orderId: order['id'],
      fromCustomerId: fromCustomerId,
      toCustomerId: result['toCustomerId'],
      qtyUnits: result['qty'],
      transferredBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Item transferido com sucesso!'),
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

  /// Criar nova mesa
  Future<void> _showCreateTableDialog(TablesProvider tables) async {
    final numberController = TextEditingController();
    final seatsController = TextEditingController(text: '4');
    final areaController = TextEditingController();

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Criar Nova Mesa'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: numberController,
              decoration: const InputDecoration(
                labelText: 'Número da Mesa *',
                hintText: 'Ex: 01, A1, VIP1',
                prefixIcon: Icon(Icons.table_restaurant),
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: seatsController,
              decoration: const InputDecoration(
                labelText: 'Lugares',
                prefixIcon: Icon(Icons.people),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: areaController,
              decoration: const InputDecoration(
                labelText: 'Área (opcional)',
                hintText: 'Ex: Terraço, Interior, VIP',
                prefixIcon: Icon(Icons.location_on),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              if (numberController.text.isNotEmpty) {
                Navigator.pop(ctx, {
                  'number': numberController.text,
                  'seats': int.tryParse(seatsController.text) ?? 4,
                  'area': areaController.text.isNotEmpty
                      ? areaController.text
                      : null,
                });
              }
            },
            child: const Text('Criar'),
          ),
        ],
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.createTable(
      branchId: auth.branchId ?? '',
      number: result['number'],
      seats: result['seats'],
      area: result['area'],
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Mesa ${result['number']} criada com sucesso!'),
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

  /// Cancelar pedido com confirmação
  Future<void> _cancelOrder(
      Map<String, dynamic> order, TablesProvider tables) async {
    final productName = order['product_name'] ?? 'Produto';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancelar Pedido'),
        content: Text(
          'Cancelar "$productName"?\n\nO estoque será restaurado automaticamente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Não'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sim, Cancelar'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.cancelOrder(
      orderId: order['id'],
      cancelledBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pedido cancelado! Estoque restaurado.'),
          backgroundColor: Colors.orange,
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

  /// Fechar mesa
  Future<void> _closeTable(TablesProvider tables) async {
    final session = tables.currentSession;
    if (session == null) return;

    final totalAmount = session['total_amount'] ?? session['totalAmount'] ?? 0;
    final paidAmount = session['paid_amount'] ?? session['paidAmount'] ?? 0;
    final pending = totalAmount - paidAmount;

    if (pending > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Há ${CurrencyHelper.format(pending)} pendente de pagamento!',
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Fechar Mesa'),
        content: const Text('Deseja fechar esta mesa?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Não'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sim, Fechar'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.closeTable(
      sessionId: session['id'],
      closedBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context); // Fechar bottom sheet
      await tables.loadTables(branchId: auth.branchId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mesa fechada com sucesso!'),
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

  /// Handler para ações avançadas do menu
  void _handleAdvancedAction(String action, TablesProvider tables) {
    switch (action) {
      case 'transfer_table':
        _showTransferTableDialog(tables);
        break;
      case 'transfer_customers':
        _showTransferCustomersDialog(tables);
        break;
      case 'merge_tables':
        _showMergeTablesDialog(tables);
        break;
      case 'split_table':
        _showSplitTableDialog(tables);
        break;
      case 'history':
        _showSessionHistory(tables);
        break;
    }
  }

  /// Transferir mesa completa para outra mesa
  Future<void> _showTransferTableDialog(TablesProvider tables) async {
    final session = tables.currentSession;
    if (session == null) return;

    // Mesas disponíveis (exceto a atual)
    final currentTableId = session['table_id'] ?? session['tableId'];
    final availableTables = tables.tables
        .where((t) =>
            t['id'] != currentTableId &&
            (t['status'] == 'available' || t['status'] == null))
        .toList();

    if (availableTables.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não há mesas disponíveis para transferência'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final selectedTable = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Transferir Mesa'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Todos os pedidos e clientes serão transferidos.'),
              const SizedBox(height: 16),
              const Text('Selecione a mesa de destino:'),
              const SizedBox(height: 8),
              ...availableTables.map((t) => ListTile(
                    leading: const Icon(Icons.table_restaurant),
                    title: Text('Mesa ${t['number']}'),
                    subtitle: Text(t['area'] ?? 'Sem área'),
                    onTap: () => Navigator.pop(ctx, t),
                    dense: true,
                  )),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );

    if (selectedTable == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.transferTable(
      sessionId: session['id'],
      toTableId: selectedTable['id'],
      transferredBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context); // Fechar bottom sheet
      await tables.loadTables(branchId: auth.branchId);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text('Mesa transferida para Mesa ${selectedTable['number']}!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tables.error!), backgroundColor: Colors.red),
      );
    }
  }

  /// Transferir clientes selecionados para outra mesa
  Future<void> _showTransferCustomersDialog(TablesProvider tables) async {
    final session = tables.currentSession;
    if (session == null) return;

    final customers = tables.currentCustomers;
    if (customers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não há clientes para transferir'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Mesas disponíveis ou ocupadas (exceto a atual)
    final currentTableId = session['table_id'] ?? session['tableId'];
    final otherTables =
        tables.tables.where((t) => t['id'] != currentTableId).toList();

    if (otherTables.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não há outras mesas disponíveis'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final selectedCustomerIds = <String>[];
    String? selectedTableId;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Transferir Clientes'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Selecione os clientes:'),
                  ...customers.map((c) {
                    final cId = c['id'];
                    final cName =
                        c['customer_name'] ?? c['customerName'] ?? 'Cliente';
                    return CheckboxListTile(
                      title: Text(cName),
                      value: selectedCustomerIds.contains(cId),
                      onChanged: (v) {
                        setDialogState(() {
                          if (v == true) {
                            selectedCustomerIds.add(cId);
                          } else {
                            selectedCustomerIds.remove(cId);
                          }
                        });
                      },
                      dense: true,
                    );
                  }),
                  const Divider(),
                  const Text('Mesa de destino:'),
                  ...otherTables.map((t) {
                    final isOccupied = t['status'] == 'occupied' ||
                        t['current_session'] != null ||
                        t['currentSession'] != null;
                    return RadioListTile<String>(
                      title: Text('Mesa ${t['number']}'),
                      subtitle:
                          Text(isOccupied ? 'Ocupada (unirá)' : 'Disponível'),
                      value: t['id'],
                      groupValue: selectedTableId,
                      onChanged: (v) =>
                          setDialogState(() => selectedTableId = v),
                      dense: true,
                    );
                  }),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed:
                  selectedCustomerIds.isNotEmpty && selectedTableId != null
                      ? () => Navigator.pop(ctx, {
                            'customerIds': selectedCustomerIds,
                            'tableId': selectedTableId,
                          })
                      : null,
              child: const Text('Transferir'),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.transferCustomers(
      sessionId: session['id'],
      customerIds: List<String>.from(result['customerIds']),
      toTableId: result['tableId'],
      transferredBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      // Se transferiu todos, fecha o sheet
      if (selectedCustomerIds.length == customers.length) {
        Navigator.pop(context);
      }
      await tables.loadTables(branchId: auth.branchId);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text('${selectedCustomerIds.length} cliente(s) transferido(s)!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tables.error!), backgroundColor: Colors.red),
      );
    }
  }

  /// Unir com outra mesa ocupada
  Future<void> _showMergeTablesDialog(TablesProvider tables) async {
    final session = tables.currentSession;
    if (session == null) return;

    final currentTableId = session['table_id'] ?? session['tableId'];

    // Outras mesas ocupadas
    final occupiedTables = tables.tables.where((t) {
      final tId = t['id'];
      final hasSession =
          t['current_session'] != null || t['currentSession'] != null;
      return tId != currentTableId && hasSession;
    }).toList();

    if (occupiedTables.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não há outras mesas ocupadas para unir'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Selecionar mesas para unir
    final selectedSessionIds = <String>[session['id']];
    String? targetTableId = currentTableId;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Unir Mesas'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Selecione as mesas para unir:'),
                  const SizedBox(height: 8),
                  ...occupiedTables.map((t) {
                    final tSession =
                        t['current_session'] ?? t['currentSession'];
                    final tSessionId = tSession?['id'];
                    if (tSessionId == null) return const SizedBox();

                    return CheckboxListTile(
                      title: Text('Mesa ${t['number']}'),
                      subtitle: Text(
                        'Total: ${CurrencyHelper.format(tSession['total_amount'] ?? tSession['totalAmount'] ?? 0)}',
                      ),
                      value: selectedSessionIds.contains(tSessionId),
                      onChanged: (v) {
                        setDialogState(() {
                          if (v == true) {
                            selectedSessionIds.add(tSessionId);
                          } else {
                            selectedSessionIds.remove(tSessionId);
                          }
                        });
                      },
                      dense: true,
                    );
                  }),
                  const Divider(),
                  const Text('Mesa de destino:'),
                  RadioListTile<String>(
                    title: Text('Mesa atual'),
                    value: currentTableId,
                    groupValue: targetTableId,
                    onChanged: (v) => setDialogState(() => targetTableId = v),
                    dense: true,
                  ),
                  ...occupiedTables.where((t) {
                    final tSession =
                        t['current_session'] ?? t['currentSession'];
                    return selectedSessionIds.contains(tSession?['id']);
                  }).map((t) => RadioListTile<String>(
                        title: Text('Mesa ${t['number']}'),
                        value: t['id'],
                        groupValue: targetTableId,
                        onChanged: (v) =>
                            setDialogState(() => targetTableId = v),
                        dense: true,
                      )),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: selectedSessionIds.length >= 2 && targetTableId != null
                  ? () => Navigator.pop(ctx, {
                        'sessionIds': selectedSessionIds,
                        'targetTableId': targetTableId,
                      })
                  : null,
              child: const Text('Unir'),
            ),
          ],
        ),
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.mergeTables(
      sessionIds: List<String>.from(result['sessionIds']),
      targetTableId: result['targetTableId'],
      mergedBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context);
      await tables.loadTables(branchId: auth.branchId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mesas unidas com sucesso!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tables.error!), backgroundColor: Colors.red),
      );
    }
  }

  /// Separar mesa (distribuir clientes em outras mesas)
  Future<void> _showSplitTableDialog(TablesProvider tables) async {
    final session = tables.currentSession;
    if (session == null) return;

    final customers = tables.currentCustomers;
    if (customers.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Precisa de pelo menos 2 clientes para separar'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final currentTableId = session['table_id'] ?? session['tableId'];
    final otherTables =
        tables.tables.where((t) => t['id'] != currentTableId).toList();

    if (otherTables.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não há outras mesas para separar'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Mapa: customerId -> tableId
    final distributions = <String, String?>{};
    for (final c in customers) {
      distributions[c['id']] = null;
    }

    final result = await showDialog<List<Map<String, dynamic>>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Separar Mesa'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Distribua os clientes em mesas diferentes:'),
                  const SizedBox(height: 12),
                  ...customers.map((c) {
                    final cId = c['id'];
                    final cName =
                        c['customer_name'] ?? c['customerName'] ?? 'Cliente';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(cName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          DropdownButton<String>(
                            isExpanded: true,
                            value: distributions[cId],
                            hint: const Text('Selecione a mesa'),
                            items:
                                otherTables.map<DropdownMenuItem<String>>((t) {
                              return DropdownMenuItem<String>(
                                value: t['id'] as String,
                                child: Text('Mesa ${t['number']}'),
                              );
                            }).toList(),
                            onChanged: (v) {
                              setDialogState(() => distributions[cId] = v);
                            },
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: distributions.values.every((v) => v != null)
                  ? () {
                      // Agrupar por tableId
                      final grouped = <String, List<String>>{};
                      distributions.forEach((cId, tId) {
                        if (tId != null) {
                          grouped.putIfAbsent(tId, () => []).add(cId);
                        }
                      });
                      final result = grouped.entries
                          .map(
                              (e) => {'tableId': e.key, 'customerIds': e.value})
                          .toList();
                      Navigator.pop(ctx, result);
                    }
                  : null,
              child: const Text('Confirmar'),
            ),
          ],
        ),
      ),
    );

    if (result == null || result.isEmpty) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.splitTable(
      sessionId: session['id'],
      distributions: result,
      splitBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context);
      await tables.loadTables(branchId: auth.branchId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mesa separada com sucesso!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (tables.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(tables.error!), backgroundColor: Colors.red),
      );
    }
  }

  /// Mostrar histórico de ações da sessão
  Future<void> _showSessionHistory(TablesProvider tables) async {
    final session = tables.currentSession;
    if (session == null) return;

    await tables.loadSessionHistory(session['id']);
    final history = tables.sessionHistory;

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (ctx, scrollController) => Column(
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
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Histórico da Sessão',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            Expanded(
              child: history.isEmpty
                  ? const Center(child: Text('Nenhum histórico disponível'))
                  : ListView.builder(
                      controller: scrollController,
                      itemCount: history.length,
                      itemBuilder: (ctx, index) {
                        final action = history[index];
                        final actionType =
                            action['action_type'] ?? action['actionType'] ?? '';
                        final description = action['description'] ?? '';
                        final performedAt = action['performed_at'] ??
                            action['performedAt'] ??
                            '';

                        IconData icon;
                        Color color;
                        switch (actionType) {
                          case 'open_table':
                            icon = Icons.login;
                            color = Colors.green;
                            break;
                          case 'add_customer':
                            icon = Icons.person_add;
                            color = Colors.blue;
                            break;
                          case 'add_order':
                            icon = Icons.add_shopping_cart;
                            color = Colors.orange;
                            break;
                          case 'cancel_order':
                            icon = Icons.remove_shopping_cart;
                            color = Colors.red;
                            break;
                          case 'payment':
                            icon = Icons.payment;
                            color = Colors.green;
                            break;
                          case 'transfer_item':
                            icon = Icons.swap_horiz;
                            color = Colors.purple;
                            break;
                          default:
                            icon = Icons.info;
                            color = Colors.grey;
                        }

                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: color.withOpacity(0.2),
                            child: Icon(icon, color: color, size: 20),
                          ),
                          title: Text(description),
                          subtitle: Text(_formatDateTime(performedAt)),
                          dense: true,
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDateTime(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr;
    }
  }
}
