import 'package:flutter/material.dart';
import '../config/app_theme.dart';

// ==================== STAT CARD ====================

class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color? iconColor;
  final LinearGradient? gradient;
  final String? subtitle;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.iconColor,
    this.gradient,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppTheme.spacingMD),
        decoration: BoxDecoration(
          color: AppTheme.cardColor,
          borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppTheme.spacingSM),
                  decoration: BoxDecoration(
                    gradient: gradient ?? AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  ),
                  child: Icon(
                    icon,
                    color: iconColor ?? Colors.white,
                    size: 20,
                  ),
                ),
                const Spacer(),
                if (onTap != null)
                  const Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                    color: AppTheme.textMuted,
                  ),
              ],
            ),
            const SizedBox(height: AppTheme.spacingMD),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: AppTheme.spacingXS),
            Text(
              title,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppTheme.spacingXS),
              Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.accentColor,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ==================== INFO CARD ====================

class InfoCard extends StatelessWidget {
  final String title;
  final Widget child;
  final IconData? icon;
  final VoidCallback? onTap;
  final Widget? trailing;

  const InfoCard({
    super.key,
    required this.title,
    required this.child,
    this.icon,
    this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMD),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 20, color: AppTheme.primaryColor),
                  const SizedBox(width: AppTheme.spacingSM),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          const Divider(height: 1),
          child,
        ],
      ),
    );
  }
}

// ==================== LIST TILE CARD ====================

class ListTileCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? trailing;
  final Widget? trailingWidget;
  final IconData? leadingIcon;
  final Color? leadingColor;
  final VoidCallback? onTap;
  final bool showDivider;

  const ListTileCard({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.trailingWidget,
    this.leadingIcon,
    this.leadingColor,
    this.onTap,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMD,
              vertical: AppTheme.spacingMD,
            ),
            child: Row(
              children: [
                if (leadingIcon != null) ...[
                  Container(
                    padding: const EdgeInsets.all(AppTheme.spacingSM),
                    decoration: BoxDecoration(
                      color: (leadingColor ?? AppTheme.primaryColor)
                          .withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                    ),
                    child: Icon(
                      leadingIcon,
                      size: 20,
                      color: leadingColor ?? AppTheme.primaryColor,
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingMD),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: AppTheme.spacingXS),
                        Text(
                          subtitle!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailingWidget != null)
                  trailingWidget!
                else if (trailing != null)
                  Text(
                    trailing!,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                if (onTap != null) ...[
                  const SizedBox(width: AppTheme.spacingSM),
                  const Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                    color: AppTheme.textMuted,
                  ),
                ],
              ],
            ),
          ),
        ),
        if (showDivider) const Divider(height: 1, indent: AppTheme.spacingMD),
      ],
    );
  }
}

// ==================== STATUS BADGE ====================

class StatusBadge extends StatelessWidget {
  final String label;
  final Color? color;
  final StatusType? type;

  const StatusBadge({
    super.key,
    required this.label,
    this.color,
    this.type,
  });

  @override
  Widget build(BuildContext context) {
    Color badgeColor;
    if (color != null) {
      badgeColor = color!;
    } else if (type != null) {
      switch (type!) {
        case StatusType.success:
          badgeColor = AppTheme.accentColor;
          break;
        case StatusType.warning:
          badgeColor = AppTheme.warningColor;
          break;
        case StatusType.danger:
          badgeColor = AppTheme.dangerColor;
          break;
        case StatusType.info:
          badgeColor = AppTheme.infoColor;
          break;
        default:
          badgeColor = AppTheme.textMuted;
      }
    } else {
      badgeColor = AppTheme.textMuted;
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingSM,
        vertical: AppTheme.spacingXS,
      ),
      decoration: BoxDecoration(
        color: badgeColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: badgeColor,
        ),
      ),
    );
  }
}

enum StatusType { success, warning, danger, info, neutral }

// ==================== EMPTY STATE ====================

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingLG),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 48,
                color: AppTheme.primaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacingLG),
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppTheme.spacingSM),
              Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: AppTheme.spacingLG),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

// ==================== LOADING INDICATOR ====================

class LoadingIndicator extends StatelessWidget {
  final String? message;

  const LoadingIndicator({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(
            color: AppTheme.primaryColor,
          ),
          if (message != null) ...[
            const SizedBox(height: AppTheme.spacingMD),
            Text(
              message!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

// ==================== ERROR STATE ====================

class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const ErrorState({
    super.key,
    required this.message,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(AppTheme.spacingLG),
              decoration: BoxDecoration(
                color: AppTheme.dangerColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.error_outline,
                size: 48,
                color: AppTheme.dangerColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacingLG),
            Text(
              'Oops! Algo deu errado',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingSM),
            Text(
              message,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppTheme.spacingLG),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar novamente'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ==================== SEARCH BAR ====================

class CustomSearchBar extends StatelessWidget {
  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final TextEditingController? controller;

  const CustomSearchBar({
    super.key,
    this.hintText = 'Pesquisar...',
    this.onChanged,
    this.onClear,
    this.controller,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.cardColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMedium),
        boxShadow: AppTheme.cardShadow,
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: hintText,
          prefixIcon: const Icon(Icons.search, color: AppTheme.textMuted),
          suffixIcon: controller?.text.isNotEmpty == true
              ? IconButton(
                  icon: const Icon(Icons.clear, color: AppTheme.textMuted),
                  onPressed: () {
                    controller?.clear();
                    onClear?.call();
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMD,
            vertical: AppTheme.spacingMD,
          ),
        ),
      ),
    );
  }
}

// ==================== SECTION HEADER ====================

class SectionHeader extends StatelessWidget {
  final String title;
  final String? actionText;
  final VoidCallback? onAction;

  const SectionHeader({
    super.key,
    required this.title,
    this.actionText,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMD,
        vertical: AppTheme.spacingSM,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (actionText != null)
            TextButton(
              onPressed: onAction,
              child: Text(actionText!),
            ),
        ],
      ),
    );
  }
}
