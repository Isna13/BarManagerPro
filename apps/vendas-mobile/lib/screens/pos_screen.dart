import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/cash_box_provider.dart';
import '../providers/products_provider.dart';
import '../providers/customers_provider.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';
import '../services/api_service.dart';
import '../utils/currency_helper.dart';
import '../utils/responsive_helper.dart';
import '../utils/app_theme.dart';
import '../utils/sale_logger.dart';
import 'package:uuid/uuid.dart';

class POSScreen extends StatefulWidget {
  const POSScreen({super.key});

  @override
  State<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends State<POSScreen> with TickerProviderStateMixin {
  final _uuid = const Uuid();
  final _searchController = TextEditingController();
  late AnimationController _fabAnimationController;

  List<Map<String, dynamic>> _cart = [];
  String? _selectedPaymentMethod;
  Map<String, dynamic>? _selectedCustomer;
  bool _showValeConfirmModal = false;
  Map<String, dynamic>? _valeConfirmData;

  // 🔴 CORREÇÃO CRÍTICA: Lock para evitar vendas duplicadas em cliques rápidos
  bool _isProcessingSale = false;

  @override
  void initState() {
    super.initState();
    _fabAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    // Carregar clientes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomersProvider>().loadCustomers();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _fabAnimationController.dispose();
    super.dispose();
  }

  int get _cartTotal {
    return _cart.fold(0, (sum, item) => sum + (item['total'] as int? ?? 0));
  }

  int get _cartItemCount {
    return _cart.fold(0, (sum, item) => sum + (item['quantity'] as int? ?? 0));
  }

  /// Calcula a economia total com vendas Muntu
  int get _muntuSavings {
    return _cart.fold(0, (sum, item) {
      if (item['isMuntu'] == true) {
        final normalPrice = (item['normalUnitPrice'] as int? ?? 0) *
            (item['quantity'] as int? ?? 0);
        final muntuPrice = item['total'] as int? ?? 0;
        return sum + (normalPrice - muntuPrice);
      }
      return sum;
    });
  }

  /// Verifica se há itens Muntu no carrinho
  bool get _hasMuntuItems {
    return _cart.any((item) => item['isMuntu'] == true);
  }

  @override
  Widget build(BuildContext context) {
    final isWideScreen = MediaQuery.of(context).size.width > 800;

    // Verificar se caixa está aberto
    final cashBox = context.watch<CashBoxProvider>();
    if (!cashBox.hasOpenCashBox) {
      return _buildNoCashBoxView();
    }

    // Animar FAB quando carrinho tem itens
    if (_cart.isNotEmpty) {
      _fabAnimationController.forward();
    } else {
      _fabAnimationController.reverse();
    }

    if (isWideScreen) {
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
        child: Row(
          children: [
            Expanded(flex: 2, child: _buildProductsGrid()),
            Container(
              width: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.grey.shade200,
                    Colors.grey.shade400,
                    Colors.grey.shade200,
                  ],
                ),
              ),
            ),
            Expanded(flex: 1, child: _buildCart()),
          ],
        ),
      );
    }

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
      child: Stack(
        children: [
          _buildProductsGrid(),
          if (_cart.isNotEmpty)
            Positioned(
              bottom: Responsive.padding(context),
              left: Responsive.padding(context),
              right: Responsive.padding(context),
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 1),
                  end: Offset.zero,
                ).animate(CurvedAnimation(
                  parent: _fabAnimationController,
                  curve: Curves.easeOutCubic,
                )),
                child: _buildCartFab(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildNoCashBoxView() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppTheme.primaryColor.withOpacity(0.1),
            Colors.white,
          ],
        ),
      ),
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(Responsive.padding(context)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.grey.shade100,
                      Colors.grey.shade200,
                    ],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.point_of_sale_rounded,
                  size: 80,
                  color: Colors.grey.shade400,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                'Caixa Fechado',
                style: AppTheme.headlineMedium.copyWith(
                  color: Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Abra o caixa para realizar vendas',
                style: AppTheme.bodyLarge.copyWith(
                  color: Colors.grey.shade500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              Container(
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [AppTheme.primaryShadow],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => Navigator.pushNamed(context, '/cash-box'),
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 16,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.lock_open, color: Colors.white),
                          SizedBox(width: 12),
                          Text(
                            'Ir para Caixa',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProductsGrid() {
    final padding = Responsive.padding(context);

    return Column(
      children: [
        // Search Bar Moderno
        Padding(
          padding: EdgeInsets.all(padding),
          child: Container(
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
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: Icon(
                          Icons.clear_rounded,
                          color: Colors.grey.shade400,
                        ),
                        onPressed: () {
                          _searchController.clear();
                          context.read<ProductsProvider>().setSearchQuery('');
                          setState(() {});
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
                context.read<ProductsProvider>().setSearchQuery(value);
                setState(() {});
              },
            ),
          ),
        ),

        // Categorias
        _buildCategoryFilter(),

        // Grid de produtos
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
                        'Carregando produtos...',
                        style: AppTheme.bodyMedium.copyWith(
                          color: Colors.grey.shade500,
                        ),
                      ),
                    ],
                  ),
                );
              }

              final filteredProducts = products.filteredProducts;

              if (filteredProducts.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.search_off_rounded,
                          size: 48,
                          color: Colors.grey.shade400,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Nenhum produto encontrado',
                        style: AppTheme.bodyLarge.copyWith(
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Tente buscar com outros termos',
                        style: AppTheme.bodyMedium.copyWith(
                          color: Colors.grey.shade400,
                        ),
                      ),
                    ],
                  ),
                );
              }

              return GridView.builder(
                padding: EdgeInsets.all(padding),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: Responsive.gridCrossAxisCount(context),
                  childAspectRatio: Responsive.isTablet(context) ? 0.75 : 0.65,
                  crossAxisSpacing: Responsive.spacing(context),
                  mainAxisSpacing: Responsive.spacing(context),
                ),
                itemCount: filteredProducts.length,
                itemBuilder: (context, index) {
                  return _buildProductCard(filteredProducts[index], products);
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryFilter() {
    return Consumer<ProductsProvider>(
      builder: (context, products, _) {
        return SizedBox(
          height: 48,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(
              horizontal: Responsive.padding(context),
            ),
            itemCount: products.categories.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _buildCategoryChip(
                    'Todos',
                    products.selectedCategoryId == null,
                    () => products.setSelectedCategory(null),
                  ),
                );
              }

              final category = products.categories[index - 1];
              final categoryId = category['id'];
              final categoryName = category['name'] ?? '';

              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _buildCategoryChip(
                  categoryName,
                  products.selectedCategoryId == categoryId,
                  () => products.setSelectedCategory(categoryId),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildCategoryChip(String label, bool isSelected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          gradient: isSelected ? AppTheme.primaryGradient : null,
          color: isSelected ? null : Colors.white,
          borderRadius: BorderRadius.circular(24),
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
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.grey.shade700,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildProductCard(
      Map<String, dynamic> product, ProductsProvider products) {
    final productId = product['id'];
    final name = product['name'] ?? '';
    final price = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final stock = products.getProductStock(productId);
    final isMuntuEligible =
        product['is_muntu_eligible'] == 1 || product['isMuntuEligible'] == true;
    final muntuQuantity =
        product['muntu_quantity'] ?? product['muntuQuantity'] ?? 0;
    final muntuPrice = product['muntu_price'] ?? product['muntuPrice'] ?? 0;

    // Verificar itens no carrinho (separando unitário e Muntu)
    final unitCartItem = _cart.firstWhere(
      (item) => item['productId'] == productId && item['isMuntu'] != true,
      orElse: () => {},
    );
    final muntuCartItem = _cart.firstWhere(
      (item) => item['productId'] == productId && item['isMuntu'] == true,
      orElse: () => {},
    );
    final totalCartQty =
        (unitCartItem.isNotEmpty ? (unitCartItem['quantity'] ?? 0) : 0) +
            (muntuCartItem.isNotEmpty ? (muntuCartItem['quantity'] ?? 0) : 0);
    final inCart = totalCartQty > 0;

    final outOfStock = stock <= 0;
    final lowStock = stock > 0 && stock <= 10;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: outOfStock ? Colors.grey.shade50 : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: inCart
            ? Border.all(color: AppTheme.primaryColor, width: 2)
            : outOfStock
                ? Border.all(color: Colors.red.shade200, width: 1)
                : lowStock
                    ? Border.all(color: Colors.orange.shade200, width: 1)
                    : null,
        boxShadow: [
          BoxShadow(
            color: inCart
                ? AppTheme.primaryColor.withOpacity(0.2)
                : Colors.grey.withOpacity(0.1),
            blurRadius: inCart ? 12 : 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header com nome e estoque
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: AppTheme.bodyMedium.copyWith(
                          fontWeight: FontWeight.w600,
                          color: outOfStock ? Colors.grey : Colors.black87,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: outOfStock
                              ? Colors.red.shade100
                              : lowStock
                                  ? Colors.orange.shade100
                                  : Colors.green.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          outOfStock
                              ? 'SEM ESTOQUE'
                              : lowStock
                                  ? 'Baixo: $stock'
                                  : '$stock un',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: outOfStock
                                ? Colors.red.shade700
                                : lowStock
                                    ? Colors.orange.shade700
                                    : Colors.green.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (inCart)
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      gradient: AppTheme.successGradient,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '$totalCartQty',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),

            const Spacer(),

            // Botão Unitário
            SizedBox(
              width: double.infinity,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: outOfStock
                      ? null
                      : () => _addToCart(product, products, isMuntu: false),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      gradient: outOfStock ? null : AppTheme.primaryGradient,
                      color: outOfStock ? Colors.grey.shade300 : null,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        Text(
                          'Unitário',
                          style: TextStyle(
                            fontSize: 10,
                            color: outOfStock
                                ? Colors.grey.shade600
                                : Colors.white70,
                          ),
                        ),
                        Text(
                          CurrencyHelper.format(price),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: outOfStock
                                ? Colors.grey.shade600
                                : Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Botão Muntu (se elegível)
            if (isMuntuEligible && muntuPrice > 0 && muntuQuantity > 0) ...[
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: (outOfStock || stock < muntuQuantity)
                        ? null
                        : () => _addToCart(product, products, isMuntu: true),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        gradient: (outOfStock || stock < muntuQuantity)
                            ? null
                            : AppTheme.successGradient,
                        color: (outOfStock || stock < muntuQuantity)
                            ? Colors.grey.shade300
                            : null,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.star_rounded,
                                size: 12,
                                color: (outOfStock || stock < muntuQuantity)
                                    ? Colors.grey.shade600
                                    : Colors.white70,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Muntu ($muntuQuantity un)',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: (outOfStock || stock < muntuQuantity)
                                      ? Colors.grey.shade600
                                      : Colors.white70,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            CurrencyHelper.format(muntuPrice),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: (outOfStock || stock < muntuQuantity)
                                  ? Colors.grey.shade600
                                  : Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCart() {
    final customersProvider = context.watch<CustomersProvider>();

    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryColor.withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.shopping_cart_rounded,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Carrinho',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                if (_cart.isNotEmpty)
                  TextButton.icon(
                    onPressed: () => setState(() {
                      _cart.clear();
                      _selectedCustomer = null;
                    }),
                    icon: const Icon(
                      Icons.delete_outline_rounded,
                      color: Colors.white70,
                      size: 18,
                    ),
                    label: const Text(
                      'Limpar',
                      style: TextStyle(color: Colors.white70),
                    ),
                  ),
              ],
            ),
          ),

          // Seleção de Cliente
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Colors.grey.shade200),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.person_outline,
                        size: 18, color: Colors.grey.shade600),
                    const SizedBox(width: 8),
                    Text(
                      'Cliente (opcional)',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () => _showCustomerSelector(customersProvider),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: _selectedCustomer != null
                          ? Border.all(color: AppTheme.primaryColor, width: 1.5)
                          : null,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _selectedCustomer != null
                              ? Icons.person
                              : Icons.shopping_cart,
                          size: 20,
                          color: _selectedCustomer != null
                              ? AppTheme.primaryColor
                              : Colors.grey.shade500,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _selectedCustomer != null
                                ? (_selectedCustomer!['name'] ??
                                    _selectedCustomer!['fullName'] ??
                                    'Cliente')
                                : 'Venda sem cliente',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: _selectedCustomer != null
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                              color: _selectedCustomer != null
                                  ? Colors.black87
                                  : Colors.grey.shade600,
                            ),
                          ),
                        ),
                        if (_selectedCustomer != null) ...[
                          // Mostrar crédito disponível
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.green.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              CurrencyHelper.format(
                                  customersProvider.getAvailableCredit(
                                      _selectedCustomer!['id'])),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Colors.green.shade700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () =>
                                setState(() => _selectedCustomer = null),
                            child: Icon(Icons.close,
                                size: 18, color: Colors.grey.shade500),
                          ),
                        ] else
                          Icon(Icons.arrow_drop_down,
                              color: Colors.grey.shade500),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Economia Muntu
          if (_hasMuntuItems && _muntuSavings > 0)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.green.shade50, Colors.green.shade100],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.green.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.savings_rounded,
                      color: Colors.green.shade700, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Economia Muntu',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.green.shade800,
                      ),
                    ),
                  ),
                  Text(
                    CurrencyHelper.format(_muntuSavings),
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.green.shade700,
                    ),
                  ),
                ],
              ),
            ),

          // Itens do carrinho
          Expanded(
            child: _cart.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.shopping_cart_outlined,
                            size: 48,
                            color: Colors.grey.shade400,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Carrinho vazio',
                          style: AppTheme.bodyLarge.copyWith(
                            color: Colors.grey.shade500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Toque nos produtos para adicionar',
                          style: AppTheme.bodyMedium.copyWith(
                            color: Colors.grey.shade400,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _cart.length,
                    itemBuilder: (context, index) => _buildCartItem(index),
                  ),
          ),

          // Total e botão de pagamento
          if (_cart.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.grey.withOpacity(0.15),
                    blurRadius: 20,
                    offset: const Offset(0, -5),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Total',
                            style: AppTheme.bodyMedium.copyWith(
                              color: Colors.grey.shade500,
                            ),
                          ),
                          Text(
                            '$_cartItemCount itens',
                            style: AppTheme.bodySmall.copyWith(
                              color: Colors.grey.shade400,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        CurrencyHelper.format(_cartTotal),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.successColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppTheme.successGradient,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.green.withOpacity(0.4),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => _showPaymentDialog(),
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(
                                  Icons.payment_rounded,
                                  color: Colors.white,
                                ),
                                SizedBox(width: 12),
                                Text(
                                  'Finalizar Venda',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
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
    );
  }

  Widget _buildCartItem(int index) {
    final item = _cart[index];
    final name = item['name'] ?? '';
    final quantity = item['quantity'] as int? ?? 1;
    final unitPrice = item['unitPrice'] as int? ?? 0;
    final total = item['total'] as int? ?? 0;
    final isMuntu = item['isMuntu'] == true;
    final muntuQuantity = item['muntuQuantity'] as int? ?? 1;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: isMuntu ? Colors.green.shade50 : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isMuntu ? Border.all(color: Colors.green.shade200) : null,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
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
                        name,
                        style: AppTheme.bodyMedium.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (isMuntu) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            gradient: AppTheme.successGradient,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.star_rounded,
                                  size: 12, color: Colors.white),
                              const SizedBox(width: 4),
                              Text(
                                'Pack Muntu (${quantity ~/ muntuQuantity}x$muntuQuantity)',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.delete_outline_rounded,
                      color: Colors.red.shade400,
                      size: 18,
                    ),
                  ),
                  onPressed: () {
                    setState(() => _cart.removeAt(index));
                  },
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Preço unitário e controles
            Row(
              children: [
                Text(
                  isMuntu
                      ? '${CurrencyHelper.format(item['muntuPrice'] ?? 0)}/pack'
                      : CurrencyHelper.format(unitPrice),
                  style: AppTheme.bodySmall.copyWith(
                    color: Colors.grey.shade500,
                  ),
                ),
                const Spacer(),
                // Controle de quantidade moderno
                Container(
                  decoration: BoxDecoration(
                    color:
                        isMuntu ? Colors.green.shade100 : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            final decrement = isMuntu ? muntuQuantity : 1;
                            _updateQuantity(index, quantity - decrement);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            child: Icon(
                              Icons.remove_rounded,
                              size: 18,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ),
                      ),
                      Container(
                        constraints: const BoxConstraints(minWidth: 40),
                        alignment: Alignment.center,
                        child: Text(
                          quantity.toString(),
                          style: AppTheme.bodyMedium.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            final increment = isMuntu ? muntuQuantity : 1;
                            _updateQuantity(index, quantity + increment);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              gradient: isMuntu
                                  ? AppTheme.successGradient
                                  : AppTheme.primaryGradient,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.add_rounded,
                              size: 18,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            // Total em linha separada
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                CurrencyHelper.format(total),
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: AppTheme.successColor,
                  fontSize: 18,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartFab() {
    return Container(
      decoration: BoxDecoration(
        gradient: AppTheme.successGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withOpacity(0.4),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showCartBottomSheet(),
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.shopping_cart_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 16),
                Text(
                  '$_cartItemCount itens',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    CurrencyHelper.format(_cartTotal),
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.successColor,
                      fontSize: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _addToCart(Map<String, dynamic> product, ProductsProvider products,
      {bool isMuntu = false}) {
    final productId = product['id'];
    final name = product['name'] ?? '';
    final normalPrice = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final stock = products.getProductStock(productId);

    // Dados Muntu
    final isMuntuEligible =
        product['is_muntu_eligible'] == 1 || product['isMuntuEligible'] == true;
    final muntuQuantity =
        product['muntu_quantity'] ?? product['muntuQuantity'] ?? 0;
    final muntuPrice = product['muntu_price'] ?? product['muntuPrice'] ?? 0;

    // Se é venda Muntu, verificar se tem estoque suficiente para o pack
    if (isMuntu && isMuntuEligible) {
      if (stock < muntuQuantity) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Estoque insuficiente para Pack Muntu ($muntuQuantity unidades)'),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
    }

    // Verificar item existente (separar Muntu de unitário)
    final existingIndex = _cart.indexWhere(
        (item) => item['productId'] == productId && item['isMuntu'] == isMuntu);

    setState(() {
      if (existingIndex >= 0) {
        final currentQty = _cart[existingIndex]['quantity'] as int? ?? 0;
        final increment = isMuntu ? muntuQuantity : 1;
        final newQty = currentQty + increment;

        if (newQty <= stock) {
          _cart[existingIndex]['quantity'] = newQty;
          if (isMuntu) {
            // Para Muntu, preço é por pack
            final packCount = newQty ~/ muntuQuantity;
            _cart[existingIndex]['total'] = muntuPrice * packCount;
          } else {
            _cart[existingIndex]['total'] = normalPrice * newQty;
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Estoque insuficiente'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      } else {
        if (isMuntu && isMuntuEligible) {
          // Adicionar pack Muntu
          _cart.add({
            'id': _uuid.v4(),
            'productId': productId,
            'name': name,
            'quantity': muntuQuantity,
            'unitPrice':
                muntuPrice ~/ muntuQuantity, // Preço por unidade no pack
            'normalUnitPrice':
                normalPrice, // Preço normal para calcular economia
            'muntuQuantity': muntuQuantity,
            'muntuPrice': muntuPrice,
            'total': muntuPrice,
            'isMuntu': true,
          });
        } else {
          // Adicionar unidade normal
          _cart.add({
            'id': _uuid.v4(),
            'productId': productId,
            'name': name,
            'quantity': 1,
            'unitPrice': normalPrice,
            'normalUnitPrice': normalPrice,
            'total': normalPrice,
            'isMuntu': false,
          });
        }
      }
    });
  }

  void _updateQuantity(int index, int newQuantity) {
    if (newQuantity <= 0) {
      setState(() => _cart.removeAt(index));
      return;
    }

    final item = _cart[index];
    final isMuntu = item['isMuntu'] == true;

    setState(() {
      if (isMuntu) {
        // Para Muntu, quantidade deve ser múltiplo do pack
        final muntuQty = item['muntuQuantity'] as int? ?? 1;
        final muntuPrice = item['muntuPrice'] as int? ?? 0;
        final packCount = newQuantity ~/ muntuQty;
        if (packCount > 0) {
          _cart[index]['quantity'] = packCount * muntuQty;
          _cart[index]['total'] = muntuPrice * packCount;
        } else {
          _cart.removeAt(index);
        }
      } else {
        final unitPrice = _cart[index]['unitPrice'] as int? ?? 0;
        _cart[index]['quantity'] = newQuantity;
        _cart[index]['total'] = unitPrice * newQuantity;
      }
    });
  }

  void _showCartBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => StatefulBuilder(
          builder: (context, setModalState) {
            final customersProvider = this.context.watch<CustomersProvider>();

            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 12),
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  // Header do carrinho
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: AppTheme.primaryGradient,
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.shopping_cart,
                              color: Colors.white),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Carrinho',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        if (_cart.isNotEmpty)
                          TextButton.icon(
                            onPressed: () {
                              setState(() => _cart.clear());
                              setModalState(() {});
                            },
                            icon: const Icon(Icons.delete_outline,
                                color: Colors.white70, size: 18),
                            label: const Text('Limpar',
                                style: TextStyle(color: Colors.white70)),
                          ),
                      ],
                    ),
                  ),

                  // Seletor de cliente
                  Container(
                    padding: const EdgeInsets.all(12),
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(ctx);
                        _showCustomerSelector(customersProvider);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(12),
                          border: _selectedCustomer != null
                              ? Border.all(
                                  color: AppTheme.primaryColor, width: 1.5)
                              : null,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _selectedCustomer != null
                                  ? Icons.person
                                  : Icons.shopping_cart,
                              size: 20,
                              color: _selectedCustomer != null
                                  ? AppTheme.primaryColor
                                  : Colors.grey.shade500,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _selectedCustomer != null
                                    ? (_selectedCustomer!['name'] ??
                                        _selectedCustomer!['fullName'] ??
                                        'Cliente')
                                    : 'Venda sem cliente',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: _selectedCustomer != null
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: _selectedCustomer != null
                                      ? Colors.black87
                                      : Colors.grey.shade600,
                                ),
                              ),
                            ),
                            Icon(Icons.arrow_drop_down,
                                color: Colors.grey.shade500),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Itens do carrinho
                  Expanded(
                    child: _cart.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.shopping_cart_outlined,
                                    size: 48, color: Colors.grey.shade400),
                                const SizedBox(height: 16),
                                Text('Carrinho vazio',
                                    style:
                                        TextStyle(color: Colors.grey.shade500)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.all(12),
                            itemCount: _cart.length,
                            itemBuilder: (context, index) {
                              final item = _cart[index];
                              final name = item['name'] ?? '';
                              final quantity = item['quantity'] as int? ?? 1;
                              final unitPrice = item['unitPrice'] as int? ?? 0;
                              final total = item['total'] as int? ?? 0;
                              final isMuntu = item['isMuntu'] == true;
                              final muntuQuantity =
                                  item['muntuQuantity'] as int? ?? 1;

                              return Container(
                                margin: const EdgeInsets.symmetric(vertical: 6),
                                decoration: BoxDecoration(
                                  color: isMuntu
                                      ? Colors.green.shade50
                                      : Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                  border: isMuntu
                                      ? Border.all(color: Colors.green.shade200)
                                      : null,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.grey.withOpacity(0.1),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  name,
                                                  style: AppTheme.bodyMedium
                                                      .copyWith(
                                                          fontWeight:
                                                              FontWeight.w600),
                                                ),
                                                if (isMuntu) ...[
                                                  const SizedBox(height: 4),
                                                  Container(
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 8,
                                                        vertical: 2),
                                                    decoration: BoxDecoration(
                                                      gradient: AppTheme
                                                          .successGradient,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              8),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      children: [
                                                        const Icon(
                                                            Icons.star_rounded,
                                                            size: 12,
                                                            color:
                                                                Colors.white),
                                                        const SizedBox(
                                                            width: 4),
                                                        Text(
                                                          'Pack Muntu (${quantity ~/ muntuQuantity}x$muntuQuantity)',
                                                          style:
                                                              const TextStyle(
                                                                  fontSize: 10,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w600,
                                                                  color: Colors
                                                                      .white),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                          IconButton(
                                            icon: Container(
                                              padding: const EdgeInsets.all(6),
                                              decoration: BoxDecoration(
                                                color: Colors.red.shade50,
                                                borderRadius:
                                                    BorderRadius.circular(8),
                                              ),
                                              child: Icon(
                                                  Icons.delete_outline_rounded,
                                                  color: Colors.red.shade400,
                                                  size: 18),
                                            ),
                                            onPressed: () {
                                              setState(
                                                  () => _cart.removeAt(index));
                                              setModalState(() {});
                                            },
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Text(
                                            isMuntu
                                                ? '${CurrencyHelper.format(item['muntuPrice'] ?? 0)}/pack'
                                                : CurrencyHelper.format(
                                                    unitPrice),
                                            style: AppTheme.bodySmall.copyWith(
                                                color: Colors.grey.shade500),
                                          ),
                                          const Spacer(),
                                          // Controle de quantidade
                                          Container(
                                            decoration: BoxDecoration(
                                              color: isMuntu
                                                  ? Colors.green.shade100
                                                  : Colors.grey.shade100,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Material(
                                                  color: Colors.transparent,
                                                  child: InkWell(
                                                    onTap: () {
                                                      final decrement = isMuntu
                                                          ? muntuQuantity
                                                          : 1;
                                                      final newQty =
                                                          quantity - decrement;
                                                      if (newQty <= 0) {
                                                        setState(() => _cart
                                                            .removeAt(index));
                                                      } else {
                                                        setState(() {
                                                          _cart[index]
                                                                  ['quantity'] =
                                                              newQty;
                                                          _cart[index]['total'] = isMuntu
                                                              ? (newQty ~/
                                                                      muntuQuantity) *
                                                                  (item['muntuPrice']
                                                                          as int? ??
                                                                      0)
                                                              : newQty *
                                                                  unitPrice;
                                                        });
                                                      }
                                                      setModalState(() {});
                                                    },
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            12),
                                                    child: Container(
                                                      padding:
                                                          const EdgeInsets.all(
                                                              8),
                                                      child: Icon(
                                                          Icons.remove_rounded,
                                                          size: 18,
                                                          color: Colors
                                                              .grey.shade700),
                                                    ),
                                                  ),
                                                ),
                                                Container(
                                                  constraints:
                                                      const BoxConstraints(
                                                          minWidth: 40),
                                                  alignment: Alignment.center,
                                                  child: Text(
                                                    quantity.toString(),
                                                    style: AppTheme.bodyMedium
                                                        .copyWith(
                                                            fontWeight:
                                                                FontWeight
                                                                    .bold),
                                                  ),
                                                ),
                                                Material(
                                                  color: Colors.transparent,
                                                  child: InkWell(
                                                    onTap: () {
                                                      final increment = isMuntu
                                                          ? muntuQuantity
                                                          : 1;
                                                      final newQty =
                                                          quantity + increment;
                                                      setState(() {
                                                        _cart[index]
                                                                ['quantity'] =
                                                            newQty;
                                                        _cart[index]['total'] = isMuntu
                                                            ? (newQty ~/
                                                                    muntuQuantity) *
                                                                (item['muntuPrice']
                                                                        as int? ??
                                                                    0)
                                                            : newQty *
                                                                unitPrice;
                                                      });
                                                      setModalState(() {});
                                                    },
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            12),
                                                    child: Container(
                                                      padding:
                                                          const EdgeInsets.all(
                                                              8),
                                                      decoration: BoxDecoration(
                                                        gradient: isMuntu
                                                            ? AppTheme
                                                                .successGradient
                                                            : AppTheme
                                                                .primaryGradient,
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(12),
                                                      ),
                                                      child: const Icon(
                                                          Icons.add_rounded,
                                                          size: 18,
                                                          color: Colors.white),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      // Total em linha separada
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: Text(
                                          CurrencyHelper.format(total),
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.successColor,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),

                  // Total e botão de pagamento
                  if (_cart.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(24)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.grey.withOpacity(0.15),
                            blurRadius: 20,
                            offset: const Offset(0, -5),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Total',
                                      style: AppTheme.bodyMedium.copyWith(
                                          color: Colors.grey.shade500)),
                                  Text('$_cartItemCount itens',
                                      style: AppTheme.bodySmall.copyWith(
                                          color: Colors.grey.shade400)),
                                ],
                              ),
                              Text(
                                CurrencyHelper.format(_cartTotal),
                                style: TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.successColor),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: AppTheme.successGradient,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.green.withOpacity(0.4),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () {
                                    Navigator.pop(ctx);
                                    _showPaymentDialog();
                                  },
                                  borderRadius: BorderRadius.circular(16),
                                  child: const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 18),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.payment_rounded,
                                            color: Colors.white),
                                        SizedBox(width: 12),
                                        Text(
                                          'Finalizar Venda',
                                          style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 16,
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
            );
          },
        ),
      ),
    );
  }

  Future<void> _showPaymentDialog() async {
    _selectedPaymentMethod = null;
    final customersProvider = context.read<CustomersProvider>();

    final result = await showDialog<String>(
      context: context,
      barrierColor: Colors.black54,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          // Verificar se Vale é permitido
          final canUseVale = _selectedCustomer != null &&
              customersProvider.canUseVale(
                  _selectedCustomer!['id'], _cartTotal);
          final availableCredit = _selectedCustomer != null
              ? customersProvider.getAvailableCredit(_selectedCustomer!['id'])
              : 0;

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
                  // Header com gradiente
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        vertical: 20, horizontal: 24),
                    decoration: BoxDecoration(
                      gradient: AppTheme.primaryGradient,
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
                        // Total no header
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
                                  fontSize: 16,
                                ),
                              ),
                              Text(
                                CurrencyHelper.format(_cartTotal),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (_muntuSavings > 0) ...[
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.savings_rounded,
                                  size: 14, color: Colors.greenAccent),
                              const SizedBox(width: 4),
                              Text(
                                'Economia: ${CurrencyHelper.format(_muntuSavings)}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.greenAccent,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Corpo do modal
                  Container(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        // Cliente selecionado (se houver)
                        if (_selectedCustomer != null) ...[
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
                                        _selectedCustomer!['name'] ?? 'Cliente',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: Colors.blue.shade900,
                                          fontSize: 14,
                                        ),
                                        overflow: TextOverflow.ellipsis,
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

                        // Título das opções
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

                        // Grid de opções de pagamento (2x3)
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 3,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.0,
                          children: [
                            _buildPaymentOptionCard(
                              'cash',
                              'Dinheiro',
                              Icons.payments_rounded,
                              Colors.green,
                              setDialogState,
                            ),
                            _buildPaymentOptionCard(
                              'orange',
                              'Orange',
                              Icons.phone_android_rounded,
                              Colors.orange,
                              setDialogState,
                            ),
                            _buildPaymentOptionCard(
                              'teletaku',
                              'TeleTaku',
                              Icons.smartphone_rounded,
                              Colors.purple,
                              setDialogState,
                            ),
                            _buildPaymentOptionCard(
                              'vale',
                              'Vale',
                              Icons.receipt_long_rounded,
                              Colors.amber.shade700,
                              setDialogState,
                              enabled: _selectedCustomer != null,
                            ),
                            _buildPaymentOptionCard(
                              'mixed',
                              'Misto',
                              Icons.credit_card_rounded,
                              Colors.teal,
                              setDialogState,
                            ),
                          ],
                        ),

                        // Aviso de crédito insuficiente para Vale
                        if (_selectedPaymentMethod == 'vale' &&
                            _selectedCustomer != null &&
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
                            _selectedCustomer == null) ...[
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
                                    'Selecione um cliente para usar Vale',
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
                        // Botão Cancelar
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(ctx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              side: BorderSide(color: Colors.grey.shade300),
                            ),
                            child: Text(
                              'Cancelar',
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Botão Confirmar
                        Expanded(
                          flex: 2,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            decoration: BoxDecoration(
                              gradient: (_selectedPaymentMethod != null &&
                                      !(_selectedPaymentMethod == 'vale' &&
                                          !canUseVale))
                                  ? AppTheme.successGradient
                                  : LinearGradient(colors: [
                                      Colors.grey.shade300,
                                      Colors.grey.shade400
                                    ]),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: (_selectedPaymentMethod != null &&
                                      !(_selectedPaymentMethod == 'vale' &&
                                          !canUseVale))
                                  ? [
                                      BoxShadow(
                                        color: Colors.green.withOpacity(0.4),
                                        blurRadius: 8,
                                        offset: const Offset(0, 3),
                                      )
                                    ]
                                  : null,
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: (_selectedPaymentMethod != null &&
                                        !(_selectedPaymentMethod == 'vale' &&
                                            !canUseVale))
                                    ? () {
                                        if (_selectedPaymentMethod == 'vale') {
                                          Navigator.pop(ctx);
                                          _showValeConfirmation();
                                        } else {
                                          Navigator.pop(
                                              ctx, _selectedPaymentMethod);
                                        }
                                      }
                                    : null,
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 14),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.check_circle_rounded,
                                        color:
                                            (_selectedPaymentMethod != null &&
                                                    !(_selectedPaymentMethod ==
                                                            'vale' &&
                                                        !canUseVale))
                                                ? Colors.white
                                                : Colors.white70,
                                        size: 20,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Confirmar',
                                        style: TextStyle(
                                          color: (_selectedPaymentMethod !=
                                                      null &&
                                                  !(_selectedPaymentMethod ==
                                                          'vale' &&
                                                      !canUseVale))
                                              ? Colors.white
                                              : Colors.white70,
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                        ),
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

    if (result != null) {
      await _processSale(result);
    }
  }

  Widget _buildPaymentOptionCard(
    String value,
    String label,
    IconData icon,
    Color color,
    StateSetter setDialogState, {
    bool enabled = true,
  }) {
    final isSelected = _selectedPaymentMethod == value;
    final isDisabled = !enabled && value == 'vale';

    return GestureDetector(
      onTap: enabled || value != 'vale'
          ? () => setDialogState(() => _selectedPaymentMethod = value)
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [color, color.withOpacity(0.7)],
                )
              : null,
          color: isSelected
              ? null
              : (isDisabled ? Colors.grey.shade100 : Colors.grey.shade50),
          border: Border.all(
            color: isSelected ? color : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  )
                ]
              : null,
        ),
        child: Stack(
          children: [
            // Conteúdo principal
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Colors.white.withOpacity(0.2)
                          : color.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      icon,
                      color: isSelected ? Colors.white : color,
                      size: 24,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.w600,
                      color: isSelected
                          ? Colors.white
                          : (isDisabled
                              ? Colors.grey.shade400
                              : Colors.grey.shade700),
                    ),
                  ),
                ],
              ),
            ),
            // Ícone de selecionado
            if (isSelected)
              Positioned(
                top: 4,
                right: 4,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.check_circle,
                    color: color,
                    size: 14,
                  ),
                ),
              ),
            // Indicador de desabilitado
            if (isDisabled)
              Positioned(
                bottom: 4,
                left: 0,
                right: 0,
                child: Text(
                  'Requer cliente',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 8,
                    color: Colors.grey.shade500,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // Manter o método antigo para compatibilidade (pode ser removido depois)
  Widget _buildPaymentOption(
      String value, String label, IconData icon, StateSetter setDialogState,
      {Color? color, bool enabled = true, String? subtitle}) {
    final isSelected = _selectedPaymentMethod == value;
    final effectiveColor = color ?? AppTheme.primaryColor;

    return GestureDetector(
      onTap: enabled
          ? () => setDialogState(() => _selectedPaymentMethod = value)
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 90,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  colors: [effectiveColor, effectiveColor.withOpacity(0.8)])
              : null,
          color: isSelected
              ? null
              : (enabled ? Colors.grey.shade100 : Colors.grey.shade200),
          border: Border.all(
            color: isSelected ? effectiveColor : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                      color: effectiveColor.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4))
                ]
              : null,
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Colors.grey.shade600,
              size: 28,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey.shade700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCustomerSelector(CustomersProvider customersProvider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) => DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) => Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  width: 48,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        'Selecionar Cliente',
                        style: AppTheme.headlineMedium,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        decoration: InputDecoration(
                          hintText: 'Buscar cliente...',
                          prefixIcon: const Icon(Icons.search),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                        ),
                        onChanged: (value) {
                          customersProvider.setSearchQuery(value);
                          setSheetState(() {});
                        },
                      ),
                    ],
                  ),
                ),
                // Opção sem cliente
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child:
                        Icon(Icons.shopping_cart, color: Colors.grey.shade600),
                  ),
                  title: const Text('Venda sem cliente'),
                  subtitle: const Text('Não associar a um cliente'),
                  trailing: _selectedCustomer == null
                      ? Icon(Icons.check_circle, color: AppTheme.primaryColor)
                      : null,
                  onTap: () {
                    setState(() => _selectedCustomer = null);
                    Navigator.pop(ctx);
                  },
                ),
                const Divider(),
                Expanded(
                  child: customersProvider.isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : customersProvider.filteredCustomers.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.people_outline,
                                      size: 48, color: Colors.grey.shade400),
                                  const SizedBox(height: 16),
                                  Text('Nenhum cliente encontrado',
                                      style: TextStyle(
                                          color: Colors.grey.shade500)),
                                ],
                              ),
                            )
                          : ListView.builder(
                              controller: scrollController,
                              itemCount:
                                  customersProvider.filteredCustomers.length,
                              itemBuilder: (context, index) {
                                final customer =
                                    customersProvider.filteredCustomers[index];
                                final isSelected =
                                    _selectedCustomer?['id'] == customer['id'];
                                final availableCredit = customersProvider
                                    .getAvailableCredit(customer['id']);

                                return ListTile(
                                  leading: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      gradient: isSelected
                                          ? AppTheme.primaryGradient
                                          : null,
                                      color: isSelected
                                          ? null
                                          : Colors.blue.shade100,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      Icons.person,
                                      color: isSelected
                                          ? Colors.white
                                          : Colors.blue.shade700,
                                    ),
                                  ),
                                  title: Text(
                                    customer['name'] ?? 'Cliente',
                                    style: TextStyle(
                                      fontWeight: isSelected
                                          ? FontWeight.bold
                                          : FontWeight.normal,
                                    ),
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (customer['phone'] != null &&
                                          customer['phone']
                                              .toString()
                                              .isNotEmpty)
                                        Text(customer['phone'],
                                            style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey.shade600)),
                                      const SizedBox(height: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Colors.green.shade100,
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          'Crédito: ${CurrencyHelper.format(availableCredit)}',
                                          style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.green.shade700,
                                              fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                    ],
                                  ),
                                  trailing: isSelected
                                      ? Icon(Icons.check_circle,
                                          color: AppTheme.primaryColor)
                                      : null,
                                  onTap: () {
                                    setState(
                                        () => _selectedCustomer = customer);
                                    Navigator.pop(ctx);
                                  },
                                );
                              },
                            ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showValeConfirmation() {
    if (_selectedCustomer == null) return;

    final customersProvider = context.read<CustomersProvider>();
    final availableCredit =
        customersProvider.getAvailableCredit(_selectedCustomer!['id']);
    final remainingAfter = availableCredit - _cartTotal;

    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 400,
            maxHeight: MediaQuery.of(ctx).size.height * 0.85,
          ),
          child: SingleChildScrollView(
            child: Container(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        vertical: 16, horizontal: 20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        Colors.amber.shade500,
                        Colors.amber.shade600
                      ]),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.receipt_long_rounded,
                            color: Colors.white, size: 26),
                        SizedBox(width: 10),
                        Flexible(
                          child: Text('Confirmar Vale',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Informações do cliente
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
                        Icon(Icons.person,
                            color: Colors.blue.shade700, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Cliente',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.blue.shade600)),
                              Text(
                                _selectedCustomer!['name'] ?? 'Cliente',
                                style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.blue.shade900),
                                overflow: TextOverflow.ellipsis,
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
                    padding: const EdgeInsets.symmetric(
                        vertical: 16, horizontal: 14),
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
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            CurrencyHelper.format(_cartTotal),
                            style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                                color: Colors.green.shade700),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Crédito disponível e restante
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
                                      fontSize: 11,
                                      color: Colors.grey.shade600),
                                  textAlign: TextAlign.center),
                              const SizedBox(height: 6),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  CurrencyHelper.format(availableCredit),
                                  style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold),
                                ),
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
                                      fontSize: 11,
                                      color: Colors.amber.shade700),
                                  textAlign: TextAlign.center),
                              const SizedBox(height: 6),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  CurrencyHelper.format(remainingAfter),
                                  style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.amber.shade800),
                                ),
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
                          onPressed: () => Navigator.pop(ctx),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Cancelar',
                              style: TextStyle(fontSize: 14)),
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
                              onTap: () {
                                Navigator.pop(ctx);
                                _processSale('vale');
                              },
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
                                    Flexible(
                                      child: Text('Confirmar Vale',
                                          style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold),
                                          overflow: TextOverflow.ellipsis),
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
        ),
      ),
    );
  }

  Future<void> _processSale(String paymentMethod) async {
    // 🔴 CORREÇÃO CRÍTICA: Evitar vendas duplicadas em cliques rápidos
    if (_isProcessingSale) {
      debugPrint(
          '⚠️ [PROTEÇÃO] Venda já em processamento, ignorando clique duplicado');
      return;
    }

    // Validar carrinho antes de qualquer operação
    if (_cart.isEmpty) {
      debugPrint('⚠️ [PROTEÇÃO] Carrinho vazio, ignorando venda');
      return;
    }

    setState(() => _isProcessingSale = true);

    final auth = context.read<AuthProvider>();
    final cashBox = context.read<CashBoxProvider>();
    final customersProvider = context.read<CustomersProvider>();
    final productsProvider = context.read<ProductsProvider>();
    final db = DatabaseService.instance;
    final sync = SyncService.instance;
    final logger = SaleLogger.instance;

    // Salvar valores antes de limpar o carrinho
    final saleTotal = _cartTotal;
    final savings = _muntuSavings;
    final customerId = _selectedCustomer?['id'];
    // Salvar cópia do carrinho para atualizar estoque
    final cartItems = List<Map<String, dynamic>>.from(_cart);

    // LOG: Estado do carrinho antes da venda
    logger.logCartState(cartItems);

    try {
      final saleId = _uuid.v4();
      final now = DateTime.now().toIso8601String();
      final saleNumber =
          'V${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}';

      // LOG: Registrar a venda
      await logger.logSale(
        saleId: saleId,
        saleNumber: saleNumber,
        cartItems: cartItems,
        paymentMethod: paymentMethod,
        total: saleTotal,
        customerId: customerId,
      );

      // Obter branchId do caixa (mais confiável que do usuário)
      final branchId = cashBox.currentCashBox?['branch_id'] ??
          cashBox.currentCashBox?['branchId'] ??
          auth.branchId ??
          'main-branch';

      // 🔴 CORREÇÃO CRÍTICA: Criar venda de forma ATÔMICA (transacional)
      // Isso garante que venda + itens são salvos juntos ou nenhum é salvo
      final saleData = {
        'id': saleId,
        'sale_number': saleNumber,
        'branch_id': branchId,
        'type': 'counter',
        'cashier_id': auth.userId ?? '',
        'customer_id': customerId,
        'status': 'completed',
        'subtotal': saleTotal,
        'total': saleTotal,
        'payment_method': paymentMethod,
        'payment_status': (paymentMethod == 'vale' || paymentMethod == 'debt')
            ? 'pending'
            : 'paid',
        'created_at': now,
        'synced': 0,
      };

      // Preparar itens da venda
      final saleItems = cartItems
          .map((item) => {
                'id': _uuid.v4(),
                'sale_id': saleId,
                'product_id': item['productId'],
                'qty_units': item['quantity'],
                'unit_price': item['unitPrice'],
                'total': item['total'],
                'is_muntu': item['isMuntu'] == true ? 1 : 0,
                'created_at': now,
                'synced': 0,
              })
          .toList();

      // 🔴 Criar venda atomicamente (transacional) - inclui adição à fila de sync
      await db.createSaleAtomically(
        saleData: saleData,
        saleItems: saleItems,
      );

      // ATUALIZAR ESTOQUE - Decrementar quantidade de cada produto vendido
      await productsProvider.decrementStockForSale(cartItems);

      // Atualizar totais do caixa baseado no método de pagamento
      if (paymentMethod == 'cash') {
        await cashBox.updateCashBoxTotals(cashAmount: saleTotal);
      } else if (paymentMethod == 'orange' || paymentMethod == 'teletaku') {
        await cashBox.updateCashBoxTotals(mobileMoneyAmount: saleTotal);
      } else if (paymentMethod == 'mixed') {
        await cashBox.updateCashBoxTotals(cardAmount: saleTotal);
      } else if (paymentMethod == 'vale' || paymentMethod == 'debt') {
        await cashBox.updateCashBoxTotals(debtAmount: saleTotal);

        // ═══════════════════════════════════════════════════════════════════
        // 🚫 REMOVIDO: Chamada a updateCustomerDebt causava DUPLICAÇÃO!
        //
        // CAUSA RAIZ DO BUG:
        // 1. createSaleAtomically() cria Sale com payment_method='vale'
        // 2. Sale é sincronizada → Backend cria Debt automaticamente
        // 3. updateCustomerDebt() chamava _api.createDebt() → Backend criava OUTRO Debt
        // 4. RESULTADO: 2 debts para a mesma venda
        //
        // SOLUÇÃO: O backend já cria o Debt em sales.service.ts quando recebe
        // uma Sale com paymentMethod='VALE'. Não devemos criar aqui também.
        //
        // O currentDebt do cliente será atualizado quando sincronizar.
        // ═══════════════════════════════════════════════════════════════════
        if (paymentMethod == 'vale' && customerId != null) {
          debugPrint('💳 [VALE] Venda com payment_method=vale');
          debugPrint('   Debt será criado automaticamente pelo backend');
          debugPrint('   Cliente: $customerId');
          debugPrint('   Valor: $saleTotal');
          debugPrint('   SaleId: $saleId');
        }
      }

      // Incrementar contador de vendas do caixa
      cashBox.incrementSalesCount();

      // Adicionar pontos de fidelidade (se há cliente e não é Vale/Fiado)
      Map<String, int>? loyaltyResult;
      if (customerId != null &&
          paymentMethod != 'vale' &&
          paymentMethod != 'debt') {
        loyaltyResult =
            await customersProvider.addLoyaltyPoints(customerId, saleTotal);
      }

      // 🔴 CORREÇÃO: markForSync já foi chamado dentro de createSaleAtomically()
      // Agora apenas disparar sincronização imediata se online
      if (sync.isOnline) {
        sync.syncSalesImmediately();
      }

      // Limpar carrinho e cliente selecionado
      setState(() {
        _cart.clear();
        _selectedCustomer = null;
      });

      // Construir mensagem de sucesso
      String message = 'Venda $saleNumber realizada com sucesso!';
      if (savings > 0) {
        message += '\nEconomia Muntu: ${CurrencyHelper.format(savings)}';
      }
      if (loyaltyResult != null) {
        final pointsAdded = loyaltyResult['added'] ?? 0;
        final totalPoints = loyaltyResult['total'] ?? 0;
        message +=
            '\n🎉 +$pointsAdded ponto${pointsAdded > 1 ? 's' : ''} fidelidade! Total: $totalPoints';
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 5),
          ),
        );

        // Fechar bottom sheet se estiver aberto
        if (Navigator.canPop(context)) {
          Navigator.pop(context);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao processar venda: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      // 🔴 CORREÇÃO CRÍTICA: Sempre liberar o lock, mesmo em caso de erro
      if (mounted) {
        setState(() => _isProcessingSale = false);
      }
    }
  }
}
