import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/cash_box_provider.dart';
import '../providers/products_provider.dart';
import '../services/database_service.dart';
import '../services/sync_service.dart';
import '../utils/currency_helper.dart';
import '../utils/responsive_helper.dart';
import '../utils/app_theme.dart';
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

  @override
  void initState() {
    super.initState();
    _fabAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
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
                  childAspectRatio: Responsive.isTablet(context) ? 0.9 : 0.85,
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

    final inCart = _cart.any((item) => item['productId'] == productId);
    final cartItem = _cart.firstWhere(
      (item) => item['productId'] == productId,
      orElse: () => {},
    );
    final cartQty = cartItem.isNotEmpty ? (cartItem['quantity'] ?? 0) : 0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border:
            inCart ? Border.all(color: AppTheme.primaryColor, width: 2) : null,
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: stock > 0 ? () => _addToCart(product, products) : null,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Ícone ou imagem com badge de quantidade
                Stack(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: stock > 0
                            ? AppTheme.primaryGradient
                            : LinearGradient(
                                colors: [
                                  Colors.grey.shade300,
                                  Colors.grey.shade400,
                                ],
                              ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: stock > 0
                                ? AppTheme.primaryColor.withOpacity(0.3)
                                : Colors.grey.withOpacity(0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.local_drink_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    if (inCart)
                      Positioned(
                        right: -4,
                        top: -4,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            gradient: AppTheme.successGradient,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.green.withOpacity(0.4),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                          child: Text(
                            '$cartQty',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                // Nome
                Expanded(
                  child: Text(
                    name,
                    style: AppTheme.bodyMedium.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),

                // Preço e estoque
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        CurrencyHelper.format(price),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.successColor,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        gradient: stock > 0
                            ? LinearGradient(
                                colors: [
                                  Colors.green.shade50,
                                  Colors.green.shade100,
                                ],
                              )
                            : LinearGradient(
                                colors: [
                                  Colors.red.shade50,
                                  Colors.red.shade100,
                                ],
                              ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        stock > 0 ? '$stock' : 'Sem estoque',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: stock > 0 ? Colors.green.shade700 : Colors.red,
                        ),
                      ),
                    ),
                  ],
                ),

                if (isMuntuEligible) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.orange.shade100,
                          Colors.orange.shade200,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(
                          Icons.star_rounded,
                          size: 12,
                          color: Colors.orange,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Muntu',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.orange,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCart() {
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
                    onPressed: () => setState(() => _cart.clear()),
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

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
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
                  child: Text(
                    name,
                    style: AppTheme.bodyMedium.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
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
            Row(
              children: [
                Text(
                  CurrencyHelper.format(unitPrice),
                  style: AppTheme.bodySmall.copyWith(
                    color: Colors.grey.shade500,
                  ),
                ),
                const Spacer(),
                // Controle de quantidade moderno
                Container(
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => _updateQuantity(index, quantity - 1),
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
                          onTap: () => _updateQuantity(index, quantity + 1),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              gradient: AppTheme.primaryGradient,
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
                const SizedBox(width: 16),
                Text(
                  CurrencyHelper.format(total),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.successColor,
                    fontSize: 15,
                  ),
                ),
              ],
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

  void _addToCart(Map<String, dynamic> product, ProductsProvider products) {
    final productId = product['id'];
    final name = product['name'] ?? '';
    final price = product['price_unit'] ?? product['priceUnit'] ?? 0;
    final stock = products.getProductStock(productId);

    final existingIndex =
        _cart.indexWhere((item) => item['productId'] == productId);

    setState(() {
      if (existingIndex >= 0) {
        final currentQty = _cart[existingIndex]['quantity'] as int? ?? 1;
        if (currentQty < stock) {
          _cart[existingIndex]['quantity'] = currentQty + 1;
          _cart[existingIndex]['total'] = price * (currentQty + 1);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Estoque insuficiente'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      } else {
        _cart.add({
          'id': _uuid.v4(),
          'productId': productId,
          'name': name,
          'quantity': 1,
          'unitPrice': price,
          'total': price,
        });
      }
    });
  }

  void _updateQuantity(int index, int newQuantity) {
    if (newQuantity <= 0) {
      setState(() => _cart.removeAt(index));
      return;
    }

    setState(() {
      final unitPrice = _cart[index]['unitPrice'] as int? ?? 0;
      _cart[index]['quantity'] = newQuantity;
      _cart[index]['total'] = unitPrice * newQuantity;
    });
  }

  void _showCartBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => StatefulBuilder(
          builder: (context, setModalState) => Container(
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
                Expanded(child: _buildCart()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showPaymentDialog() async {
    _selectedPaymentMethod = null;

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.payment_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Forma de Pagamento',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Total
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.green.shade50,
                        Colors.green.shade100,
                      ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total',
                        style: AppTheme.bodyLarge.copyWith(
                          color: Colors.green.shade700,
                        ),
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
                ),
                const SizedBox(height: 24),

                // Opções de pagamento
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  alignment: WrapAlignment.center,
                  children: [
                    _buildPaymentOption(
                        'cash', 'Dinheiro', Icons.money, setDialogState),
                    _buildPaymentOption('card', 'Cartão',
                        Icons.credit_card_rounded, setDialogState),
                    _buildPaymentOption('mobile_money', 'Mobile\nMoney',
                        Icons.phone_android_rounded, setDialogState),
                    _buildPaymentOption('debt', 'Fiado',
                        Icons.receipt_long_rounded, setDialogState),
                  ],
                ),
                const SizedBox(height: 32),

                // Botões
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'Cancelar',
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 16,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      flex: 2,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: _selectedPaymentMethod != null
                              ? AppTheme.successGradient
                              : LinearGradient(
                                  colors: [
                                    Colors.grey.shade300,
                                    Colors.grey.shade400,
                                  ],
                                ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: _selectedPaymentMethod != null
                              ? [
                                  BoxShadow(
                                    color: Colors.green.withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4),
                                  ),
                                ]
                              : null,
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: _selectedPaymentMethod != null
                                ? () =>
                                    Navigator.pop(ctx, _selectedPaymentMethod)
                                : null,
                            borderRadius: BorderRadius.circular(12),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  Icon(
                                    Icons.check_circle_rounded,
                                    color: Colors.white,
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    'Confirmar',
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
              ],
            ),
          ),
        ),
      ),
    );

    if (result != null) {
      await _processSale(result);
    }
  }

  Widget _buildPaymentOption(
      String value, String label, IconData icon, StateSetter setDialogState) {
    final isSelected = _selectedPaymentMethod == value;

    return GestureDetector(
      onTap: () => setDialogState(() => _selectedPaymentMethod = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 100,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: isSelected ? AppTheme.primaryGradient : null,
          color: isSelected ? null : Colors.grey.shade100,
          border: Border.all(
            color: isSelected ? AppTheme.primaryColor : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppTheme.primaryColor.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
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

  Future<void> _processSale(String paymentMethod) async {
    final auth = context.read<AuthProvider>();
    final cashBox = context.read<CashBoxProvider>();
    final db = DatabaseService.instance;
    final sync = SyncService.instance;

    try {
      final saleId = _uuid.v4();
      final now = DateTime.now().toIso8601String();
      final saleNumber =
          'V${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}';

      // Criar venda
      await db.insert('sales', {
        'id': saleId,
        'sale_number': saleNumber,
        'branch_id': auth.branchId ?? '',
        'type': 'counter',
        'cashier_id': auth.userId ?? '',
        'status': 'completed',
        'subtotal': _cartTotal,
        'total': _cartTotal,
        'payment_method': paymentMethod,
        'payment_status': paymentMethod == 'debt' ? 'pending' : 'paid',
        'created_at': now,
        'synced': 0,
      });

      // Adicionar itens
      for (final item in _cart) {
        await db.insert('sale_items', {
          'id': _uuid.v4(),
          'sale_id': saleId,
          'product_id': item['productId'],
          'qty_units': item['quantity'],
          'unit_price': item['unitPrice'],
          'total': item['total'],
          'created_at': now,
          'synced': 0,
        });
      }

      // Atualizar totais do caixa
      if (paymentMethod == 'cash') {
        await cashBox.updateCashBoxTotals(cashAmount: _cartTotal);
      } else if (paymentMethod == 'card') {
        await cashBox.updateCashBoxTotals(cardAmount: _cartTotal);
      } else if (paymentMethod == 'mobile_money') {
        await cashBox.updateCashBoxTotals(mobileMoneyAmount: _cartTotal);
      } else if (paymentMethod == 'debt') {
        await cashBox.updateCashBoxTotals(debtAmount: _cartTotal);
      }

      // Marcar para sincronização
      await sync.markForSync(
        entityType: 'sales',
        entityId: saleId,
        action: 'create',
      );

      // Limpar carrinho
      setState(() => _cart.clear());

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Venda $saleNumber realizada com sucesso!'),
            backgroundColor: Colors.green,
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
    }
  }
}
