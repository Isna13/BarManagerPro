import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final currencyFormat =
      NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA ', decimalDigits: 0);
  final TextEditingController _searchController = TextEditingController();
  String? _selectedCategory;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final provider = context.read<DataProvider>();
    await provider.loadProducts();
    await provider.loadCategories();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        var products = provider.products;

        // Filter by search
        if (_searchController.text.isNotEmpty) {
          final query = _searchController.text.toLowerCase();
          products = products
              .where((p) =>
                  p.name.toLowerCase().contains(query) ||
                  (p.sku?.toLowerCase().contains(query) ?? false))
              .toList();
        }

        // Filter by category
        if (_selectedCategory != null) {
          products =
              products.where((p) => p.categoryId == _selectedCategory).toList();
        }

        return Column(
          children: [
            // Search Bar
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              child: CustomSearchBar(
                controller: _searchController,
                hintText: 'Buscar produtos...',
                onChanged: (_) => setState(() {}),
                onClear: () => setState(() {}),
              ),
            ),

            // Category Filter
            if (provider.categories.isNotEmpty)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
                child: Row(
                  children: [
                    _CategoryChip(
                      label: 'Todos',
                      isSelected: _selectedCategory == null,
                      onTap: () => setState(() => _selectedCategory = null),
                    ),
                    ...provider.categories.map((cat) => _CategoryChip(
                          label: cat.name,
                          isSelected: _selectedCategory == cat.id,
                          onTap: () =>
                              setState(() => _selectedCategory = cat.id),
                        )),
                  ],
                ),
              ),
            const SizedBox(height: AppTheme.spacingMD),

            // Summary
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: Row(
                children: [
                  Text(
                    '${products.length} produtos',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingSM),

            // Products List
            Expanded(
              child: provider.isLoading
                  ? const LoadingIndicator()
                  : products.isEmpty
                      ? const EmptyState(
                          icon: Icons.inventory_2,
                          title: 'Nenhum produto encontrado',
                        )
                      : RefreshIndicator(
                          onRefresh: _loadData,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppTheme.spacingMD),
                            itemCount: products.length,
                            itemBuilder: (context, index) {
                              final product = products[index];
                              return _ProductCard(
                                product: product,
                                currencyFormat: currencyFormat,
                                onTap: () => _showProductDetails(product),
                              );
                            },
                          ),
                        ),
            ),
          ],
        );
      },
    );
  }

  void _showProductDetails(Product product) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ProductDetailsSheet(
        product: product,
        currencyFormat: currencyFormat,
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _CategoryChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppTheme.spacingSM),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onTap(),
        selectedColor: AppTheme.primaryColor.withOpacity(0.2),
        checkmarkColor: AppTheme.primaryColor,
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Product product;
  final NumberFormat currencyFormat;
  final VoidCallback onTap;

  const _ProductCard({
    required this.product,
    required this.currencyFormat,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMD),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                ),
                child: const Icon(
                  Icons.inventory_2,
                  color: AppTheme.primaryColor,
                ),
              ),
              const SizedBox(width: AppTheme.spacingMD),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      style: Theme.of(context).textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (product.sku != null) ...[
                      const SizedBox(height: AppTheme.spacingXS),
                      Text(
                        'SKU: ${product.sku}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: AppTheme.spacingXS),
                    Text(
                      product.categoryName ?? 'Sem categoria',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.primaryColor,
                          ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    currencyFormat.format(product.priceUnit),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.accentColor,
                        ),
                  ),
                  const SizedBox(height: AppTheme.spacingXS),
                  Text(
                    'Custo: ${currencyFormat.format(product.costUnit)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: AppTheme.spacingXS),
                  StatusBadge(
                    label: '${product.profitMargin.toStringAsFixed(1)}% margem',
                    type: product.profitMargin >= 30
                        ? StatusType.success
                        : product.profitMargin >= 15
                            ? StatusType.warning
                            : StatusType.danger,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductDetailsSheet extends StatelessWidget {
  final Product product;
  final NumberFormat currencyFormat;

  const _ProductDetailsSheet({
    required this.product,
    required this.currencyFormat,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusXLarge),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: AppTheme.spacingSM),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.borderColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  ),
                  child: const Icon(Icons.inventory_2,
                      color: AppTheme.primaryColor),
                ),
                const SizedBox(width: AppTheme.spacingMD),
                Expanded(
                  child: Text(
                    product.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DetailRow(label: 'SKU', value: product.sku ?? '-'),
                  _DetailRow(
                      label: 'Código de Barras', value: product.barcode ?? '-'),
                  _DetailRow(
                      label: 'Categoria', value: product.categoryName ?? '-'),
                  _DetailRow(
                      label: 'Fornecedor', value: product.supplierName ?? '-'),
                  const Divider(),
                  _DetailRow(
                    label: 'Preço de Venda',
                    value: currencyFormat.format(product.priceUnit),
                    valueColor: AppTheme.accentColor,
                  ),
                  _DetailRow(
                      label: 'Custo',
                      value: currencyFormat.format(product.costUnit)),
                  _DetailRow(
                    label: 'Margem de Lucro',
                    value: '${product.profitMargin.toStringAsFixed(1)}%',
                    valueColor: product.profitMargin >= 30
                        ? AppTheme.accentColor
                        : AppTheme.warningColor,
                  ),
                  if (product.boxEnabled && product.priceBox != null) ...[
                    const Divider(),
                    _DetailRow(
                        label: 'Preço Caixa',
                        value: currencyFormat.format(product.priceBox)),
                    _DetailRow(
                        label: 'Unidades por Caixa',
                        value: '${product.unitsPerBox ?? 0}'),
                  ],
                  if (product.isMuntuEligible) ...[
                    const Divider(),
                    _DetailRow(label: 'Muntu Habilitado', value: 'Sim'),
                    _DetailRow(
                        label: 'Quantidade Muntu',
                        value: '${product.muntuQuantity ?? 0}'),
                    _DetailRow(
                        label: 'Preço Muntu',
                        value: currencyFormat.format(product.muntuPrice ?? 0)),
                  ],
                  const Divider(),
                  _DetailRow(
                      label: 'Alerta Estoque Baixo',
                      value: '${product.lowStockAlert} unidades'),
                  _DetailRow(
                    label: 'Status',
                    value: product.isActive ? 'Ativo' : 'Inativo',
                    valueColor: product.isActive
                        ? AppTheme.accentColor
                        : AppTheme.dangerColor,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(
            value,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: valueColor,
                ),
          ),
        ],
      ),
    );
  }
}
