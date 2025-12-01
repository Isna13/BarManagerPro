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
      paymentMethod: json['payment_method'] ?? json['paymentMethod'] ?? 'cash',
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
    return Debt(
      id: json['id'] ?? '',
      customerId: json['customer_id'] ?? json['customerId'] ?? '',
      customerName: json['customer_name'] ?? json['customerName'],
      saleId: json['sale_id'] ?? json['saleId'],
      originalAmount:
          (json['original_amount'] ?? json['originalAmount'] ?? 0) / 100,
      paidAmount: (json['paid_amount'] ?? json['paidAmount'] ?? 0) / 100,
      remainingAmount:
          (json['remaining_amount'] ?? json['remainingAmount'] ?? 0) / 100,
      status: json['status'] ?? 'pending',
      dueDate:
          json['due_date'] != null ? DateTime.tryParse(json['due_date']) : null,
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
      paymentMethod: json['payment_method'] ?? json['paymentMethod'],
      notes: json['notes'],
      paidAt: DateTime.tryParse(json['paid_at'] ?? json['paidAt'] ?? '') ??
          DateTime.now(),
    );
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
  final String productId;
  final String? productName;
  final String branchId;
  final String movementType;
  final int quantity;
  final String? referenceType;
  final String? referenceId;
  final String? notes;
  final String? userId;
  final String? userName;
  final DateTime createdAt;

  InventoryMovement({
    required this.id,
    required this.productId,
    this.productName,
    required this.branchId,
    required this.movementType,
    required this.quantity,
    this.referenceType,
    this.referenceId,
    this.notes,
    this.userId,
    this.userName,
    required this.createdAt,
  });

  factory InventoryMovement.fromJson(Map<String, dynamic> json) {
    // O backend pode retornar product e user como objetos aninhados
    final product = json['product'] as Map<String, dynamic>?;
    final user = json['user'] as Map<String, dynamic>?;

    return InventoryMovement(
      id: json['id'] ?? '',
      productId: json['product_id'] ?? json['productId'] ?? '',
      productName:
          product?['name'] ?? json['product_name'] ?? json['productName'],
      branchId: json['branch_id'] ?? json['branchId'] ?? '',
      movementType: json['movement_type'] ?? json['movementType'] ?? '',
      quantity: json['quantity'] ?? 0,
      referenceType: json['reference_type'] ?? json['referenceType'],
      referenceId: json['reference_id'] ?? json['referenceId'],
      notes: json['notes'],
      userId: user?['id'] ?? json['user_id'] ?? json['userId'],
      userName: user?['fullName'] ?? json['user_name'] ?? json['userName'],
      createdAt:
          DateTime.tryParse(json['created_at'] ?? json['createdAt'] ?? '') ??
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
  final double subtotal;
  final double tax;
  final double discount;
  final double total;
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
    required this.subtotal,
    this.tax = 0,
    this.discount = 0,
    required this.total,
    required this.status,
    this.notes,
    required this.purchaseDate,
    this.receivedAt,
    this.items = const [],
  });

  factory Purchase.fromJson(Map<String, dynamic> json) {
    return Purchase(
      id: json['id'] ?? '',
      supplierId: json['supplier_id'] ?? json['supplierId'] ?? '',
      supplierName: json['supplier_name'] ?? json['supplierName'],
      invoiceNumber: json['invoice_number'] ?? json['invoiceNumber'],
      subtotal: (json['subtotal'] ?? 0) / 100,
      tax: (json['tax'] ?? 0) / 100,
      discount: (json['discount'] ?? 0) / 100,
      total: (json['total'] ?? 0) / 100,
      status: json['status'] ?? 'pending',
      notes: json['notes'],
      purchaseDate: DateTime.tryParse(
              json['purchase_date'] ?? json['purchaseDate'] ?? '') ??
          DateTime.now(),
      receivedAt: json['received_at'] != null
          ? DateTime.tryParse(json['received_at'])
          : null,
      items: (json['items'] as List<dynamic>?)
              ?.map((item) => PurchaseItem.fromJson(item))
              .toList() ??
          [],
    );
  }
}

// Purchase Item Model
class PurchaseItem {
  final String id;
  final String purchaseId;
  final String productId;
  final String? productName;
  final int quantity;
  final double unitCost;
  final double subtotal;

  PurchaseItem({
    required this.id,
    required this.purchaseId,
    required this.productId,
    this.productName,
    required this.quantity,
    required this.unitCost,
    required this.subtotal,
  });

  factory PurchaseItem.fromJson(Map<String, dynamic> json) {
    return PurchaseItem(
      id: json['id'] ?? '',
      purchaseId: json['purchase_id'] ?? json['purchaseId'] ?? '',
      productId: json['product_id'] ?? json['productId'] ?? '',
      productName: json['product_name'] ?? json['productName'],
      quantity: json['quantity'] ?? 1,
      unitCost: (json['unit_cost'] ?? json['unitCost'] ?? 0) / 100,
      subtotal: (json['subtotal'] ?? 0) / 100,
    );
  }
}

// Cash Box Model
class CashBox {
  final String id;
  final String branchId;
  final String? userId;
  final String? userName;
  final double openingBalance;
  final double? closingBalance;
  final double? totalSales;
  final double? totalCashIn;
  final double? totalCashOut;
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
    required this.status,
    required this.openedAt,
    this.closedAt,
    this.notes,
  });

  factory CashBox.fromJson(Map<String, dynamic> json) {
    return CashBox(
      id: json['id'] ?? '',
      branchId: json['branch_id'] ?? json['branchId'] ?? '',
      userId: json['user_id'] ?? json['userId'],
      userName: json['user_name'] ?? json['userName'],
      openingBalance:
          (json['opening_balance'] ?? json['openingBalance'] ?? 0) / 100,
      closingBalance: json['closing_balance'] != null
          ? (json['closing_balance']) / 100
          : json['closingBalance'] != null
              ? (json['closingBalance']) / 100
              : null,
      totalSales:
          json['total_sales'] != null ? (json['total_sales']) / 100 : null,
      totalCashIn:
          json['total_cash_in'] != null ? (json['total_cash_in']) / 100 : null,
      totalCashOut: json['total_cash_out'] != null
          ? (json['total_cash_out']) / 100
          : null,
      status: json['status'] ?? 'open',
      openedAt:
          DateTime.tryParse(json['opened_at'] ?? json['openedAt'] ?? '') ??
              DateTime.now(),
      closedAt: json['closed_at'] != null
          ? DateTime.tryParse(json['closed_at'])
          : null,
      notes: json['notes'],
    );
  }

  double get expectedBalance {
    return openingBalance +
        (totalSales ?? 0) +
        (totalCashIn ?? 0) -
        (totalCashOut ?? 0);
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
