import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/currency_helper.dart';
import '../providers/auth_provider.dart';
import '../providers/products_provider.dart';
import '../providers/tables_provider.dart';
import '../providers/customers_provider.dart';
import '../providers/cash_box_provider.dart';

class TablesScreen extends StatefulWidget {
  const TablesScreen({super.key});

  @override
  State<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends State<TablesScreen> {
  @override
  void initState() {
    super.initState();
    // Carregar mesas quando a tela é montada
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      context.read<TablesProvider>().loadTables(branchId: auth.branchId);
    });
  }

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

    // Calcular total pendente baseado em pedidos não pagos
    int pendingTotal = 0;
    if (currentSession != null) {
      final sessionId = currentSession['id'];
      for (final order in tables.currentOrders) {
        final orderSessionId = order['session_id'] ?? order['sessionId'];
        final orderStatus = order['status'] ?? 'pending';
        if (orderSessionId == sessionId &&
            orderStatus != 'paid' &&
            orderStatus != 'cancelled') {
          pendingTotal += (order['total'] as num? ?? 0).toInt();
        }
      }
    }

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
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Número da mesa
              Text(
                'Mesa $number',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),

              // Ícone de status
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(
                  statusIcon,
                  color: statusColor,
                  size: 24,
                ),
              ),
              const SizedBox(height: 6),

              // Status text
              Text(
                statusText,
                style: TextStyle(
                  color: statusColor,
                  fontWeight: FontWeight.w500,
                  fontSize: 13,
                ),
              ),

              // Total pendente (se ocupada)
              if (isOccupied) ...[
                const SizedBox(height: 2),
                Text(
                  CurrencyHelper.format(pendingTotal),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: pendingTotal > 0 ? Colors.green : Colors.grey,
                    fontSize: 12,
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

    // Usar branchId da mesa se disponível, senão do usuário, senão 'main-branch'
    final branchId = table['branch_id'] ??
        table['branchId'] ??
        auth.branchId ??
        'main-branch';
    debugPrint(
        '🍽️ Abrindo mesa: tableId=${table['id']}, branchId=$branchId, userId=${auth.userId}');

    final success = await tables.openTable(
      tableId: table['id'],
      branchId: branchId,
      openedBy: auth.userId ?? '',
    );

    if (!mounted) return;

    if (success) {
      // CORREÇÃO: Usar a sessão já criada pelo openTable() em vez de recarregar
      // Isso evita sobrescrever o estado local com dados incompletos do banco
      final session = tables.currentSession;
      if (session != null) {
        // Atualizar a mesa local com a sessão (já feito pelo openTable, mas garantir)
        final updatedTable = Map<String, dynamic>.from(table);
        updatedTable['status'] = 'occupied';
        updatedTable['current_session'] = session;
        // skipLoadSession: true porque acabamos de criar a sessão
        _showTableDetails(updatedTable, session, tables, skipLoadSession: true);
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
      Map<String, dynamic> session, TablesProvider tables,
      {bool skipLoadSession = false}) {
    final sessionId = session['id'];

    // CORREÇÃO: Só carrega do banco se necessário (sessão existente que não acabou de ser criada)
    // Isso evita sobrescrever clientes/pedidos recém-adicionados offline
    if (!skipLoadSession) {
      tables.loadSession(sessionId);
    }

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

  // 🔴 PROTEÇÃO: Flag para evitar cliques duplos no pagamento
  bool _isProcessingPayment = false;

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
                  // Total Pendente
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(fontSize: 12),
                      ),
                      Text(
                        CurrencyHelper.format(tables.sessionPendingTotal),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: tables.sessionPendingTotal > 0
                              ? Colors.green
                              : Colors.grey,
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

    final orders = tables.getOrdersForCustomer(customerId);

    // Calcular valor pendente baseado em pedidos não pagos (não no status do cliente)
    final pendingOrders = tables.getPendingOrdersForCustomer(customerId);
    int pendingTotal = 0;
    for (final order in pendingOrders) {
      pendingTotal += (order['total'] as num? ?? 0).toInt();
    }

    // Contar pedidos pagos (não cancelados)
    final paidOrders = orders.where((o) {
      final status = o['status'] ?? 'pending';
      return status == 'paid';
    }).toList();

    // isPaid só é true se TEM pedidos pagos E NÃO tem pedidos pendentes
    // (cliente sem pedidos NÃO é considerado "pago")
    final isPaid = paidOrders.isNotEmpty && pendingTotal <= 0;

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
        trailing: IconButton(
          icon: Icon(
            Icons.add_shopping_cart,
            color: isPaid ? Colors.grey : Colors.blue,
          ),
          onPressed: () =>
              _showAddOrderDialog(customerId, customerName, tables),
          tooltip: 'Adicionar pedido',
        ),
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
                final productName =
                    order['productName'] ?? order['product_name'] ?? 'Produto';
                final isMuntu = order['isMuntu'] == 1 ||
                    order['isMuntu'] == true ||
                    order['is_muntu'] == 1 ||
                    order['is_muntu'] == true;
                // Exibir qty_units (quantidade total em unidades)
                // Para Muntu: qty_units já é o total em unidades (ex: 9 = 3 Muntus × 3 unidades)
                // Suportar tanto camelCase (API) quanto snake_case (banco local)
                final qtyUnits = order['qtyUnits'] ?? order['qty_units'] ?? 1;
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
                            : isMuntu
                                ? Colors.purple.shade100
                                : Colors.grey.shade100,
                    child: Text(
                      qtyUnits.toString(),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isOrderPaid
                            ? Colors.green
                            : status == 'cancelled'
                                ? Colors.red
                                : isMuntu
                                    ? Colors.purple.shade700
                                    : Colors.grey[700],
                      ),
                    ),
                  ),
                  title: Text(
                    isMuntu ? '$productName (M)' : productName,
                    style: TextStyle(
                      decoration: isOrderPaid || status == 'cancelled'
                          ? TextDecoration.lineThrough
                          : null,
                      color: status == 'cancelled'
                          ? Colors.red
                          : isMuntu
                              ? Colors.purple.shade700
                              : null,
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

          // Botão para pagar este cliente (baseado em pedidos pendentes)
          if (pendingTotal > 0)
            Padding(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _showCustomerPaymentDialog(
                      customerId, pendingTotal, tables),
                  icon: const Icon(Icons.payment),
                  label: Text('Pagar ${CurrencyHelper.format(pendingTotal)}'),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _showAddCustomerDialog(TablesProvider tables) async {
    _customerNameController.clear();
    _selectedCustomerId = null;

    // Carregar clientes cadastrados
    final customersProvider = context.read<CustomersProvider>();
    await customersProvider.loadCustomers();

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _AddCustomerSheet(
        customersProvider: customersProvider,
        onSelectRegistered: (customer) {
          Navigator.pop(ctx, {
            'type': 'registered',
            'customerId': customer['id'],
            'customerName':
                customer['name'] ?? customer['fullName'] ?? 'Cliente',
          });
        },
        onAddManual: (name) {
          Navigator.pop(ctx, {
            'type': 'manual',
            'customerName': name,
          });
        },
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final session = tables.currentSession;

    if (session == null) return;

    final success = await tables.addCustomer(
      sessionId: session['id'],
      customerName: result['customerName'],
      customerId: result['type'] == 'registered' ? result['customerId'] : null,
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
      builder: (context) => _AddOrderSheet(
        customerId: customerId,
        customerName: customerName,
        tables: tables,
        products: products,
        onOrderAdded: () {
          // Fechar modal e mostrar confirmação
        },
      ),
    );
  }

  Future<void> _addOrderToCustomer(
      String customerId, Map<String, dynamic> product, TablesProvider tables,
      {bool isMuntu = false}) async {
    final auth = context.read<AuthProvider>();
    final productsProvider = context.read<ProductsProvider>();
    final session = tables.currentSession;

    if (session == null) return;

    final unitPrice = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final muntuQty = product['muntu_quantity'] ?? product['muntuQuantity'] ?? 0;
    final qtyUnits = isMuntu ? (muntuQty > 0 ? muntuQty : 1) : 1;

    final success = await tables.addOrder(
      sessionId: session['id'],
      tableCustomerId: customerId,
      productId: product['id'],
      productName: product['name'] ?? '',
      quantity: qtyUnits,
      unitPrice: unitPrice,
      isMuntu: isMuntu,
      orderedBy: auth.userId ?? '',
      displayQty: 1, // Adiciona 1 item por vez neste fluxo
    );

    if (!mounted) return;

    if (success) {
      // ===== ATUALIZAR ESTOQUE NA UI (ProductsProvider) =====
      // O TablesProvider já decrementou no banco local E já fez markForSync
      // Aqui só atualizamos a memória para refletir na UI, sem duplicar sync
      await productsProvider.decrementStock(product['id'], qtyUnits,
          syncToServer: false);
      // =======================================================

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              '${product['name']}${isMuntu ? ' (Muntu)' : ''} adicionado!'),
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

  String? _selectedPaymentMethod;

  Future<void> _showCustomerPaymentDialog(
      String customerId, int amount, TablesProvider tables) async {
    _selectedPaymentMethod = null;

    // Buscar dados do cliente para verificar se é cadastrado
    final customer = tables.currentCustomers.firstWhere(
      (c) => c['id'] == customerId,
      orElse: () => <String, dynamic>{},
    );
    final registeredCustomerId =
        customer['customer_id'] as String? ?? customer['customerId'] as String?;
    final customerName = customer['customer_name'] as String? ??
        customer['customerName'] as String? ??
        'Cliente';

    // Carregar crédito se for cliente cadastrado
    int availableCredit = 0;
    if (registeredCustomerId != null) {
      await tables.loadCustomerCredit(registeredCustomerId);
      availableCredit = tables.getAvailableCredit(registeredCustomerId);
    }

    final canUseVale =
        registeredCustomerId != null && availableCredit >= amount;

    final method = await showDialog<String>(
      context: context,
      barrierColor: Colors.black54,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            elevation: 16,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header com gradiente azul
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        vertical: 20, horizontal: 24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.blue.shade600, Colors.blue.shade800],
                      ),
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.payment_rounded,
                            color: Colors.white, size: 40),
                        const SizedBox(height: 8),
                        const Text(
                          'Forma de Pagamento',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(30),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Total: ',
                                style: TextStyle(
                                    color: Colors.white.withOpacity(0.9),
                                    fontSize: 16),
                              ),
                              Text(
                                CurrencyHelper.format(amount),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Corpo do modal
                  Container(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        // Cliente info (se cadastrado)
                        if (registeredCustomerId != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.blue.shade100),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: Colors.blue.shade200,
                                  child: Icon(Icons.person,
                                      color: Colors.blue.shade700, size: 18),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        customerName,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: Colors.blue.shade900,
                                          fontSize: 14,
                                        ),
                                      ),
                                      Text(
                                        'Crédito: ${CurrencyHelper.format(availableCredit)}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.blue.shade600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Título
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Selecione uma opção:',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade600,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Grid de opções (igual ao PDV)
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.0,
                          children: [
                            _buildPaymentOptionCard(
                              ctx,
                              'cash',
                              'Dinheiro',
                              Icons.payments_rounded,
                              Colors.green,
                              setDialogState,
                            ),
                            _buildPaymentOptionCard(
                              ctx,
                              'orange',
                              'Orange',
                              Icons.phone_android_rounded,
                              Colors.orange,
                              setDialogState,
                            ),
                            _buildPaymentOptionCard(
                              ctx,
                              'teletaku',
                              'TeleTaku',
                              Icons.smartphone_rounded,
                              Colors.purple,
                              setDialogState,
                            ),
                            _buildPaymentOptionCard(
                              ctx,
                              'vale',
                              'Vale',
                              Icons.receipt_long_rounded,
                              Colors.amber.shade700,
                              setDialogState,
                              enabled: registeredCustomerId != null,
                              requiresCustomer: true,
                            ),
                            _buildPaymentOptionCard(
                              ctx,
                              'misto',
                              'Misto',
                              Icons.credit_card_rounded,
                              Colors.teal,
                              setDialogState,
                            ),
                          ],
                        ),

                        // Aviso de crédito insuficiente
                        if (_selectedPaymentMethod == 'vale' &&
                            registeredCustomerId != null &&
                            !canUseVale) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.warning_amber_rounded,
                                    color: Colors.red.shade600, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Crédito insuficiente! Disponível: ${CurrencyHelper.format(availableCredit)}',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.red.shade700),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // Aviso se Vale requer cliente
                        if (_selectedPaymentMethod == 'vale' &&
                            registeredCustomerId == null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.amber.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline_rounded,
                                    color: Colors.amber.shade700, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Vale só disponível para clientes cadastrados',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.amber.shade800),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Botões de ação
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(ctx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              side: BorderSide(color: Colors.grey.shade300),
                            ),
                            child: Text(
                              'Cancelar',
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 15),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            decoration: BoxDecoration(
                              gradient: (_selectedPaymentMethod != null &&
                                      !(_selectedPaymentMethod == 'vale' &&
                                          !canUseVale))
                                  ? LinearGradient(colors: [
                                      Colors.green.shade500,
                                      Colors.green.shade700
                                    ])
                                  : LinearGradient(colors: [
                                      Colors.grey.shade300,
                                      Colors.grey.shade400
                                    ]),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: (_selectedPaymentMethod != null &&
                                        !(_selectedPaymentMethod == 'vale' &&
                                            !canUseVale))
                                    ? () => Navigator.pop(
                                        ctx, _selectedPaymentMethod)
                                    : null,
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 14),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.check_circle,
                                          color: Colors.white, size: 20),
                                      SizedBox(width: 8),
                                      Text(
                                        'Confirmar',
                                        style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );

    if (method == null) return;

    // Se for Vale, mostrar modal de confirmação
    if (method == 'vale') {
      final confirmed = await _showValeConfirmation(
        customerName: customerName,
        amount: amount,
        availableCredit: availableCredit,
      );
      if (confirmed != true) return;
    }

    // Processar pagamento
    await _processPayment(
      customerId: customerId,
      registeredCustomerId: registeredCustomerId,
      method: method,
      amount: amount,
      tables: tables,
    );
  }

  Widget _buildPaymentOptionCard(
    BuildContext ctx,
    String value,
    String label,
    IconData icon,
    Color color,
    StateSetter setDialogState, {
    bool enabled = true,
    bool requiresCustomer = false,
  }) {
    final isSelected = _selectedPaymentMethod == value;

    return GestureDetector(
      onTap: enabled
          ? () {
              setDialogState(() => _selectedPaymentMethod = value);
            }
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.15) : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              color: enabled ? color : Colors.grey.shade400,
              size: 28,
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: enabled ? Colors.grey.shade800 : Colors.grey.shade400,
              ),
              textAlign: TextAlign.center,
            ),
            if (requiresCustomer && !enabled)
              Text(
                'Requer\ncliente',
                style: TextStyle(fontSize: 8, color: Colors.grey.shade400),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      ),
    );
  }

  Future<bool?> _showValeConfirmation({
    required String customerName,
    required int amount,
    required int availableCredit,
  }) async {
    final remainingAfter = availableCredit - amount;

    return showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                      colors: [Colors.amber.shade500, Colors.amber.shade600]),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.receipt_long_rounded,
                        color: Colors.white, size: 26),
                    SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        'Confirmar Vale',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Cliente
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.blue.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.person, color: Colors.blue.shade700, size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Cliente',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.blue.shade600)),
                          Text(
                            customerName,
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Colors.blue.shade900),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Valor do Vale
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Column(
                  children: [
                    Text('Valor do Vale',
                        style: TextStyle(
                            fontSize: 13, color: Colors.green.shade700)),
                    const SizedBox(height: 6),
                    Text(
                      CurrencyHelper.format(amount),
                      style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade700),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Crédito atual e restante
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          Text('Crédito Atual',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey.shade600)),
                          const SizedBox(height: 6),
                          Text(
                            CurrencyHelper.format(availableCredit),
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.amber.shade200),
                      ),
                      child: Column(
                        children: [
                          Text('Restante Após',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.amber.shade700)),
                          const SizedBox(height: 6),
                          Text(
                            CurrencyHelper.format(remainingAfter),
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber.shade800),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Aviso
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.warning_rounded,
                        color: Colors.orange.shade700, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Esta operação criará uma dívida registrada. O cliente deverá quitar o valor.',
                        style: TextStyle(
                            fontSize: 12, color: Colors.orange.shade800),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Botões
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [
                          Colors.amber.shade500,
                          Colors.amber.shade600
                        ]),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => Navigator.pop(ctx, true),
                          borderRadius: BorderRadius.circular(12),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.check_circle,
                                    color: Colors.white, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'Confirmar Vale',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _processPayment({
    required String customerId,
    String? registeredCustomerId,
    required String method,
    required int amount,
    required TablesProvider tables,
  }) async {
    // 🔴 PROTEÇÃO: Evitar cliques duplos
    if (_isProcessingPayment) {
      debugPrint(
          '⚠️ [PROTEÇÃO] Pagamento já em processamento, ignorando clique duplo');
      return;
    }

    setState(() => _isProcessingPayment = true);

    try {
      final auth = context.read<AuthProvider>();
      final cashBox = context.read<CashBoxProvider>();
      final session = tables.currentSession;

      if (session == null) {
        setState(() => _isProcessingPayment = false);
        return;
      }

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
        // Atualizar totais do caixa - normalizar método para comparação
        final normalizedMethod = method.toLowerCase();
        if (normalizedMethod == 'cash') {
          await cashBox.updateCashBoxTotals(cashAmount: amount);
        } else if (normalizedMethod == 'orange' ||
            normalizedMethod == 'teletaku' ||
            normalizedMethod == 'mobile') {
          await cashBox.updateCashBoxTotals(mobileMoneyAmount: amount);
        } else if (normalizedMethod == 'vale' || normalizedMethod == 'debt') {
          await cashBox.updateCashBoxTotals(debtAmount: amount);
        } else if (normalizedMethod == 'card' || normalizedMethod == 'mixed') {
          await cashBox.updateCashBoxTotals(cardAmount: amount);
        }

        cashBox.incrementSalesCount();

        // Atribuir pontos de fidelidade (1 ponto a cada 1000 FCFA)
        // 🔴 CORREÇÃO: Passar amount (valor em centavos) diretamente
        // O método addLoyaltyPoints calcula internamente: amount ~/ 100000
        // 🔴 REGRA: Vale (crédito) não dá pontos - apenas pagamentos efetivos
        int pointsEarned = 0;
        if (registeredCustomerId != null &&
            amount >= 100000 &&
            method != 'vale') {
          final customersProvider = context.read<CustomersProvider>();
          // 🔴 FIX: Passar amount (centavos), não o valor já dividido!
          final result = await customersProvider.addLoyaltyPoints(
              registeredCustomerId, amount);
          pointsEarned = result?['added'] ?? 0;
          debugPrint(
              '🎯 Pontos de fidelidade adicionados: $pointsEarned para cliente $registeredCustomerId (amount: $amount centavos)');
        }

        // Mensagem de sucesso com pontos (se cliente cadastrado)
        if (registeredCustomerId != null && pointsEarned > 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Pagamento realizado!',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(
                            '🎯 +$pointsEarned ponto${pointsEarned > 1 ? 's' : ''} de fidelidade',
                            style: const TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 4),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Pagamento realizado!'),
                backgroundColor: Colors.green),
          );
        }
      } else if (tables.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(tables.error!), backgroundColor: Colors.red),
        );
      }
    } finally {
      // 🔴 PROTEÇÃO: Sempre liberar o lock, mesmo em caso de erro
      if (mounted) {
        setState(() => _isProcessingPayment = false);
      }
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
    final productName =
        order['product_name'] ?? order['productName'] ?? 'Produto';
    final isMuntu = (order['is_muntu'] ?? order['isMuntu'] ?? 0) == 1;
    // Quantidade total em unidades disponível (suporta camelCase e snake_case)
    final int qtyUnitsAvailable =
        (order['qtyUnits'] as num? ?? order['qty_units'] as num? ?? 1).toInt();
    // Unidades por Muntu (ex: 1 Muntu = 3 unidades)
    final int muntuFactor =
        (order['muntuQuantity'] as num? ?? order['muntu_quantity'] as num? ?? 3)
            .toInt();

    // DEBUG: Log para diagnóstico
    debugPrint('🔍 [TRANSFER] order keys: ${order.keys.toList()}');
    debugPrint('🔍 [TRANSFER] qty_units: $qtyUnitsAvailable');
    debugPrint(
        '🔍 [TRANSFER] is_muntu: ${order['is_muntu']} -> isMuntu: $isMuntu');
    debugPrint('🔍 [TRANSFER] muntu_quantity (fator): $muntuFactor');

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

    if (qtyUnitsAvailable <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Quantidade insuficiente para transferir'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    String? selectedCustomerId;
    // Para Muntu, começar com 1 Muntu (= muntuFactor unidades)
    // Para unidade, começar com 1 unidade
    int transferQtyUnits = isMuntu ? muntuFactor : 1;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          // Calcular quantos Muntus completos correspondem a transferQtyUnits
          final int muntusToTransfer =
              isMuntu ? (transferQtyUnits ~/ muntuFactor) : 0;

          return AlertDialog(
            title: const Text('Transferir Item'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Produto: $productName'),
                Text(
                    'Disponível: $qtyUnitsAvailable unidade${qtyUnitsAvailable > 1 ? 's' : ''}'),
                if (isMuntu)
                  Text(
                    '(${qtyUnitsAvailable ~/ muntuFactor} Muntu${(qtyUnitsAvailable ~/ muntuFactor) > 1 ? 's' : ''} × $muntuFactor)',
                    style:
                        TextStyle(color: Colors.purple.shade700, fontSize: 12),
                  ),
                const SizedBox(height: 16),

                // Campo de quantidade a transferir
                if (isMuntu) ...[
                  // Para Muntu: transferir em múltiplos do fator
                  Row(
                    children: [
                      const Text('Muntus: '),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: muntusToTransfer > 1
                            ? () => setDialogState(
                                () => transferQtyUnits -= muntuFactor)
                            : null,
                        icon: const Icon(Icons.remove_circle_outline),
                        color: Colors.red,
                        iconSize: 28,
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.purple),
                          borderRadius: BorderRadius.circular(8),
                          color: Colors.purple.shade50,
                        ),
                        child: Text(
                          '$muntusToTransfer',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.purple.shade700,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed:
                            transferQtyUnits + muntuFactor <= qtyUnitsAvailable
                                ? () => setDialogState(
                                    () => transferQtyUnits += muntuFactor)
                                : null,
                        icon: const Icon(Icons.add_circle_outline),
                        color: Colors.green,
                        iconSize: 28,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '= $transferQtyUnits unidades',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                ] else ...[
                  // Para unidade: transferir normalmente
                  if (qtyUnitsAvailable > 1)
                    Row(
                      children: [
                        const Text('Quantidade: '),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: transferQtyUnits > 1
                              ? () => setDialogState(() => transferQtyUnits--)
                              : null,
                          icon: const Icon(Icons.remove_circle_outline),
                          color: Colors.red,
                          iconSize: 28,
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$transferQtyUnits',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: transferQtyUnits < qtyUnitsAvailable
                              ? () => setDialogState(() => transferQtyUnits++)
                              : null,
                          icon: const Icon(Icons.add_circle_outline),
                          color: Colors.green,
                          iconSize: 28,
                        ),
                      ],
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline,
                              color: Colors.amber.shade700, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Só há 1 unidade disponível para transferir.',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.amber.shade800),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],

                const SizedBox(height: 16),
                const Text('Transferir para:',
                    style: TextStyle(fontWeight: FontWeight.w500)),
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
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                onPressed: selectedCustomerId != null && transferQtyUnits > 0
                    ? () {
                        Navigator.pop(ctx, {
                          'toCustomerId': selectedCustomerId,
                          'qtyUnits':
                              transferQtyUnits, // Quantidade em unidades
                          'displayQty':
                              isMuntu ? muntusToTransfer : transferQtyUnits,
                        });
                      }
                    : null,
                style: isMuntu
                    ? ElevatedButton.styleFrom(backgroundColor: Colors.purple)
                    : null,
                child: Text('Transferir $transferQtyUnits un.'),
              ),
            ],
          );
        },
      ),
    );

    if (result == null) return;

    final auth = context.read<AuthProvider>();
    final success = await tables.transferOrder(
      orderId: order['id'],
      fromCustomerId: fromCustomerId,
      toCustomerId: result['toCustomerId'],
      qtyUnits: result['qtyUnits'], // Quantidade em unidades
      transferredBy: auth.userId ?? '',
      displayQty: result['displayQty'], // Quantidade para exibição
      productName: productName, // Nome do produto
      isMuntu: isMuntu, // Se é Muntu
      muntuQuantity: muntuFactor, // Unidades por Muntu
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
    final productName =
        order['productName'] ?? order['product_name'] ?? 'Produto';

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

    if (!mounted) return;

    final auth = context.read<AuthProvider>();

    final totalAmount = session['total_amount'] ?? session['totalAmount'] ?? 0;
    final paidAmount = session['paid_amount'] ?? session['paidAmount'] ?? 0;
    final pending = totalAmount - paidAmount;

    if (pending > 0) {
      if (!mounted) return;
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

    if (!mounted) return;

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

    if (!mounted) return;
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
    // Filtrar clientes com pedidos pendentes (não pagos/cancelados)
    final pendingCustomers = tables.currentCustomers.where((c) {
      final customerId = c['id'];
      final pendingOrders = tables.getPendingOrdersForCustomer(customerId);
      int pendingTotal = 0;
      for (final order in pendingOrders) {
        pendingTotal += (order['total'] as num? ?? 0).toInt();
      }
      return pendingTotal > 0;
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
              final customerId = customer['id'];
              // Calcular valor pendente baseado em pedidos não pagos
              final pendingOrders =
                  tables.getPendingOrdersForCustomer(customerId);
              int pending = 0;
              for (final order in pendingOrders) {
                pending += (order['total'] as num? ?? 0).toInt();
              }

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

    final auth = context.read<AuthProvider>();
    if ((auth.userId ?? '').isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sem permissão: usuário não autenticado'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

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
                            hint: const Text('Manter nesta mesa'),
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
              onPressed: distributions.values.any((v) => v != null)
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

/// Widget para adicionar cliente - com busca de cadastrados ou manual
class _AddCustomerSheet extends StatefulWidget {
  final CustomersProvider customersProvider;
  final Function(Map<String, dynamic>) onSelectRegistered;
  final Function(String) onAddManual;

  const _AddCustomerSheet({
    required this.customersProvider,
    required this.onSelectRegistered,
    required this.onAddManual,
  });

  @override
  State<_AddCustomerSheet> createState() => _AddCustomerSheetState();
}

class _AddCustomerSheetState extends State<_AddCustomerSheet> {
  final _searchController = TextEditingController();
  final _manualNameController = TextEditingController();
  bool _showManualInput = false;
  String _searchQuery = '';

  List<Map<String, dynamic>> get _filteredCustomers {
    if (_searchQuery.isEmpty) return widget.customersProvider.customers;
    final query = _searchQuery.toLowerCase();
    return widget.customersProvider.customers.where((c) {
      final name = (c['name'] ?? c['fullName'] ?? '').toString().toLowerCase();
      final phone = (c['phone'] ?? '').toString().toLowerCase();
      return name.contains(query) || phone.contains(query);
    }).toList();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _manualNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        final bottomInset = MediaQuery.of(context).viewInsets.bottom;

        return AnimatedPadding(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          padding: EdgeInsets.only(bottom: bottomInset),
          child: SafeArea(
            top: false,
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.only(bottom: 16),
              children: [
                // Handle
                Center(
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // Título
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Adicionar Cliente',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                ),

                // Toggle entre buscar e adicionar manual
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              setState(() => _showManualInput = false),
                          icon: const Icon(Icons.search),
                          label: const Text('Buscar Cadastrado'),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: !_showManualInput
                                ? Theme.of(context)
                                    .primaryColor
                                    .withOpacity(0.1)
                                : null,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              setState(() => _showManualInput = true),
                          icon: const Icon(Icons.person_add),
                          label: const Text('Digitar Nome'),
                          style: OutlinedButton.styleFrom(
                            backgroundColor: _showManualInput
                                ? Theme.of(context)
                                    .primaryColor
                                    .withOpacity(0.1)
                                : null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                if (_showManualInput) ...[
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        TextField(
                          controller: _manualNameController,
                          autofocus: true,
                          scrollPadding:
                              EdgeInsets.only(bottom: bottomInset + 120),
                          decoration: const InputDecoration(
                            labelText: 'Nome do Cliente',
                            prefixIcon: Icon(Icons.person),
                            border: OutlineInputBorder(),
                          ),
                          onSubmitted: (value) {
                            if (value.isNotEmpty) {
                              widget.onAddManual(value);
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              if (_manualNameController.text.isNotEmpty) {
                                widget.onAddManual(_manualNameController.text);
                              }
                            },
                            icon: const Icon(Icons.check),
                            label: const Text('Adicionar'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: TextField(
                      controller: _searchController,
                      scrollPadding: EdgeInsets.only(bottom: bottomInset + 120),
                      decoration: InputDecoration(
                        hintText: 'Buscar por nome ou telefone...',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      onChanged: (value) =>
                          setState(() => _searchQuery = value),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_filteredCustomers.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 24),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(Icons.people_outline,
                                size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 8),
                            Text(
                              _searchQuery.isEmpty
                                  ? 'Nenhum cliente cadastrado'
                                  : 'Nenhum cliente encontrado',
                              style: TextStyle(color: Colors.grey[600]),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 16),
                            TextButton.icon(
                              onPressed: () =>
                                  setState(() => _showManualInput = true),
                              icon: const Icon(Icons.person_add),
                              label: const Text('Adicionar manualmente'),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ..._filteredCustomers.map((customer) {
                      final name = customer['name'] ??
                          customer['fullName'] ??
                          'Sem nome';
                      final phone = customer['phone'] ?? '';
                      // Calcular crédito disponível do cliente
                      final creditLimit = customer['credit_limit'] ??
                          customer['creditLimit'] ??
                          0;
                      final currentDebt = customer['current_debt'] ??
                          customer['currentDebt'] ??
                          0;
                      final availableCredit = creditLimit - currentDebt;

                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Colors.blue.shade100,
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.blue,
                            ),
                          ),
                        ),
                        title: Text(name),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (phone.isNotEmpty)
                              Text(phone,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600)),
                            if (creditLimit > 0)
                              Container(
                                margin: const EdgeInsets.only(top: 4),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Crédito: ${CurrencyHelper.format(availableCredit)}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.green.shade700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => widget.onSelectRegistered(customer),
                      );
                    }),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Widget para adicionar pedido - com busca, Muntu e carrinho
class _AddOrderSheet extends StatefulWidget {
  final String customerId;
  final String customerName;
  final TablesProvider tables;
  final ProductsProvider products;
  final VoidCallback onOrderAdded;

  const _AddOrderSheet({
    required this.customerId,
    required this.customerName,
    required this.tables,
    required this.products,
    required this.onOrderAdded,
  });

  @override
  State<_AddOrderSheet> createState() => _AddOrderSheetState();
}

class _AddOrderSheetState extends State<_AddOrderSheet> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  final List<Map<String, dynamic>> _cart = [];

  List<Map<String, dynamic>> get _filteredProducts {
    final products = widget.products.filteredProducts;
    if (_searchQuery.isEmpty) return products;
    final query = _searchQuery.toLowerCase();
    return products.where((p) {
      final name = (p['name'] ?? '').toString().toLowerCase();
      final sku = (p['sku'] ?? '').toString().toLowerCase();
      return name.contains(query) || sku.contains(query);
    }).toList();
  }

  int get _cartTotal {
    return _cart.fold(0, (sum, item) => sum + (item['total'] as int));
  }

  void _addToCart(Map<String, dynamic> product, bool isMuntu) {
    final unitPrice = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final muntuPrice = product['muntu_price'] ?? product['muntuPrice'] ?? 0;
    final muntuQty = product['muntu_quantity'] ?? product['muntuQuantity'] ?? 0;

    final displayPrice = isMuntu ? muntuPrice : unitPrice;
    final fallbackUnitPrice = unitPrice;
    final qtyUnitsPerAdd = isMuntu ? (muntuQty > 0 ? muntuQty : 1) : 1;

    // Verificar se já existe no carrinho
    final existingIndex = _cart.indexWhere((item) =>
        item['productId'] == product['id'] && item['isMuntu'] == isMuntu);

    if (existingIndex >= 0) {
      setState(() {
        _cart[existingIndex]['quantity']++;
        _cart[existingIndex]['total'] = _cart[existingIndex]['quantity'] *
            _cart[existingIndex]['unitPrice'];
      });
    } else {
      setState(() {
        _cart.add({
          'productId': product['id'],
          'productName': product['name'] ?? '',
          'quantity': 1,
          // unitPrice aqui é o preço exibido/aplicado no tipo selecionado
          'unitPrice': displayPrice,
          'total': displayPrice,
          'isMuntu': isMuntu,
          // Para manter consistência com backend/electron, armazenamos também:
          // - fallbackUnitPrice: preço unitário real do produto
          // - qtyUnitsPerItem: para Muntu, quantos units representam 1 Muntu
          'fallbackUnitPrice': fallbackUnitPrice,
          'qtyUnitsPerItem': qtyUnitsPerAdd,
        });
      });
    }
  }

  void _removeFromCart(int index) {
    setState(() {
      if (_cart[index]['quantity'] > 1) {
        _cart[index]['quantity']--;
        _cart[index]['total'] =
            _cart[index]['quantity'] * _cart[index]['unitPrice'];
      } else {
        _cart.removeAt(index);
      }
    });
  }

  void _incrementCartItem(int index) {
    setState(() {
      _cart[index]['quantity']++;
      _cart[index]['total'] =
          _cart[index]['quantity'] * _cart[index]['unitPrice'];
    });
  }

  Future<void> _confirmOrders() async {
    if (_cart.isEmpty) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final productsProvider =
        Provider.of<ProductsProvider>(context, listen: false);
    final session = widget.tables.currentSession;
    if (session == null) return;

    bool allSuccess = true;
    final ordersToDecrement = <Map<String, dynamic>>[];

    for (final item in _cart) {
      final isMuntu = item['isMuntu'] == true;
      final qty =
          (item['quantity'] ?? 1) as int; // Quantidade no carrinho (ex: 3)
      final qtyUnitsPerItem = (item['qtyUnitsPerItem'] ?? 1) as int;
      final qtyUnits = isMuntu ? (qty * qtyUnitsPerItem) : qty;
      final fallbackUnitPrice =
          (item['fallbackUnitPrice'] ?? item['unitPrice']) as int;

      final success = await widget.tables.addOrder(
        sessionId: session['id'],
        tableCustomerId: widget.customerId,
        productId: item['productId'],
        productName: item['productName'],
        quantity: qtyUnits,
        unitPrice: fallbackUnitPrice,
        isMuntu: isMuntu,
        orderedBy: auth.userId ?? '',
        displayQty: qty, // Quantidade do carrinho para exibição
      );
      if (!success) {
        allSuccess = false;
      } else {
        // Guardar para atualizar estoque na UI
        ordersToDecrement.add({
          'productId': item['productId'],
          'quantity': qtyUnits,
        });
      }
    }

    // ===== ATUALIZAR ESTOQUE NA UI (ProductsProvider) =====
    // TablesProvider já fez markForSync, só atualizamos memória
    for (final order in ordersToDecrement) {
      await productsProvider.decrementStock(
          order['productId'], order['quantity'],
          syncToServer: false);
    }
    // =======================================================

    if (!mounted) return;

    if (allSuccess) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${_cart.length} item(s) adicionado(s)!'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.tables.error ?? 'Erro ao adicionar pedidos'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => AnimatedPadding(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
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
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Pedido - ${widget.customerName}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (_cart.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${_cart.length} itens',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Busca
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Buscar produtos...',
                  prefixIcon: const Icon(Icons.search),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                onChanged: (value) => setState(() => _searchQuery = value),
              ),
            ),

            // Lista de produtos
            Expanded(
              child: GridView.builder(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.75,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: _filteredProducts.length,
                itemBuilder: (context, index) {
                  final product = _filteredProducts[index];
                  return _buildProductCard(product);
                },
              ),
            ),

            // Carrinho
            if (_cart.isNotEmpty) ...[
              const Divider(height: 1),
              Container(
                constraints: const BoxConstraints(maxHeight: 150),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _cart.length,
                  itemBuilder: (context, index) {
                    final item = _cart[index];
                    return ListTile(
                      dense: true,
                      leading: CircleAvatar(
                        radius: 14,
                        backgroundColor: Colors.blue.shade100,
                        child: Text(
                          item['quantity'].toString(),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.blue,
                          ),
                        ),
                      ),
                      title: Text(
                        '${item['productName']}${item['isMuntu'] ? ' (Muntu)' : ''}',
                        style: const TextStyle(fontSize: 14),
                      ),
                      subtitle: Text(
                        CurrencyHelper.format(item['unitPrice']),
                        style:
                            const TextStyle(fontSize: 12, color: Colors.green),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            CurrencyHelper.format(item['total']),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(width: 8),
                          // Botão diminuir quantidade
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline,
                                color: Colors.red, size: 24),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            onPressed: () => _removeFromCart(index),
                          ),
                          // Quantidade atual
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              '${item['quantity']}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          // Botão aumentar quantidade
                          IconButton(
                            icon: const Icon(Icons.add_circle,
                                color: Colors.green, size: 24),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            onPressed: () => _incrementCartItem(index),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],

            // Footer com total e botão confirmar
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Total', style: TextStyle(fontSize: 12)),
                        Text(
                          CurrencyHelper.format(_cartTotal),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: _cart.isNotEmpty ? _confirmOrders : null,
                    icon: const Icon(Icons.check),
                    label: const Text('Confirmar Pedido'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    final productId = product['id'];
    final name = product['name'] ?? '';
    final priceUnit = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final priceMuntu = product['muntu_price'] ?? product['muntuPrice'];
    final isMuntuEligible =
        product['is_muntu_eligible'] == 1 || product['isMuntuEligible'] == true;
    final hasMuntu = isMuntuEligible && priceMuntu != null && priceMuntu > 0;
    final stock = widget.products.getProductStock(productId);
    final isAvailable = stock > 0;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Ícone
            Icon(
              Icons.local_drink,
              size: 32,
              color: isAvailable ? Colors.blue : Colors.grey,
            ),
            const SizedBox(height: 4),

            // Nome
            Text(
              name,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isAvailable ? Colors.black87 : Colors.grey,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),

            // Estoque
            Text(
              'Estoque: $stock',
              style: TextStyle(
                fontSize: 10,
                color: stock > 5
                    ? Colors.green
                    : (stock > 0 ? Colors.orange : Colors.red),
              ),
            ),
            const SizedBox(height: 8),

            // Botões de preço
            if (isAvailable) ...[
              // Botão Unitário
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _addToCart(product, false),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    minimumSize: const Size(0, 30),
                  ),
                  child: Text(
                    'UNITÁRIO ${CurrencyHelper.format(priceUnit)}',
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ),

              // Botão Muntu (se disponível)
              if (hasMuntu) ...[
                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => _addToCart(product, true),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.orange,
                      side: const BorderSide(color: Colors.orange),
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      minimumSize: const Size(0, 30),
                    ),
                    child: Text(
                      'MUNTU ${CurrencyHelper.format(priceMuntu)}',
                      style: const TextStyle(
                          fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ] else ...[
              const Text(
                'Sem estoque',
                style: TextStyle(color: Colors.red, fontSize: 11),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
