import 'package:flutter/material.dart';
import '../utils/app_theme.dart';
import '../utils/responsive_helper.dart';

/// Card moderno com gradiente e sombra
class ModernCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  const ModernCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.color,
    this.gradient,
    this.onTap,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin ?? const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? AppTheme.cardColor) : null,
        gradient: gradient,
        borderRadius: borderRadius ?? AppTheme.borderRadiusMedium,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: borderRadius ?? AppTheme.borderRadiusMedium,
          child: Padding(
            padding: padding ?? EdgeInsets.all(context.responsiveSpacing()),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Card de estatística/métrica
class MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color? color;
  final Color? backgroundColor;
  final VoidCallback? onTap;

  const MetricCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.color,
    this.backgroundColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cardColor = color ?? AppTheme.primaryColor;
    final bgColor = backgroundColor ?? cardColor.withOpacity(0.1);

    return ModernCard(
      onTap: onTap,
      padding: EdgeInsets.all(context.responsiveSpacing(base: 14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: AppTheme.borderRadiusSmall,
                ),
                child: Icon(
                  icon,
                  color: cardColor,
                  size: context.responsiveIconSize(base: 20),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: context.responsiveFontSize(13),
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          SizedBox(height: context.responsiveSpacing(base: 10)),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                fontSize: context.responsiveFontSize(18),
                fontWeight: FontWeight.bold,
                color: cardColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Card de status com ícone grande
class StatusCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData icon;
  final Color color;
  final Widget? trailing;
  final VoidCallback? onTap;

  const StatusCard({
    super.key,
    required this.title,
    this.subtitle,
    required this.icon,
    required this.color,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ModernCard(
      color: color.withOpacity(0.08),
      onTap: onTap,
      padding: EdgeInsets.all(context.responsiveSpacing(base: 16)),
      child: Row(
        children: [
          Container(
            width: context.responsiveIconSize(base: 52),
            height: context.responsiveIconSize(base: 52),
            decoration: BoxDecoration(
              color: color,
              borderRadius: AppTheme.borderRadiusMedium,
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: context.responsiveIconSize(base: 26),
            ),
          ),
          SizedBox(width: context.responsiveSpacing(base: 14)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: context.responsiveFontSize(17),
                    fontWeight: FontWeight.bold,
                    color: color.withOpacity(0.9),
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: context.responsiveFontSize(13),
                      color: AppTheme.textSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Badge/Chip estilizado
class ModernBadge extends StatelessWidget {
  final String text;
  final Color? color;
  final Color? textColor;
  final IconData? icon;

  const ModernBadge({
    super.key,
    required this.text,
    this.color,
    this.textColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final bgColor = color ?? AppTheme.successLight;
    final fgColor = textColor ?? AppTheme.successColor;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: AppTheme.borderRadiusSmall,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fgColor),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: fgColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// Botão de ação com gradiente
class GradientButton extends StatelessWidget {
  final String text;
  final IconData? icon;
  final VoidCallback? onPressed;
  final Gradient? gradient;
  final bool isLoading;
  final bool fullWidth;

  const GradientButton({
    super.key,
    required this.text,
    this.icon,
    this.onPressed,
    this.gradient,
    this.isLoading = false,
    this.fullWidth = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: fullWidth ? double.infinity : null,
      height: 52,
      decoration: BoxDecoration(
        gradient:
            onPressed != null ? (gradient ?? AppTheme.primaryGradient) : null,
        color: onPressed == null ? Colors.grey.shade300 : null,
        borderRadius: AppTheme.borderRadiusMedium,
        boxShadow: onPressed != null
            ? [
                BoxShadow(
                  color: AppTheme.primaryColor.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isLoading ? null : onPressed,
          borderRadius: AppTheme.borderRadiusMedium,
          child: Center(
            child: isLoading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, color: Colors.white, size: 22),
                        const SizedBox(width: 10),
                      ],
                      Text(
                        text,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// Lista de detalhes (label: value)
class DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final FontWeight? valueFontWeight;

  const DetailRow({
    super.key,
    required this.label,
    required this.value,
    this.valueColor,
    this.valueFontWeight,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        vertical: context.responsiveSpacing(base: 8),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: context.responsiveFontSize(14),
                color: AppTheme.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                fontSize: context.responsiveFontSize(14),
                fontWeight: valueFontWeight ?? FontWeight.w600,
                color: valueColor ?? AppTheme.textPrimary,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

/// Empty state widget
class EmptyStateWidget extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  const EmptyStateWidget({
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
        padding: EdgeInsets.all(context.responsiveSpacing(base: 32)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 48,
                color: Colors.grey.shade400,
              ),
            ),
            SizedBox(height: context.responsiveSpacing(base: 24)),
            Text(
              title,
              style: TextStyle(
                fontSize: context.responsiveFontSize(18),
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              SizedBox(height: context.responsiveSpacing(base: 8)),
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: context.responsiveFontSize(14),
                  color: AppTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              SizedBox(height: context.responsiveSpacing(base: 24)),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Seção com título
class SectionHeader extends StatelessWidget {
  final String title;
  final IconData? icon;
  final Widget? trailing;
  final Color? color;

  const SectionHeader({
    super.key,
    required this.title,
    this.icon,
    this.trailing,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: context.responsiveSpacing(base: 12),
        top: context.responsiveSpacing(base: 8),
      ),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: context.responsiveIconSize(base: 20),
              color: color ?? AppTheme.textSecondary,
            ),
            SizedBox(width: context.responsiveSpacing(base: 8)),
          ],
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: context.responsiveFontSize(16),
                fontWeight: FontWeight.w600,
                color: color ?? AppTheme.textPrimary,
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
