import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/data_provider.dart';
import '../models/models.dart';
import '../widgets/common_widgets.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await context.read<DataProvider>().loadSuppliers();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataProvider>(
      builder: (context, provider, _) {
        var suppliers = provider.suppliers;

        // Filter by search
        if (_searchController.text.isNotEmpty) {
          final query = _searchController.text.toLowerCase();
          suppliers = suppliers
              .where((s) =>
                  s.name.toLowerCase().contains(query) ||
                  s.code.toLowerCase().contains(query) ||
                  (s.contactPerson?.toLowerCase().contains(query) ?? false))
              .toList();
        }

        return Column(
          children: [
            // Search Bar
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingMD),
              child: CustomSearchBar(
                controller: _searchController,
                hintText: 'Buscar fornecedores...',
                onChanged: (_) => setState(() {}),
                onClear: () => setState(() {}),
              ),
            ),

            // Summary
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppTheme.spacingMD),
              child: Row(
                children: [
                  Text(
                    '${suppliers.length} fornecedores',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingSM),

            // Suppliers List
            Expanded(
              child: provider.isLoading
                  ? const LoadingIndicator()
                  : suppliers.isEmpty
                      ? const EmptyState(
                          icon: Icons.local_shipping,
                          title: 'Nenhum fornecedor encontrado',
                        )
                      : RefreshIndicator(
                          onRefresh: _loadData,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(
                                horizontal: AppTheme.spacingMD),
                            itemCount: suppliers.length,
                            itemBuilder: (context, index) {
                              final supplier = suppliers[index];
                              return _SupplierCard(
                                supplier: supplier,
                                onTap: () => _showSupplierDetails(supplier),
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

  void _showSupplierDetails(Supplier supplier) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _SupplierDetailsSheet(supplier: supplier),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _SupplierCard extends StatelessWidget {
  final Supplier supplier;
  final VoidCallback onTap;

  const _SupplierCard({
    required this.supplier,
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
                  color: AppTheme.infoColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                ),
                child: Center(
                  child: Text(
                    supplier.name.substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.infoColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppTheme.spacingMD),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      supplier.name,
                      style: Theme.of(context).textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppTheme.spacingXS),
                    Text(
                      'Código: ${supplier.code}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (supplier.contactPerson != null) ...[
                      const SizedBox(height: AppTheme.spacingXS),
                      Row(
                        children: [
                          const Icon(Icons.person,
                              size: 14, color: AppTheme.textMuted),
                          const SizedBox(width: AppTheme.spacingXS),
                          Text(
                            supplier.contactPerson!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusBadge(
                    label: supplier.isActive ? 'Ativo' : 'Inativo',
                    type: supplier.isActive
                        ? StatusType.success
                        : StatusType.danger,
                  ),
                  if (supplier.phone != null) ...[
                    const SizedBox(height: AppTheme.spacingSM),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.phone,
                            size: 14, color: AppTheme.textMuted),
                        const SizedBox(width: AppTheme.spacingXS),
                        Text(
                          supplier.phone!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SupplierDetailsSheet extends StatelessWidget {
  final Supplier supplier;

  const _SupplierDetailsSheet({required this.supplier});

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
                    color: AppTheme.infoColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
                  ),
                  child: Center(
                    child: Text(
                      supplier.name.substring(0, 1).toUpperCase(),
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.infoColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMD),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        supplier.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(
                        supplier.code,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
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
                  _ContactRow(
                    icon: Icons.person,
                    label: 'Pessoa de Contato',
                    value: supplier.contactPerson ?? 'Não informado',
                  ),
                  _ContactRow(
                    icon: Icons.phone,
                    label: 'Telefone',
                    value: supplier.phone ?? 'Não informado',
                  ),
                  _ContactRow(
                    icon: Icons.email,
                    label: 'E-mail',
                    value: supplier.email ?? 'Não informado',
                  ),
                  _ContactRow(
                    icon: Icons.location_on,
                    label: 'Endereço',
                    value: supplier.address ?? 'Não informado',
                  ),
                  _ContactRow(
                    icon: Icons.badge,
                    label: 'NIF',
                    value: supplier.taxId ?? 'Não informado',
                  ),
                  _ContactRow(
                    icon: Icons.payment,
                    label: 'Condições de Pagamento',
                    value: supplier.paymentTerms ?? 'Não informado',
                  ),
                  if (supplier.notes != null && supplier.notes!.isNotEmpty) ...[
                    const SizedBox(height: AppTheme.spacingMD),
                    Text(
                      'Observações',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: AppTheme.spacingSM),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(AppTheme.spacingMD),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundColor,
                        borderRadius:
                            BorderRadius.circular(AppTheme.radiusSmall),
                      ),
                      child: Text(
                        supplier.notes!,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ContactRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingMD),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingSM),
            decoration: BoxDecoration(
              color: AppTheme.infoColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusSmall),
            ),
            child: Icon(icon, size: 20, color: AppTheme.infoColor),
          ),
          const SizedBox(width: AppTheme.spacingMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
