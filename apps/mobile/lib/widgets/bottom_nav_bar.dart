import 'package:flutter/material.dart';
import '../config/app_theme.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingSM,
            vertical: AppTheme.spacingSM,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavItem(
                icon: Icons.dashboard_outlined,
                activeIcon: Icons.dashboard,
                label: 'Dashboard',
                isActive: currentIndex == 0,
                onTap: () => onTap(0),
              ),
              _NavItem(
                icon: Icons.point_of_sale_outlined,
                activeIcon: Icons.point_of_sale,
                label: 'Vendas',
                isActive: currentIndex == 1,
                onTap: () => onTap(1),
              ),
              _NavItem(
                icon: Icons.inventory_2_outlined,
                activeIcon: Icons.inventory_2,
                label: 'Estoque',
                isActive: currentIndex == 2,
                onTap: () => onTap(2),
              ),
              _NavItem(
                icon: Icons.people_outline,
                activeIcon: Icons.people,
                label: 'Clientes',
                isActive: currentIndex == 3,
                onTap: () => onTap(3),
              ),
              _NavItem(
                icon: Icons.more_horiz,
                activeIcon: Icons.more_horiz,
                label: 'Mais',
                isActive: currentIndex == 4,
                onTap: () => onTap(4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMD,
          vertical: AppTheme.spacingSM,
        ),
        decoration: BoxDecoration(
          color: isActive
              ? AppTheme.primaryColor.withOpacity(0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isActive ? activeIcon : icon,
              color: isActive ? AppTheme.primaryColor : AppTheme.textMuted,
              size: 24,
            ),
            const SizedBox(height: AppTheme.spacingXS),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                color: isActive ? AppTheme.primaryColor : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ==================== MORE OPTIONS SHEET ====================

class MoreOptionsSheet extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  const MoreOptionsSheet({
    super.key,
    required this.selectedIndex,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusXLarge),
        ),
      ),
      child: SafeArea(
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
            const SizedBox(height: AppTheme.spacingMD),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: Text(
                'Mais Opções',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            const SizedBox(height: AppTheme.spacingMD),
            _OptionTile(
              icon: Icons.shopping_bag_outlined,
              label: 'Produtos',
              isSelected: selectedIndex == 5,
              onTap: () {
                Navigator.pop(context);
                onSelect(5);
              },
            ),
            _OptionTile(
              icon: Icons.local_shipping_outlined,
              label: 'Fornecedores',
              isSelected: selectedIndex == 6,
              onTap: () {
                Navigator.pop(context);
                onSelect(6);
              },
            ),
            _OptionTile(
              icon: Icons.shopping_cart_outlined,
              label: 'Compras',
              isSelected: selectedIndex == 7,
              onTap: () {
                Navigator.pop(context);
                onSelect(7);
              },
            ),
            _OptionTile(
              icon: Icons.receipt_long_outlined,
              label: 'Dívidas',
              isSelected: selectedIndex == 8,
              onTap: () {
                Navigator.pop(context);
                onSelect(8);
              },
            ),
            _OptionTile(
              icon: Icons.point_of_sale_outlined,
              label: 'Caixa Atual',
              isSelected: selectedIndex == 9,
              onTap: () {
                Navigator.pop(context);
                onSelect(9);
              },
            ),
            _OptionTile(
              icon: Icons.history_outlined,
              label: 'Histórico de Caixa',
              isSelected: selectedIndex == 10,
              onTap: () {
                Navigator.pop(context);
                onSelect(10);
              },
            ),
            const SizedBox(height: AppTheme.spacingLG),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _OptionTile({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(AppTheme.spacingSM),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primaryColor.withOpacity(0.1)
              : AppTheme.backgroundColor,
          borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
        ),
        child: Icon(
          icon,
          color: isSelected ? AppTheme.primaryColor : AppTheme.textSecondary,
        ),
      ),
      title: Text(
        label,
        style: TextStyle(
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          color: isSelected ? AppTheme.primaryColor : AppTheme.textPrimary,
        ),
      ),
      trailing: isSelected
          ? const Icon(Icons.check_circle, color: AppTheme.primaryColor)
          : null,
      onTap: onTap,
    );
  }
}
