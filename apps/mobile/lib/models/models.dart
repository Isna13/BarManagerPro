// Product Model
class Product {
  final String id;
  final String? sku;
  final String? barcode;
  final String name;
  final String? categoryId;
  final String? categoryName;
  final String? supplierId;
  final String? supplierName;
  final double priceUnit;
  final double? priceBox;
  final double costUnit;
  final double? costBox;
  final int? unitsPerBox;
  final bool boxEnabled;
  final bool isMuntuEligible;
  final int? muntuQuantity;
  final double? muntuPrice;
  final int lowStockAlert;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Product({
    required this.id,
    this.sku,
    this.barcode,
    required this.name,
    this.categoryId,
    this.categoryName,
    this.supplierId,
    this.supplierName,
    required this.priceUnit,
    this.priceBox,
    required this.costUnit,
    this.costBox,
    this.unitsPerBox,
    this.boxEnabled = false,
    this.isMuntuEligible = false,
    this.muntuQuantity,
    this.muntuPrice,
    this.lowStockAlert = 10,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    // O backend pode retornar category e supplier como objetos aninhados
    // Valores monetários vêm em centavos (Int), dividir por 100
    final category = json['category'] as Map<String, dynamic>?;
    final supplier = json['supplier'] as Map<String, dynamic>?;

    return Product(
      id: json['id'] ?? '',
      sku: json['sku'],
      barcode: json['barcode'],
      name: json['name'] ?? '',
      categoryId: json['category_id'] ?? json['categoryId'],
      categoryName:
          category?['name'] ?? json['category_name'] ?? json['categoryName'],
      supplierId: json['supplier_id'] ?? json['supplierId'],
      supplierName:
          supplier?['name'] ?? json['supplier_name'] ?? json['supplierName'],
      priceUnit:
          (json['price_unit'] ?? json['priceUnit'] ?? 0).toDouble() / 100,
      priceBox: json['price_box'] != null || json['priceBox'] != null
          ? (json['price_box'] ?? json['priceBox']).toDouble() / 100
          : null,
      costUnit: (json['cost_unit'] ?? json['costUnit'] ?? 0).toDouble() / 100,
      costBox: json['cost_box'] != null || json['costBox'] != null
          ? (json['cost_box'] ?? json['costBox']).toDouble() / 100
          : null,
      unitsPerBox: json['units_per_box'] ?? json['unitsPerBox'],
      boxEnabled: json['box_enabled'] == 1 || json['boxEnabled'] == true,
      isMuntuEligible:
          json['is_muntu_eligible'] == 1 || json['isMuntuEligible'] == true,
      muntuQuantity: json['muntu_quantity'] ?? json['muntuQuantity'],
      muntuPrice: json['muntu_price'] != null || json['muntuPrice'] != null
          ? (json['muntu_price'] ?? json['muntuPrice']).toDouble() / 100
          : null,
      lowStockAlert: json['low_stock_alert'] ?? json['lowStockAlert'] ?? 10,
      isActive: json['is_active'] == 1 || json['isActive'] == true,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : (json['createdAt'] != null
              ? DateTime.tryParse(json['createdAt'])
              : null),
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'])
          : (json['updatedAt'] != null
              ? DateTime.tryParse(json['updatedAt'])
              : null),
    );
  }

  double get profitMargin =>
      priceUnit > 0 ? ((priceUnit - costUnit) / priceUnit) * 100 : 0;
}

// Category Model
class Category {
  final String id;
  final String name;
  final String? icon;
  final String? color;
  final String? parentId;
  final int sortOrder;
  final bool isActive;

  Category({
    required this.id,
    required this.name,
    this.icon,
    this.color,
    this.parentId,
    this.sortOrder = 0,
    this.isActive = true,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      icon: json['icon'],
      color: json['color'],
      parentId: json['parent_id'] ?? json['parentId'],
      sortOrder: json['sort_order'] ?? json['sortOrder'] ?? 0,
      isActive: json['is_active'] == 1 || json['isActive'] == true,
    );
  }
}

// Supplier Model
class Supplier {
  final String id;
  final String code;
  final String name;
  final String? contactPerson;
  final String? phone;
  final String? email;
  final String? address;
  final String? taxId;
  final String? paymentTerms;
  final String? notes;
  final bool isActive;
  final DateTime? createdAt;

  Supplier({
    required this.id,
    required this.code,
    required this.name,
    this.contactPerson,
    this.phone,
    this.email,
    this.address,
    this.taxId,
    this.paymentTerms,
    this.notes,
    this.isActive = true,
    this.createdAt,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id'] ?? '',
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      contactPerson: json['contact_person'] ?? json['contactPerson'],
      phone: json['phone'],
      email: json['email'],
      address: json['address'],
      taxId: json['tax_id'] ?? json['taxId'],
      paymentTerms: json['payment_terms'] ?? json['paymentTerms'],
      notes: json['notes'],
      isActive: json['is_active'] == 1 || json['isActive'] == true,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
    );
  }
}

// Sale Model
class Sale {
  final String id;
  final String? customerId;
  final String? customerName;
  final String? cashierId;
  final String? cashierName;
  final String? branchId;
  final double subtotal;
  final double discount;
  final double total;
  final String paymentMethod;
  final String status;
  final String? notes;
  final DateTime createdAt;
  final List<SaleItem> items;

  Sale({
    required this.id,
    this.customerId,
    this.customerName,
    this.cashierId,
    this.cashierName,
    this.branchId,
    required this.subtotal,
    this.discount = 0,
    required this.total,
    required this.paymentMethod,
    required this.status,
    this.notes,
    required this.createdAt,
    this.items = const [],
  });

  factory Sale.fromJson(Map<String, dynamic> json) {
    // O backend pode retornar customer e cashier como objetos aninhados
    final customer = json['customer'] as Map<String, dynamic>?;
    final cashier = json['cashier'] as Map<String, dynamic>?;

    // O backend retorna payments como array, pegar o método do primeiro pagamento
    final payments = json['payments'] as List<dynamic>?;
    String paymentMethod = 'cash';
    if (payments != null && payments.isNotEmpty) {
      paymentMethod = payments[0]['method'] ?? 'cash';
    } else {
      paymentMethod = json['payment_method'] ?? json['paymentMethod'] ?? 'cash';
    }

    return Sale(
      id: json['id'] ?? '',
      customerId: json['customer_id'] ?? json['customerId'],
      customerName: customer?['fullName'] ??
          json['customer_name'] ??
          json['customerName'],
      cashierId: json['cashier_id'] ?? json['cashierId'],
      cashierName:
          cashier?['fullName'] ?? json['cashier_name'] ?? json['cashierName'],
      branchId: json['branch_id'] ?? json['branchId'],
      subtotal: (json['subtotal'] ?? 0) / 100,
      discount: (json['discountTotal'] ?? json['discount'] ?? 0) / 100,
      total: (json['total'] ?? 0) / 100,
      paymentMethod: paymentMethod,
      status: json['status'] ?? 'completed',
      notes: json['notes'],
      createdAt:
          DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ??
              DateTime.now(),
      items: (json['items'] as List<dynamic>?)
              ?.map((item) => SaleItem.fromJson(item))
              .toList() ??
          [],
    );
  }
}

// Sale Item Model
class SaleItem {
  final String id;
  final String saleId;
  final String productId;
  final String? productName;
  final int quantity;
  final double unitPrice;
  final double subtotal;
  final String saleType;

  SaleItem({
    required this.id,
    required this.saleId,
    required this.productId,
    this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.subtotal,
    this.saleType = 'unit',
  });

  factory SaleItem.fromJson(Map<String, dynamic> json) {
    // O backend retorna o produto como objeto aninhado
    final product = json['product'] as Map<String, dynamic>?;

    return SaleItem(
      id: json['id'] ?? '',
      saleId: json['sale_id'] ?? json['saleId'] ?? '',
      productId: json['product_id'] ?? json['productId'] ?? '',
      productName:
          product?['name'] ?? json['product_name'] ?? json['productName'],
      quantity: json['qtyUnits'] ?? json['quantity'] ?? 1,
      unitPrice: (json['unitPrice'] ?? json['unit_price'] ?? 0) / 100,
      subtotal: (json['subtotal'] ?? 0) / 100,
      saleType: json['sale_type'] ?? json['saleType'] ?? 'unit',
    );
  }
}

// Customer Model
class Customer {
  final String id;
  final String? code;
  final String fullName;
  final String? phone;
  final String? email;
  final String? address;
  final int loyaltyPoints;
  final double totalPurchases;
  final double creditLimit;
  final double currentDebt;
  final bool isActive;
  final DateTime? createdAt;

  Customer({
    required this.id,
    this.code,
    required this.fullName,
    this.phone,
    this.email,
    this.address,
    this.loyaltyPoints = 0,
    this.totalPurchases = 0,
    this.creditLimit = 0,
    this.currentDebt = 0,
    this.isActive = true,
    this.createdAt,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] ?? '',
      code: json['code'],
      fullName: json['full_name'] ?? json['fullName'] ?? json['name'] ?? '',
      phone: json['phone'],
      email: json['email'],
      address: json['address'],
      loyaltyPoints: json['loyalty_points'] ?? json['loyaltyPoints'] ?? 0,
      totalPurchases:
          (json['total_purchases'] ?? json['totalPurchases'] ?? 0) / 100,
      creditLimit: (json['credit_limit'] ?? json['creditLimit'] ?? 0) / 100,
      currentDebt: (json['current_debt'] ?? json['currentDebt'] ?? 0) / 100,
      isActive: json['is_active'] == 1 || json['isActive'] == true,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
    );
  }
}

// Debt Model
class Debt {
  final String id;
  final String customerId;
  final String? customerName;
  final String? saleId;
  final double originalAmount;
  final double paidAmount;
  final double remainingAmount;
  final String status;
  final DateTime? dueDate;
  final DateTime createdAt;
  final List<DebtPayment> payments;

  Debt({
    required this.id,
    required this.customerId,
    this.customerName,
    this.saleId,
    required this.originalAmount,
    this.paidAmount = 0,
    required this.remainingAmount,
    required this.status,
    this.dueDate,
    required this.createdAt,
    this.payments = const [],
  });

  factory Debt.fromJson(Map<String, dynamic> json) {
    // Buscar nome do cliente: pode vir direto ou dentro de objeto 'customer'
    String? customerName = json['customer_name'] ?? json['customerName'];
    if (customerName == null && json['customer'] != null) {
      customerName = json['customer']['fullName'] ??
          json['customer']['full_name'] ??
          json['customer']['name'];
    }

    // Valores em centavos - converter para reais
    final originalAmount = (json['original_amount'] ??
            json['originalAmount'] ??
            json['amount'] ??
            0)
        .toDouble();

    // paidAmount pode vir como 'paid', 'paidAmount' ou 'paid_amount'
    // Usar o maior valor não-nulo entre 'paid' e 'paidAmount'
    final paidFromServer = (json['paid'] ?? 0).toDouble();
    final paidAmountFromServer =
        (json['paid_amount'] ?? json['paidAmount'] ?? 0).toDouble();
    final paidAmount = paidFromServer > paidAmountFromServer
        ? paidFromServer
        : paidAmountFromServer;

    // Balance/remainingAmount - se não vier, calcular
    final balanceFromServer = (json['remaining_amount'] ??
            json['remainingAmount'] ??
            json['balance'] ??
            0)
        .toDouble();
    final balance = balanceFromServer > 0
        ? balanceFromServer
        : (originalAmount - paidAmount);

    return Debt(
      id: json['id'] ?? '',
      customerId: json['customer_id'] ?? json['customerId'] ?? '',
      customerName: customerName,
      saleId: json['sale_id'] ?? json['saleId'],
      originalAmount: originalAmount / 100,
      paidAmount: paidAmount / 100,
      remainingAmount: balance / 100,
      status: json['status'] ?? 'pending',
      dueDate: json['due_date'] != null
          ? DateTime.tryParse(json['due_date'])
          : json['dueDate'] != null
              ? DateTime.tryParse(json['dueDate'])
              : null,
      createdAt:
          DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ??
              DateTime.now(),
      payments: (json['payments'] as List<dynamic>?)
              ?.map((p) => DebtPayment.fromJson(p))
              .toList() ??
          [],
    );
  }
}

// Debt Payment Model
class DebtPayment {
  final String id;
  final String debtId;
  final double amount;
  final String? paymentMethod;
  final String? notes;
  final DateTime paidAt;

  DebtPayment({
    required this.id,
    required this.debtId,
    required this.amount,
    this.paymentMethod,
    this.notes,
    required this.paidAt,
  });

  factory DebtPayment.fromJson(Map<String, dynamic> json) {
    return DebtPayment(
      id: json['id'] ?? '',
      debtId: json['debt_id'] ?? json['debtId'] ?? '',
      amount: (json['amount'] ?? 0) / 100,
      paymentMethod:
          json['payment_method'] ?? json['paymentMethod'] ?? json['method'],
      notes: json['notes'],
      // Backend retorna createdAt, não paidAt
      paidAt: DateTime.tryParse(json['paid_at'] ??
              json['paidAt'] ??
              json['createdAt'] ??
              json['processedAt'] ??
              '') ??
          DateTime.now(),
    );
  }
}

// 🔴 CORREÇÃO: Modelo para dívidas agrupadas por cliente
/// Representa o resumo consolidado de todas as dívidas de um cliente
class CustomerDebtSummary {
  final String customerId;
  final String customerName;
  final double totalOriginalAmount;
  final double totalPaidAmount;
  final double totalRemainingAmount;
  final int debtCount;
  final int pendingCount;
  final int overdueCount;
  final List<Debt> debts;
  final DateTime? oldestDueDate;

  CustomerDebtSummary({
    required this.customerId,
    required this.customerName,
    required this.totalOriginalAmount,
    required this.totalPaidAmount,
    required this.totalRemainingAmount,
    required this.debtCount,
    required this.pendingCount,
    required this.overdueCount,
    required this.debts,
    this.oldestDueDate,
  });

  /// Percentual já pago do total original
  double get paymentProgress =>
      totalOriginalAmount > 0 ? (totalPaidAmount / totalOriginalAmount) : 0.0;

  /// Se tem alguma dívida vencida
  bool get hasOverdue => overdueCount > 0;

  /// Status geral (baseado na pior situação)
  String get overallStatus {
    if (overdueCount > 0) return 'overdue';
    if (pendingCount > 0) return 'pending';
    return 'paid';
  }
}

// Inventory Model
class Inventory {
  final String id;
  final String productId;
  final String? productName;
  final String? productSku;
  final String branchId;
  final int quantityUnits;
  final int quantityBoxes;
  final int minStockUnits;
  final double? costUnit;
  final double? priceUnit;
  final DateTime? updatedAt;

  Inventory({
    required this.id,
    required this.productId,
    this.productName,
    this.productSku,
    required this.branchId,
    this.quantityUnits = 0,
    this.quantityBoxes = 0,
    this.minStockUnits = 10,
    this.costUnit,
    this.priceUnit,
    this.updatedAt,
  });

  factory Inventory.fromJson(Map<String, dynamic> json) {
    // O backend retorna o produto como objeto aninhado
    // Valores monetários vêm em centavos, dividir por 100
    final product = json['product'] as Map<String, dynamic>?;

    return Inventory(
      id: json['id'] ?? '',
      productId: json['product_id'] ?? json['productId'] ?? '',
      productName:
          product?['name'] ?? json['product_name'] ?? json['productName'],
      productSku: product?['sku'] ?? json['product_sku'] ?? json['productSku'],
      branchId: json['branch_id'] ?? json['branchId'] ?? '',
      quantityUnits: json['qtyUnits'] ??
          json['quantity_units'] ??
          json['quantityUnits'] ??
          0,
      quantityBoxes: json['qtyBoxes'] ??
          json['quantity_boxes'] ??
          json['quantityBoxes'] ??
          0,
      minStockUnits: json['minStock'] ??
          json['min_stock_units'] ??
          json['minStockUnits'] ??
          10,
      costUnit: product?['costUnit'] != null
          ? (product!['costUnit'] is int
              ? product['costUnit'].toDouble() / 100
              : product['costUnit'] / 100)
          : (json['cost_unit'] != null
              ? (json['cost_unit']).toDouble() / 100
              : null),
      priceUnit: product?['priceUnit'] != null
          ? (product!['priceUnit'] is int
              ? product['priceUnit'].toDouble() / 100
              : product['priceUnit'] / 100)
          : (json['price_unit'] != null
              ? (json['price_unit']).toDouble() / 100
              : null),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'])
          : (json['updated_at'] != null
              ? DateTime.tryParse(json['updated_at'])
              : null),
    );
  }

  bool get isLowStock => quantityUnits < minStockUnits;
  double get stockValue => (costUnit ?? 0) * quantityUnits;
}

// Inventory Movement Model
class InventoryMovement {
  final String id;
  final String inventoryItemId;
  final String? productId;
  final String? productName;
  final String? productSku;
  final String? branchId;
  final String? branchName;
  final String movementType;
  final int quantity;
  final String? reason;
  final DateTime createdAt;

  InventoryMovement({
    required this.id,
    required this.inventoryItemId,
    this.productId,
    this.productName,
    this.productSku,
    this.branchId,
    this.branchName,
    required this.movementType,
    required this.quantity,
    this.reason,
    required this.createdAt,
  });

  factory InventoryMovement.fromJson(Map<String, dynamic> json) {
    // O backend retorna inventoryItem com product e branch aninhados
    final inventoryItem = json['inventoryItem'] as Map<String, dynamic>?;
    final product = inventoryItem?['product'] as Map<String, dynamic>?;
    final branch = inventoryItem?['branch'] as Map<String, dynamic>?;

    return InventoryMovement(
      id: json['id'] ?? '',
      inventoryItemId: json['inventoryItemId'] ?? '',
      productId: product?['id'] ?? json['productId'],
      productName: product?['name'] ?? json['productName'],
      productSku: product?['sku'] ?? json['productSku'],
      branchId: branch?['id'] ?? json['branchId'],
      branchName: branch?['name'] ?? json['branchName'],
      movementType: json['type'] ?? json['movementType'] ?? '',
      quantity: json['qtyUnits'] ?? json['quantity'] ?? 0,
      reason: json['reason'] ?? json['notes'],
      createdAt:
          DateTime.tryParse(json['createdAt'] ?? json['created_at'] ?? '') ??
              DateTime.now(),
    );
  }
}

// Purchase Model
class Purchase {
  final String id;
  final String supplierId;
  final String? supplierName;
  final String? invoiceNumber;
  final double _subtotal;
  final double tax;
  final double discount;
  final double _total;
  final String status;
  final String? notes;
  final DateTime purchaseDate;
  final DateTime? receivedAt;
  final List<PurchaseItem> items;

  Purchase({
    required this.id,
    required this.supplierId,
    this.supplierName,
    this.invoiceNumber,
    required double subtotal,
    this.tax = 0,
    this.discount = 0,
    required double total,
    required this.status,
    this.notes,
    required this.purchaseDate,
    this.receivedAt,
    this.items = const [],
  })  : _subtotal = subtotal,
        _total = total;

  // Calcular subtotal a partir dos itens se houver itens
  // Os itens têm os valores corretos (subtotal = boxes × unitCost)
  double get subtotal {
    if (items.isNotEmpty) {
      return items.fold(0.0, (sum, item) => sum + item.subtotal);
    }
    return _subtotal;
  }

  // Calcular total a partir dos itens + impostos - descontos
  double get total {
    if (items.isNotEmpty) {
      final itemsTotal = items.fold(0.0, (sum, item) => sum + item.subtotal);
      return itemsTotal + tax - discount;
    }
    return _total;
  }

  factory Purchase.fromJson(Map<String, dynamic> json) {
    // O backend retorna supplier como objeto aninhado
    final supplier = json['supplier'] as Map<String, dynamic>?;

    // Helper para converter valores numéricos com segurança
    double safeDouble(dynamic value) {
      if (value == null) return 0;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      return double.tryParse(value.toString()) ?? 0;
    }

    // Calcular subtotal e total - usar totalCost se total/subtotal for 0
    final rawSubtotal = safeDouble(json['subtotal']);
    final rawTotal = safeDouble(json['total']);
    final rawTotalCost = safeDouble(json['totalCost']);

    // Se subtotal/total forem 0 mas totalCost existir, usar totalCost
    final effectiveSubtotal = rawSubtotal > 0 ? rawSubtotal : rawTotalCost;
    final effectiveTotal = rawTotal > 0 ? rawTotal : rawTotalCost;

    return Purchase(
      id: json['id']?.toString() ?? '',
      supplierId: json['supplier_id']?.toString() ??
          json['supplierId']?.toString() ??
          '',
      supplierName:
          supplier?['name'] ?? json['supplier_name'] ?? json['supplierName'],
      invoiceNumber: json['invoice_number'] ??
          json['invoiceNumber'] ??
          json['purchaseNumber'],
      subtotal: effectiveSubtotal / 100,
      tax: safeDouble(json['tax']) / 100,
      discount: safeDouble(json['discount']) / 100,
      total: effectiveTotal / 100,
      status: json['status']?.toString() ?? 'pending',
      notes: json['notes']?.toString(),
      purchaseDate: DateTime.tryParse(json['purchase_date']?.toString() ??
              json['purchaseDate']?.toString() ??
              json['createdAt']?.toString() ??
              json['created_at']?.toString() ??
              '') ??
          DateTime.now(),
      receivedAt: json['received_at'] != null ||
              json['receivedAt'] != null ||
              json['completedAt'] != null
          ? DateTime.tryParse(json['received_at']?.toString() ??
              json['receivedAt']?.toString() ??
              json['completedAt']?.toString() ??
              '')
          : null,
      items: _parseItems(json['items']),
    );
  }

  static List<PurchaseItem> _parseItems(dynamic itemsJson) {
    if (itemsJson == null) return [];
    if (itemsJson is! List) return [];

    final List<PurchaseItem> result = [];
    for (final item in itemsJson) {
      if (item is Map<String, dynamic>) {
        try {
          result.add(PurchaseItem.fromJson(item));
        } catch (e) {
          // Skip invalid items but log the error
          print('Error parsing PurchaseItem: $e');
        }
      }
    }
    return result;
  }
}

// Purchase Item Model
class PurchaseItem {
  final String id;
  final String purchaseId;
  final String productId;
  final String? productName;
  final int quantity; // Quantidade em unidades
  final int unitsPerBox; // Unidades por caixa do produto
  final double unitCost;
  final double _rawSubtotal;

  // Quantidade de caixas calculada
  int get quantityBoxes =>
      unitsPerBox > 0 ? (quantity / unitsPerBox).floor() : quantity;

  // Subtotal calculado: caixas × custo unitário por caixa
  // Se o valor raw for muito diferente do esperado, recalcular
  double get subtotal {
    final expected = quantityBoxes * unitCost;
    // Se o raw subtotal for muito diferente (mais de 2x ou menos que metade), usar o calculado
    if (_rawSubtotal > 0 &&
        (_rawSubtotal > expected * 2 || _rawSubtotal < expected / 2)) {
      return expected;
    }
    return _rawSubtotal > 0 ? _rawSubtotal : expected;
  }

  PurchaseItem({
    required this.id,
    required this.purchaseId,
    required this.productId,
    this.productName,
    required this.quantity,
    this.unitsPerBox = 24,
    required this.unitCost,
    required double subtotal,
  }) : _rawSubtotal = subtotal;

  factory PurchaseItem.fromJson(Map<String, dynamic> json) {
    // productName pode vir direto ou dentro do objeto 'product'
    String? productName = json['product_name'] ?? json['productName'];
    if (productName == null && json['product'] != null) {
      productName = json['product']['name'];
    }

    // Parse numéricos com segurança
    final rawQty =
        json['qtyUnits'] ?? json['qty_units'] ?? json['quantity'] ?? 1;
    final rawUnitCost = json['unit_cost'] ?? json['unitCost'] ?? 0;
    final rawSubtotal = json['subtotal'] ?? 0;

    // unitsPerBox pode vir do item ou do produto aninhado
    int unitsPerBox = 24; // default
    if (json['units_per_box'] != null) {
      unitsPerBox = json['units_per_box'] is int
          ? json['units_per_box']
          : int.tryParse(json['units_per_box'].toString()) ?? 24;
    } else if (json['unitsPerBox'] != null) {
      unitsPerBox = json['unitsPerBox'] is int
          ? json['unitsPerBox']
          : int.tryParse(json['unitsPerBox'].toString()) ?? 24;
    } else if (json['product'] != null &&
        json['product']['unitsPerBox'] != null) {
      unitsPerBox = json['product']['unitsPerBox'] is int
          ? json['product']['unitsPerBox']
          : int.tryParse(json['product']['unitsPerBox'].toString()) ?? 24;
    } else if (json['product'] != null &&
        json['product']['units_per_box'] != null) {
      unitsPerBox = json['product']['units_per_box'] is int
          ? json['product']['units_per_box']
          : int.tryParse(json['product']['units_per_box'].toString()) ?? 24;
    }

    return PurchaseItem(
      id: json['id']?.toString() ?? '',
      purchaseId: json['purchase_id']?.toString() ??
          json['purchaseId']?.toString() ??
          '',
      productId:
          json['product_id']?.toString() ?? json['productId']?.toString() ?? '',
      productName: productName,
      quantity: (rawQty is int) ? rawQty : int.tryParse(rawQty.toString()) ?? 1,
      unitsPerBox: unitsPerBox,
      unitCost: _toDouble(rawUnitCost) / 100,
      subtotal: _toDouble(rawSubtotal) / 100,
    );
  }

  static double _toDouble(dynamic value) {
    if (value == null) return 0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0;
  }
}

// Cash Box Model
// CRÍTICO: Todos os valores financeiros devem vir DIRETAMENTE do servidor (Railway)
// O app NÃO deve recalcular nenhum total - apenas renderizar os dados do servidor
class CashBox {
  final String id;
  final String branchId;
  final String? userId;
  final String? userName;
  final double openingBalance;
  final double? closingBalance;
  final double? totalSales;
  final double? totalCashIn; // Pagamentos em dinheiro (CASH)
  final double? totalCashOut; // Saídas de caixa
  final double? mobileMoneyPayments; // Orange Money, TeleTaku, etc
  final double? cardPayments; // Cartão
  final double? debtPayments; // VALE/Dívidas
  final double? currentAmount; // Saldo esperado CALCULADO PELO SERVIDOR
  final int? salesCount; // Quantidade de vendas
  final String status;
  final DateTime openedAt;
  final DateTime? closedAt;
  final String? notes;

  CashBox({
    required this.id,
    required this.branchId,
    this.userId,
    this.userName,
    required this.openingBalance,
    this.closingBalance,
    this.totalSales,
    this.totalCashIn,
    this.totalCashOut,
    this.mobileMoneyPayments,
    this.cardPayments,
    this.debtPayments,
    this.currentAmount,
    this.salesCount,
    required this.status,
    required this.openedAt,
    this.closedAt,
    this.notes,
  });

  factory CashBox.fromJson(Map<String, dynamic> json) {
    // CRÍTICO: O backend retorna stats como objeto aninhado com TODOS os valores calculados
    // O app DEVE usar esses valores diretamente, NÃO recalcular localmente
    final stats = json['stats'] as Map<String, dynamic>?;

    // Valores básicos do caixa
    final openingBalance = (json['opening_balance'] ??
            json['openingBalance'] ??
            json['openingCash'] ??
            0)
        .toDouble();
    final closingBalance = json['closing_balance'] ??
        json['closingBalance'] ??
        json['closingCash'];

    // VALORES DO STATS (fonte da verdade)
    // totalSales: Total de todas as vendas
    final totalSales =
        stats?['totalSales'] ?? json['total_sales'] ?? json['totalSales'];
    // cashPayments: Pagamentos em dinheiro (entra no caixa físico)
    final totalCashIn = stats?['cashPayments'] ??
        json['total_cash_in'] ??
        json['totalCashIn'] ??
        json['totalCash'];
    // totalCashOut: Saídas manuais de caixa
    final totalCashOut = json['total_cash_out'] ?? json['totalCashOut'];
    // mobileMoneyPayments: Orange Money, TeleTaku, etc
    final mobileMoneyPayments = stats?['mobileMoneyPayments'];
    // cardPayments: Pagamentos em cartão
    final cardPayments = stats?['cardPayments'];
    // debtPayments: VALE (vendas fiado)
    final debtPayments = stats?['debtPayments'];
    // currentAmount: SALDO ESPERADO calculado pelo SERVIDOR (abertura + dinheiro - saídas)
    final currentAmount = stats?['currentAmount'];
    // salesCount: Quantidade de vendas
    final salesCount = stats?['salesCount'];

    return CashBox(
      id: json['id'] ?? '',
      branchId: json['branch_id'] ?? json['branchId'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? json['openedBy'],
      userName: json['user_name'] ??
          json['userName'] ??
          (json['openedByUser'] != null
              ? json['openedByUser']['fullName']
              : null),
      openingBalance: openingBalance / 100,
      closingBalance:
          closingBalance != null ? closingBalance.toDouble() / 100 : null,
      totalSales: totalSales != null ? totalSales.toDouble() / 100 : null,
      totalCashIn: totalCashIn != null ? totalCashIn.toDouble() / 100 : null,
      totalCashOut: totalCashOut != null ? totalCashOut.toDouble() / 100 : null,
      mobileMoneyPayments: mobileMoneyPayments != null
          ? mobileMoneyPayments.toDouble() / 100
          : null,
      cardPayments: cardPayments != null ? cardPayments.toDouble() / 100 : null,
      debtPayments: debtPayments != null ? debtPayments.toDouble() / 100 : null,
      currentAmount:
          currentAmount != null ? currentAmount.toDouble() / 100 : null,
      salesCount: salesCount,
      status: json['status'] ?? 'open',
      openedAt:
          DateTime.tryParse(json['opened_at'] ?? json['openedAt'] ?? '') ??
              DateTime.now(),
      closedAt: json['closed_at'] != null
          ? DateTime.tryParse(json['closed_at'])
          : json['closedAt'] != null
              ? DateTime.tryParse(json['closedAt'])
              : null,
      notes: json['notes'],
    );
  }

  // CRÍTICO: O saldo esperado DEVE vir do servidor (currentAmount)
  // Se não disponível, calcular como fallback (mas isso indica problema de sincronização)
  double get expectedBalance {
    // PRIORIDADE: Usar currentAmount do servidor (fonte da verdade)
    if (currentAmount != null) {
      return currentAmount!;
    }
    // FALLBACK: Calcular localmente apenas se servidor não retornou o valor
    // Isso NÃO deve acontecer em operação normal
    return openingBalance + (totalCashIn ?? 0) - (totalCashOut ?? 0);
  }

  double? get difference {
    if (closingBalance == null) return null;
    return closingBalance! - expectedBalance;
  }
}

// Cash Movement Model
class CashMovement {
  final String id;
  final String cashBoxId;
  final String movementType;
  final double amount;
  final String? description;
  final String? referenceType;
  final String? referenceId;
  final String? userId;
  final String? userName;
  final DateTime createdAt;

  CashMovement({
    required this.id,
    required this.cashBoxId,
    required this.movementType,
    required this.amount,
    this.description,
    this.referenceType,
    this.referenceId,
    this.userId,
    this.userName,
    required this.createdAt,
  });

  factory CashMovement.fromJson(Map<String, dynamic> json) {
    return CashMovement(
      id: json['id'] ?? '',
      cashBoxId: json['cash_box_id'] ?? json['cashBoxId'] ?? '',
      movementType: json['movement_type'] ?? json['movementType'] ?? '',
      amount: (json['amount'] ?? 0) / 100,
      description: json['description'],
      referenceType: json['reference_type'] ?? json['referenceType'],
      referenceId: json['reference_id'] ?? json['referenceId'],
      userId: json['user_id'] ?? json['userId'],
      userName: json['user_name'] ?? json['userName'],
      createdAt:
          DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ??
              DateTime.now(),
    );
  }
}

// Dashboard Stats Model
class DashboardStats {
  final double todaySales;
  final int todayTransactions;
  final double weekSales;
  final double monthSales;
  final int lowStockCount;
  final double pendingDebts;
  final int activeCustomers;
  final List<TopProduct> topProducts;

  DashboardStats({
    this.todaySales = 0,
    this.todayTransactions = 0,
    this.weekSales = 0,
    this.monthSales = 0,
    this.lowStockCount = 0,
    this.pendingDebts = 0,
    this.activeCustomers = 0,
    this.topProducts = const [],
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    // Backend retorna valores em centavos (Int), converter para reais dividindo por 100
    return DashboardStats(
      todaySales:
          (json['todaySales'] ?? json['today_sales'] ?? 0).toDouble() / 100,
      todayTransactions: json['todayTransactions'] ??
          json['todaySalesCount'] ??
          json['today_transactions'] ??
          0,
      weekSales:
          (json['weekSales'] ?? json['weekRevenue'] ?? json['week_sales'] ?? 0)
                  .toDouble() /
              100,
      monthSales: (json['monthSales'] ??
                  json['monthRevenue'] ??
                  json['month_sales'] ??
                  0)
              .toDouble() /
          100,
      lowStockCount: json['lowStockCount'] ?? json['low_stock_count'] ?? 0,
      pendingDebts:
          (json['pendingDebts'] ?? json['pending_debts'] ?? 0).toDouble() / 100,
      activeCustomers: json['activeCustomers'] ??
          json['customersCount'] ??
          json['active_customers'] ??
          0,
      topProducts: (json['topProducts'] as List<dynamic>?)
              ?.map((p) => TopProduct.fromJson(p))
              .toList() ??
          [],
    );
  }
}

// Top Product Model
class TopProduct {
  final String productId;
  final String productName;
  final int quantitySold;
  final double totalRevenue;

  TopProduct({
    required this.productId,
    required this.productName,
    required this.quantitySold,
    required this.totalRevenue,
  });

  factory TopProduct.fromJson(Map<String, dynamic> json) {
    return TopProduct(
      productId: json['product_id'] ?? json['productId'] ?? '',
      productName: json['product_name'] ?? json['productName'] ?? '',
      quantitySold: json['quantity_sold'] ?? json['quantitySold'] ?? 0,
      totalRevenue: (json['total_revenue'] ?? json['totalRevenue'] ?? 0) / 100,
    );
  }
}

// ============================================
// 🎯 DETALHES DO CAIXA - PARIDADE COM ELECTRON
// ============================================

/// Item de venda agregado por produto (para detalhes do caixa)
class SalesItemDetail {
  final String productId;
  final String productName;
  final String? sku;
  final int qtySold;
  final double revenue;
  final double cost;
  final double profit;
  final double margin;

  SalesItemDetail({
    required this.productId,
    required this.productName,
    this.sku,
    required this.qtySold,
    required this.revenue,
    required this.cost,
    required this.profit,
    required this.margin,
  });

  factory SalesItemDetail.fromJson(Map<String, dynamic> json) {
    return SalesItemDetail(
      productId: json['productId'] ?? json['product_id'] ?? '',
      productName: json['productName'] ?? json['product_name'] ?? '',
      sku: json['sku'],
      qtySold: json['qtySold'] ?? json['qty_sold'] ?? 0,
      revenue: (json['revenue'] ?? 0).toDouble() / 100,
      cost: (json['cost'] ?? 0).toDouble() / 100,
      profit: (json['profit'] ?? 0).toDouble() / 100,
      margin: (json['margin'] ?? 0).toDouble(),
    );
  }
}

/// Métricas de lucro do caixa (calculadas pelo servidor)
class ProfitMetrics {
  final double totalRevenue;
  final double totalCOGS;
  final double grossProfit;
  final double profitMargin;
  final double netProfit;
  final double netMargin;
  final List<SalesItemDetail> salesItems;

  ProfitMetrics({
    required this.totalRevenue,
    required this.totalCOGS,
    required this.grossProfit,
    required this.profitMargin,
    required this.netProfit,
    required this.netMargin,
    required this.salesItems,
  });

  factory ProfitMetrics.fromJson(Map<String, dynamic> json) {
    return ProfitMetrics(
      totalRevenue: (json['totalRevenue'] ?? 0).toDouble() / 100,
      totalCOGS: (json['totalCOGS'] ?? 0).toDouble() / 100,
      grossProfit: (json['grossProfit'] ?? 0).toDouble() / 100,
      profitMargin: (json['profitMargin'] ?? 0).toDouble(),
      netProfit: (json['netProfit'] ?? 0).toDouble() / 100,
      netMargin: (json['netMargin'] ?? 0).toDouble(),
      salesItems: (json['salesItems'] as List<dynamic>?)
              ?.map((item) => SalesItemDetail.fromJson(item))
              .toList() ??
          [],
    );
  }
}

/// Detalhes completos do caixa (paridade com Electron)
/// Retornado pelo endpoint GET /cash-box/:id/details
class CashBoxDetails {
  final String id;
  final String boxNumber;
  final String branchId;
  final String status;
  final DateTime openedAt;
  final DateTime? closedAt;
  final double openingCash;
  final double? closingCash;
  final double? difference;
  final String? notes;
  final String? openedBy;

  // Contagem de vendas
  final int salesCount;

  // Totais por método de pagamento
  final double totalSales;
  final double totalCash;
  final double totalMobileMoney;
  final double totalCard;
  final double totalDebt;

  // 🎯 Métricas de lucro (fonte da verdade do servidor)
  final ProfitMetrics profitMetrics;

  CashBoxDetails({
    required this.id,
    required this.boxNumber,
    required this.branchId,
    required this.status,
    required this.openedAt,
    this.closedAt,
    required this.openingCash,
    this.closingCash,
    this.difference,
    this.notes,
    this.openedBy,
    required this.salesCount,
    required this.totalSales,
    required this.totalCash,
    required this.totalMobileMoney,
    required this.totalCard,
    required this.totalDebt,
    required this.profitMetrics,
  });

  factory CashBoxDetails.fromJson(Map<String, dynamic> json) {
    return CashBoxDetails(
      id: json['id'] ?? '',
      boxNumber: json['boxNumber'] ?? json['box_number'] ?? '',
      branchId: json['branchId'] ?? json['branch_id'] ?? '',
      status: json['status'] ?? 'closed',
      openedAt:
          DateTime.tryParse(json['openedAt'] ?? json['opened_at'] ?? '') ??
              DateTime.now(),
      closedAt: json['closedAt'] != null
          ? DateTime.tryParse(json['closedAt'])
          : json['closed_at'] != null
              ? DateTime.tryParse(json['closed_at'])
              : null,
      openingCash:
          (json['openingCash'] ?? json['opening_cash'] ?? 0).toDouble() / 100,
      closingCash: json['closingCash'] != null
          ? (json['closingCash']).toDouble() / 100
          : json['closing_cash'] != null
              ? (json['closing_cash']).toDouble() / 100
              : null,
      difference: json['difference'] != null
          ? (json['difference']).toDouble() / 100
          : null,
      notes: json['notes'],
      openedBy: json['openedBy'] ?? json['opened_by'],
      salesCount: json['salesCount'] ?? json['sales_count'] ?? 0,
      totalSales:
          (json['totalSales'] ?? json['total_sales'] ?? 0).toDouble() / 100,
      totalCash:
          (json['totalCash'] ?? json['total_cash'] ?? 0).toDouble() / 100,
      totalMobileMoney:
          (json['totalMobileMoney'] ?? json['total_mobile_money'] ?? 0)
                  .toDouble() /
              100,
      totalCard:
          (json['totalCard'] ?? json['total_card'] ?? 0).toDouble() / 100,
      totalDebt:
          (json['totalDebt'] ?? json['total_debt'] ?? 0).toDouble() / 100,
      profitMetrics: ProfitMetrics.fromJson(json['profitMetrics'] ?? {}),
    );
  }

  /// Duração do caixa em formato legível
  String get duration {
    if (closedAt == null) return 'Aberto';
    final diff = closedAt!.difference(openedAt);
    if (diff.inHours > 0) {
      return '${diff.inHours}h ${diff.inMinutes % 60}min';
    }
    return '${diff.inMinutes}min';
  }
}
