import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final currencyFormat = NumberFormat.currency(locale: 'pt_AO', symbol: 'Kz ');

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    await provider.loadInventory();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          color: AppTheme.surfaceColor,
          child: TabBar(
            controller: _tabController,
            labelColor: AppTheme.primaryColor,
            unselectedLabelColor: AppTheme.textMuted,
            indicatorColor: AppTheme.primaryColor,
            isScrollable: true,
            tabs: const [
              Tab(text: 'Dashboard'),
              Tab(text: 'Detalhado'),
              Tab(text: 'Movimentações'),
              Tab(text: 'Valorização'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _InventoryDashboard(currencyFormat: currencyFormat),
              _InventoryDetailed(currencyFormat: currencyFormat),
              const _InventoryMovements(),
              _InventoryValuation(currencyFormat: currencyFormat),
            ],
          ),
        ),
      ],
    );
  }
}

class _InventoryDashboard extends StatelessWidget {
  final NumberFormat currencyFormat;

  const _InventoryDashboard({required this.currencyFormat});

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        final inventory = provider.inventory;
        final totalProducts = inventory.length;
        final totalStock = inventory.fold(0, (sum, i) => sum + i.quantityUnits);
        final totalValue = inventory.fold(0.0, (sum, i) => sum + i.stockValue);
        final lowStockCount = inventory.where((i) => i.isLowStock).length;
        final outOfStock = inventory.where((i) => i.quantityUnits == 0).length;

        if (provider.isLoading) return const LoadingIndicator();

        return RefreshIndicator(
          onRefresh: () => provider.loadInventory(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: AppTheme.spacingMD,
                  mainAxisSpacing: AppTheme.spacingMD,
                  childAspectRatio: 1.4,
                  children: [
                    _StatCard(
                        title: 'Produtos',
                        value: '$totalProducts',
                        icon: Icons.inventory_2,
                        color: AppTheme.primaryColor),
                    _StatCard(
                        title: 'Em Estoque',
                        value: '$totalStock',
                        icon: Icons.category,
                        color: AppTheme.accentColor),
                    _StatCard(
                        title: 'Valor Total',
                        value: currencyFormat.format(totalValue),
                        icon: Icons.attach_money,
                        color: const Color(0xFF8B5CF6)),
                    _StatCard(
                        title: 'Baixo',
                        value: '$lowStockCount',
                        icon: Icons.warning,
                        color: AppTheme.warningColor),
                  ],
                ),
                if (lowStockCount > 0) ...[
                  const SizedBox(height: AppTheme.spacingLG),
                  const SectionHeader(title: 'Estoque Baixo'),
                  ...inventory
                      .where((i) => i.isLowStock && i.quantityUnits > 0)
                      .take(5)
                      .map((item) => _LowStockCard(
                          item: item, currencyFormat: currencyFormat)),
                ],
                if (outOfStock > 0) ...[
                  const SizedBox(height: AppTheme.spacingLG),
                  const SectionHeader(title: 'Sem Estoque'),
                  ...inventory
                      .where((i) => i.quantityUnits == 0)
                      .take(5)
                      .map((item) => _OutOfStockCard(item: item)),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _InventoryDetailed extends StatefulWidget {
  final NumberFormat currencyFormat;
  const _InventoryDetailed({required this.currencyFormat});
  @override
  State<_InventoryDetailed> createState() => _InventoryDetailedState();
}

class _InventoryDetailedState extends State<_InventoryDetailed> {
  String _search = '';
  String _sortBy = 'name';

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        var inv = provider.inventory.where((i) {
          if (_search.isEmpty) return true;
          final name = (i.productName ?? '').toLowerCase();
          final sku = (i.productSku ?? '').toLowerCase();
          return name.contains(_search.toLowerCase()) ||
              sku.contains(_search.toLowerCase());
        }).toList();

        inv = List.from(inv);
        if (_sortBy == 'name')
          inv.sort(
              (a, b) => (a.productName ?? '').compareTo(b.productName ?? ''));
        if (_sortBy == 'stock')
          inv.sort((a, b) => b.quantityUnits.compareTo(a.quantityUnits));
        if (_sortBy == 'value')
          inv.sort((a, b) => b.stockValue.compareTo(a.stockValue));

        if (provider.isLoading) return const LoadingIndicator();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      onChanged: (v) => setState(() => _search = v),
                      decoration: InputDecoration(
                        hintText: 'Buscar...',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusSmall)),
                      ),
                    ),
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.sort),
                    onSelected: (v) => setState(() => _sortBy = v),
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'name', child: Text('Nome')),
                      const PopupMenuItem(
                          value: 'stock', child: Text('Quantidade')),
                      const PopupMenuItem(value: 'value', child: Text('Valor')),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: inv.isEmpty
                  ? const EmptyState(
                      icon: Icons.inventory_2, title: 'Nenhum item')
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacingMD),
                      itemCount: inv.length,
                      itemBuilder: (_, i) => _InventoryItemCard(
                          item: inv[i], currencyFormat: widget.currencyFormat),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _InventoryMovements extends StatelessWidget {
  const _InventoryMovements();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: EmptyState(
        icon: Icons.swap_horiz,
        title: 'Movimentações',
        subtitle: 'As movimentações serão carregadas do servidor',
      ),
    );
  }
}

class _InventoryValuation extends StatelessWidget {
  final NumberFormat currencyFormat;
  const _InventoryValuation({required this.currencyFormat});

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        final inv = provider.inventory;
        final costTotal = inv.fold(0.0, (sum, i) => sum + i.stockValue);
        final saleTotal = inv.fold(
            0.0, (sum, i) => sum + (i.quantityUnits * (i.priceUnit ?? 0)));
        final profit = saleTotal - costTotal;
        final margin = costTotal > 0 ? (profit / costTotal * 100) : 0.0;
        final sorted = List<Inventory>.from(inv)
          ..sort((a, b) => b.stockValue.compareTo(a.stockValue));

        if (provider.isLoading) return const LoadingIndicator();

        return RefreshIndicator(
          onRefresh: () => provider.loadInventory(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppTheme.spacingMD),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                        colors: [AppTheme.primaryColor, Color(0xFF1D4ED8)]),
                    borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
                  ),
                  child: Column(
                    children: [
                      Row(children: [
                        Expanded(
                            child: _ValCol(
                                label: 'Custo',
                                value: currencyFormat.format(costTotal))),
                        Container(width: 1, height: 40, color: Colors.white24),
                        Expanded(
                            child: _ValCol(
                                label: 'Venda',
                                value: currencyFormat.format(saleTotal))),
                      ]),
                      const Divider(color: Colors.white24),
                      Row(children: [
                        Expanded(
                            child: _ValCol(
                                label: 'Lucro',
                                value: currencyFormat.format(profit))),
                        Container(width: 1, height: 40, color: Colors.white24),
                        Expanded(
                            child: _ValCol(
                                label: 'Margem',
                                value: '${margin.toStringAsFixed(1)}%')),
                      ]),
                    ],
                  ),
                ),
                const SizedBox(height: AppTheme.spacingLG),
                const SectionHeader(title: 'Maiores Valores'),
                ...sorted.take(10).map((item) => _ValCard(
                    item: item,
                    currencyFormat: currencyFormat,
                    total: costTotal)),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _StatCard(
      {required this.title,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4)),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 8),
            Text(title,
                style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
          ]),
          FittedBox(
              child: Text(value,
                  style: TextStyle(fontWeight: FontWeight.bold, color: color))),
        ],
      ),
    );
  }
}

class _LowStockCard extends StatelessWidget {
  final Inventory item;
  final NumberFormat currencyFormat;
  const _LowStockCard({required this.item, required this.currencyFormat});

  @override
  Widget build(BuildContext context) {
    final pct = item.minStockUnits > 0
        ? (item.quantityUnits / item.minStockUnits).clamp(0.0, 1.0)
        : 0.0;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.warningColor.withOpacity(0.3)),
      ),
      child: Row(children: [
        Icon(Icons.warning, color: AppTheme.warningColor),
        const SizedBox(width: 12),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.productName ?? 'Produto',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            LinearProgressIndicator(
                value: pct,
                backgroundColor: AppTheme.borderColor,
                valueColor: AlwaysStoppedAnimation(
                    pct < 0.3 ? AppTheme.dangerColor : AppTheme.warningColor)),
          ]),
        ),
        Text('${item.quantityUnits}/${item.minStockUnits}',
            style: TextStyle(color: AppTheme.textMuted)),
      ]),
    );
  }
}

class _OutOfStockCard extends StatelessWidget {
  final Inventory item;
  const _OutOfStockCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.dangerColor.withOpacity(0.3)),
      ),
      child: Row(children: [
        Icon(Icons.error_outline, color: AppTheme.dangerColor),
        const SizedBox(width: 12),
        Expanded(
            child: Text(item.productName ?? 'Produto',
                style: const TextStyle(fontWeight: FontWeight.w600))),
        const StatusBadge(label: 'Sem Estoque', type: StatusType.danger),
      ]),
    );
  }
}

class _InventoryItemCard extends StatelessWidget {
  final Inventory item;
  final NumberFormat currencyFormat;
  const _InventoryItemCard({required this.item, required this.currencyFormat});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(8),
        border: item.quantityUnits == 0
            ? Border.all(color: AppTheme.dangerColor.withOpacity(0.3))
            : item.isLowStock
                ? Border.all(color: AppTheme.warningColor.withOpacity(0.3))
                : null,
      ),
      child: Column(children: [
        Row(children: [
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.productName ?? 'Produto',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              if (item.productSku != null)
                Text('SKU: ${item.productSku}',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
            ]),
          ),
          if (item.quantityUnits == 0)
            const StatusBadge(label: 'Sem Estoque', type: StatusType.danger)
          else if (item.isLowStock)
            const StatusBadge(label: 'Baixo', type: StatusType.warning),
        ]),
        const Divider(),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('${item.quantityUnits} un',
              style: const TextStyle(fontSize: 12)),
          Text(currencyFormat.format(item.costUnit ?? 0),
              style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
          Text(currencyFormat.format(item.stockValue),
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primaryColor)),
        ]),
      ]),
    );
  }
}

class _ValCol extends StatelessWidget {
  final String label, value;
  const _ValCol({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
      FittedBox(
          child: Text(value,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.bold))),
    ]);
  }
}

class _ValCard extends StatelessWidget {
  final Inventory item;
  final NumberFormat currencyFormat;
  final double total;
  const _ValCard(
      {required this.item, required this.currencyFormat, required this.total});

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (item.stockValue / total * 100) : 0.0;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: AppTheme.surfaceColor, borderRadius: BorderRadius.circular(8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Expanded(
              child: Text(item.productName ?? 'Produto',
                  style: const TextStyle(fontWeight: FontWeight.w600))),
          Text(currencyFormat.format(item.stockValue),
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: AppTheme.primaryColor)),
        ]),
        Text('${item.quantityUnits} un • ${pct.toStringAsFixed(1)}%',
            style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
        LinearProgressIndicator(
            value: pct / 100,
            backgroundColor: AppTheme.borderColor,
            valueColor: const AlwaysStoppedAnimation(AppTheme.primaryColor)),
      ]),
    );
  }
}
