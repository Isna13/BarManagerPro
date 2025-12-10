import 'package:flutter/material.dart';
import '../utils/currency_helper.dart';
import '../utils/responsive_helper.dart';
import '../utils/app_theme.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/products_provider.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _filterOption = 'all'; // all, low, out

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final padding = Responsive.padding(context);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppTheme.primaryColor.withOpacity(0.05),
            Colors.white,
          ],
        ),
      ),
      child: Column(
        children: [
          // Search e Filtros
          Padding(
            padding: EdgeInsets.all(padding),
            child: Column(
              children: [
                // Barra de busca moderna
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: AppTheme.cardShadow,
                  ),
                  child: TextField(
                    controller: _searchController,
                    style: AppTheme.bodyLarge,
                    decoration: InputDecoration(
                      hintText: 'Buscar produto...',
                      hintStyle: TextStyle(color: Colors.grey.shade400),
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        color: AppTheme.primaryColor,
                      ),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: Icon(
                                Icons.clear_rounded,
                                color: Colors.grey.shade400,
                              ),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 16,
                      ),
                    ),
                    onChanged: (value) {
                      setState(() => _searchQuery = value.toLowerCase());
                    },
                  ),
                ),
                SizedBox(height: Responsive.spacing(context)),

                // Filtros modernos
                SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _buildFilterChip('all', 'Todos', Icons.grid_view_rounded),
                      SizedBox(width: Responsive.spacing(context) / 2),
                      _buildFilterChip(
                          'low', 'Estoque Baixo', Icons.warning_amber_rounded),
                      SizedBox(width: Responsive.spacing(context) / 2),
                      _buildFilterChip(
                          'out', 'Sem Estoque', Icons.error_outline_rounded),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Resumo de estoque
          _buildStockSummary(),

          // Lista de produtos
          Expanded(
            child: Consumer<ProductsProvider>(
              builder: (context, products, _) {
                if (products.isLoading && products.products.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(
                          color: AppTheme.primaryColor,
                          strokeWidth: 3,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Carregando inventário...',
                          style: AppTheme.bodyMedium.copyWith(
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                final filteredProducts = _getFilteredProducts(products);

                if (filteredProducts.isEmpty) {
                  return _buildEmptyState();
                }

                return RefreshIndicator(
                  color: AppTheme.primaryColor,
                  onRefresh: () async {
                    await products.loadProducts();
                    await products.loadInventory();
                  },
                  child: ListView.builder(
                    padding: EdgeInsets.all(padding),
                    itemCount: filteredProducts.length,
                    itemBuilder: (context, index) {
                      return _buildProductCard(
                          filteredProducts[index], products);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStockSummary() {
    return Consumer<ProductsProvider>(
      builder: (context, products, _) {
        final allProducts = products.products;
        int totalProducts = allProducts.length;
        int lowStock = 0;
        int outOfStock = 0;

        for (final product in allProducts) {
          final stock = products.getProductStock(product['id']);
          final lowStockAlert = product['low_stock_alert'] ?? 10;

          if (stock == 0) {
            outOfStock++;
          } else if (stock <= lowStockAlert) {
            lowStock++;
          }
        }

        final inStock = totalProducts - lowStock - outOfStock;

        return Padding(
          padding: EdgeInsets.symmetric(
            horizontal: Responsive.padding(context),
          ),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [AppTheme.primaryShadow],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildSummaryItem('Em Estoque', inStock, Colors.white),
                Container(
                  width: 1,
                  height: 40,
                  color: Colors.white.withOpacity(0.3),
                ),
                _buildSummaryItem('Baixo', lowStock, Colors.orange.shade200),
                Container(
                  width: 1,
                  height: 40,
                  color: Colors.white.withOpacity(0.3),
                ),
                _buildSummaryItem(
                    'Sem Estoque', outOfStock, Colors.red.shade200),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSummaryItem(String label, int count, Color color) {
    return Column(
      children: [
        Text(
          count.toString(),
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withOpacity(0.8),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String value, String label, IconData icon) {
    final isSelected = _filterOption == value;

    return GestureDetector(
      onTap: () => setState(() => _filterOption = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          gradient: isSelected ? AppTheme.primaryGradient : null,
          color: isSelected ? null : Colors.white,
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? AppTheme.primaryColor.withOpacity(0.3)
                  : Colors.grey.withOpacity(0.1),
              blurRadius: isSelected ? 8 : 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected ? Colors.white : Colors.grey.shade600,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.grey.shade700,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _getFilteredProducts(ProductsProvider products) {
    final allProducts = products.products;

    return allProducts.where((product) {
      final productId = product['id'];
      final name = (product['name'] ?? '').toString().toLowerCase();
      final sku = (product['sku'] ?? '').toString().toLowerCase();
      final stock = products.getProductStock(productId);
      final lowStockAlert = product['low_stock_alert'] ?? 10;

      // Filtro de busca
      if (_searchQuery.isNotEmpty) {
        if (!name.contains(_searchQuery) && !sku.contains(_searchQuery)) {
          return false;
        }
      }

      // Filtro de estoque
      switch (_filterOption) {
        case 'low':
          return stock > 0 && stock <= lowStockAlert;
        case 'out':
          return stock == 0;
        default:
          return true;
      }
    }).toList();
  }

  Widget _buildEmptyState() {
    String message;
    String subtitle;
    IconData icon;
    Color color;

    switch (_filterOption) {
      case 'low':
        message = 'Tudo em ordem!';
        subtitle = 'Nenhum produto com estoque baixo';
        icon = Icons.check_circle_rounded;
        color = Colors.green;
        break;
      case 'out':
        message = 'Ótimas notícias!';
        subtitle = 'Nenhum produto sem estoque';
        icon = Icons.check_circle_rounded;
        color = Colors.green;
        break;
      default:
        message = 'Nenhum produto encontrado';
        subtitle = 'Tente buscar com outros termos';
        icon = Icons.search_off_rounded;
        color = Colors.grey;
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 56, color: color),
          ),
          const SizedBox(height: 20),
          Text(
            message,
            style: AppTheme.headlineSmall.copyWith(
              color: Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: AppTheme.bodyMedium.copyWith(
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(
      Map<String, dynamic> product, ProductsProvider products) {
    final productId = product['id'];
    final name = product['name'] ?? '';
    final sku = product['sku'] ?? '';
    final stock = products.getProductStock(productId);
    final lowStockAlert = product['low_stock_alert'] ?? 10;
    final priceUnit = product['price_unit'] ?? product['priceUnit'] ?? 0;

    Color stockColor;
    String stockStatus;
    IconData stockIcon;
    Gradient? stockGradient;

    if (stock == 0) {
      stockColor = Colors.red;
      stockStatus = 'Sem Estoque';
      stockIcon = Icons.error_rounded;
      stockGradient = LinearGradient(
        colors: [Colors.red.shade400, Colors.red.shade600],
      );
    } else if (stock <= lowStockAlert) {
      stockColor = Colors.orange;
      stockStatus = 'Estoque Baixo';
      stockIcon = Icons.warning_rounded;
      stockGradient = LinearGradient(
        colors: [Colors.orange.shade400, Colors.orange.shade600],
      );
    } else {
      stockColor = Colors.green;
      stockStatus = 'Em Estoque';
      stockIcon = Icons.check_circle_rounded;
      stockGradient = AppTheme.successGradient;
    }

    // Categoria
    final categoryId = product['category_id'] ?? product['categoryId'];
    final category =
        categoryId != null ? products.getCategoryById(categoryId) : null;
    final categoryName = category?['name'] ?? 'Sem categoria';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showProductDetails(product, products),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Indicador de estoque
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: stockGradient,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: stockColor.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        stock.toString(),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const Text(
                        'un',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),

                // Info do produto
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: AppTheme.bodyLarge.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (sku.isNotEmpty)
                        Text(
                          'SKU: $sku',
                          style: AppTheme.bodySmall.copyWith(
                            color: Colors.grey.shade500,
                          ),
                        ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              categoryName,
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade700,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(stockIcon, size: 16, color: stockColor),
                          const SizedBox(width: 4),
                          Text(
                            stockStatus,
                            style: TextStyle(
                              fontSize: 12,
                              color: stockColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Preço
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      CurrencyHelper.format(priceUnit),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.successColor,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'por unidade',
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showProductDetails(
      Map<String, dynamic> product, ProductsProvider products) {
    final productId = product['id'];
    final name = product['name'] ?? '';
    final sku = product['sku'] ?? '';
    final stock = products.getProductStock(productId);
    final priceUnit = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final priceBox = product['price_box'] ?? product['priceBox'];
    final unitsPerBox = product['units_per_box'] ?? product['unitsPerBox'] ?? 1;
    final isMuntuEligible =
        product['is_muntu_eligible'] == 1 || product['isMuntuEligible'] == true;
    final muntuQuantity = product['muntu_quantity'] ?? product['muntuQuantity'];
    final muntuPrice = product['muntu_price'] ?? product['muntuPrice'];

    final categoryId = product['category_id'] ?? product['categoryId'];
    final category =
        categoryId != null ? products.getCategoryById(categoryId) : null;
    final categoryName = category?['name'] ?? 'Sem categoria';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Header
                Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [AppTheme.primaryShadow],
                      ),
                      child: const Icon(
                        Icons.local_drink_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: AppTheme.headlineSmall,
                          ),
                          if (sku.isNotEmpty)
                            Text(
                              'SKU: $sku',
                              style: AppTheme.bodyMedium.copyWith(
                                color: Colors.grey.shade500,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Detalhes em cards
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      _buildDetailRow(
                          'Categoria', categoryName, Icons.category_rounded),
                      const Divider(),
                      _buildDetailRow('Estoque Atual', '$stock unidades',
                          Icons.inventory_2_rounded),
                      const Divider(),
                      _buildDetailRow(
                        'Preço Unitário',
                        CurrencyHelper.format(priceUnit),
                        Icons.attach_money_rounded,
                      ),
                      if (priceBox != null) ...[
                        const Divider(),
                        _buildDetailRow(
                          'Preço Caixa ($unitsPerBox un)',
                          CurrencyHelper.format(priceBox),
                          Icons.inventory_rounded,
                        ),
                      ],
                    ],
                  ),
                ),

                if (isMuntuEligible &&
                    muntuQuantity != null &&
                    muntuPrice != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.orange.shade50,
                          Colors.orange.shade100,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade200,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.local_offer_rounded,
                            color: Colors.orange,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Promoção Muntu',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.orange,
                                  fontSize: 15,
                                ),
                              ),
                              Text(
                                '$muntuQuantity unidades por ${CurrencyHelper.format(muntuPrice)}',
                                style: TextStyle(color: Colors.grey.shade700),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: AppTheme.primaryColor,
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: AppTheme.bodyMedium.copyWith(
              color: Colors.grey.shade600,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: AppTheme.bodyMedium.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
