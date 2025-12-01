import 'package:flutter/material.dart';
import '../config/app_theme.dart';

class ModernNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const ModernNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Container(
          height: 65,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _ModernNavItem(
                icon: Icons.dashboard_rounded,
                label: 'Dashboard',
                isActive: currentIndex == 0,
                onTap: () => onTap(0),
              ),
              _ModernNavItem(
                icon: Icons.receipt_long_rounded,
                label: 'Vendas',
                isActive: currentIndex == 1,
                onTap: () => onTap(1),
              ),
              _ModernNavItem(
                icon: Icons.inventory_2_rounded,
                label: 'Estoque',
                isActive: currentIndex == 2,
                onTap: () => onTap(2),
              ),
              _ModernNavItem(
                icon: Icons.people_rounded,
                label: 'Clientes',
                isActive: currentIndex == 3,
                onTap: () => onTap(3),
              ),
              _ModernNavItem(
                icon: Icons.apps_rounded,
                label: 'Mais',
                isActive: currentIndex >= 4,
                onTap: () => onTap(4),
                showBadge: true,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModernNavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  final bool showBadge;

  const _ModernNavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.showBadge = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(
            color: isActive
                ? AppTheme.primaryColor.withOpacity(0.1)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: isActive
                          ? AppTheme.primaryColor.withOpacity(0.15)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      icon,
                      size: 22,
                      color: isActive
                          ? AppTheme.primaryColor
                          : Colors.grey.shade500,
                    ),
                  ),
                  if (showBadge)
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppTheme.accentColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                  color:
                      isActive ? AppTheme.primaryColor : Colors.grey.shade600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ==================== MORE OPTIONS BOTTOM SHEET ====================

class ModernMoreOptionsSheet extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  const ModernMoreOptionsSheet({
    super.key,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(24),
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            // Handle bar
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.apps_rounded,
                      color: AppTheme.primaryColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Mais Opções',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            // Grid of options
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1,
                children: [
                  _ModernOptionTile(
                    icon: Icons.shopping_bag_rounded,
                    label: 'Produtos',
                    color: Colors.blue,
                    isSelected: selectedIndex == 5,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(5);
                    },
                  ),
                  _ModernOptionTile(
                    icon: Icons.local_shipping_rounded,
                    label: 'Fornecedores',
                    color: Colors.orange,
                    isSelected: selectedIndex == 6,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(6);
                    },
                  ),
                  _ModernOptionTile(
                    icon: Icons.shopping_cart_rounded,
                    label: 'Compras',
                    color: Colors.purple,
                    isSelected: selectedIndex == 7,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(7);
                    },
                  ),
                  _ModernOptionTile(
                    icon: Icons.account_balance_wallet_rounded,
                    label: 'Dívidas',
                    color: Colors.red,
                    isSelected: selectedIndex == 8,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(8);
                    },
                  ),
                  _ModernOptionTile(
                    icon: Icons.point_of_sale_rounded,
                    label: 'Caixa',
                    color: Colors.green,
                    isSelected: selectedIndex == 9,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(9);
                    },
                  ),
                  _ModernOptionTile(
                    icon: Icons.history_rounded,
                    label: 'Histórico',
                    color: Colors.teal,
                    isSelected: selectedIndex == 10,
                    onTap: () {
                      Navigator.pop(context);
                      onSelect(10);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _ModernOptionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _ModernOptionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.15) : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color.withOpacity(0.5) : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: color,
                size: 26,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? color : Colors.grey.shade700,
              ),
              textAlign: TextAlign.center,
            ),
            if (isSelected) ...[
              const SizedBox(height: 4),
              Icon(
                Icons.check_circle,
                color: color,
                size: 16,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
