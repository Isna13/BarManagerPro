import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../services/database_service.dart';
import '../config/payment_methods.dart';

class CartItem {
  final String productId;
  final String productName;
  final double price;
  int quantity;
  String? notes;

  CartItem({
    required this.productId,
    required this.productName,
    required this.price,
    this.quantity = 1,
    this.notes,
  });

  double get total => price * quantity;

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'productName': productName,
        'price': price,
        'quantity': quantity,
        'notes': notes,
      };

  CartItem copyWith({
    String? productId,
    String? productName,
    double? price,
    int? quantity,
    String? notes,
  }) {
    return CartItem(
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      notes: notes ?? this.notes,
    );
  }
}

class CartProvider extends ChangeNotifier {
  final DatabaseService _db = DatabaseService.instance;
  final List<CartItem> _items = [];
  String? _customerId;
  String? _customerName;
  String? _tableSessionId;
  String? _tableId;
  bool _isLoading = false;
  String? _error;

  // Getters
  List<CartItem> get items => List.unmodifiable(_items);
  int get itemCount => _items.length;
  int get totalQuantity => _items.fold(0, (sum, item) => sum + item.quantity);
  double get subtotal => _items.fold(0.0, (sum, item) => sum + item.total);
  double get total => subtotal; // Pode adicionar descontos/taxas aqui
  bool get isEmpty => _items.isEmpty;
  bool get isNotEmpty => _items.isNotEmpty;
  String? get customerId => _customerId;
  String? get customerName => _customerName;
  String? get tableSessionId => _tableSessionId;
  String? get tableId => _tableId;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasCustomer => _customerId != null;
  bool get hasTable => _tableId != null;

  /// Adiciona um produto ao carrinho
  void addItem(Map<String, dynamic> product,
      {int quantity = 1, String? notes}) {
    final productId = product['id']?.toString() ?? '';
    final existingIndex =
        _items.indexWhere((item) => item.productId == productId);

    if (existingIndex >= 0) {
      // Produto já existe, incrementar quantidade
      _items[existingIndex].quantity += quantity;
    } else {
      // Novo produto
      _items.add(CartItem(
        productId: productId,
        productName: product['name']?.toString() ?? 'Produto',
        price: (product['price'] as num?)?.toDouble() ?? 0.0,
        quantity: quantity,
        notes: notes,
      ));
    }

    notifyListeners();
  }

  /// Remove um produto do carrinho
  void removeItem(String productId) {
    _items.removeWhere((item) => item.productId == productId);
    notifyListeners();
  }

  /// Atualiza a quantidade de um item
  void updateQuantity(String productId, int quantity) {
    final index = _items.indexWhere((item) => item.productId == productId);
    if (index >= 0) {
      if (quantity <= 0) {
        _items.removeAt(index);
      } else {
        _items[index].quantity = quantity;
      }
      notifyListeners();
    }
  }

  /// Incrementa quantidade
  void incrementQuantity(String productId) {
    final index = _items.indexWhere((item) => item.productId == productId);
    if (index >= 0) {
      _items[index].quantity++;
      notifyListeners();
    }
  }

  /// Decrementa quantidade
  void decrementQuantity(String productId) {
    final index = _items.indexWhere((item) => item.productId == productId);
    if (index >= 0) {
      if (_items[index].quantity > 1) {
        _items[index].quantity--;
      } else {
        _items.removeAt(index);
      }
      notifyListeners();
    }
  }

  /// Atualiza observação de um item
  void updateNotes(String productId, String? notes) {
    final index = _items.indexWhere((item) => item.productId == productId);
    if (index >= 0) {
      _items[index].notes = notes;
      notifyListeners();
    }
  }

  /// Define o cliente
  void setCustomer(String? id, String? name) {
    _customerId = id;
    _customerName = name;
    notifyListeners();
  }

  /// Remove o cliente
  void clearCustomer() {
    _customerId = null;
    _customerName = null;
    notifyListeners();
  }

  /// Define a mesa
  void setTable(String? tableId, String? sessionId) {
    _tableId = tableId;
    _tableSessionId = sessionId;
    notifyListeners();
  }

  /// Remove a mesa
  void clearTable() {
    _tableId = null;
    _tableSessionId = null;
    notifyListeners();
  }

  /// Limpa o carrinho
  void clear() {
    _items.clear();
    _customerId = null;
    _customerName = null;
    _tableSessionId = null;
    _tableId = null;
    _error = null;
    notifyListeners();
  }

  /// Finaliza a venda
  Future<Map<String, dynamic>?> checkout({
    required String paymentMethod,
    double? amountPaid,
    double? change,
    String? notes,
  }) async {
    if (_items.isEmpty) {
      _error = 'Carrinho vazio';
      notifyListeners();
      return null;
    }

    // Validar e normalizar método de pagamento - NUNCA assumir padrão
    String normalizedPaymentMethod;
    try {
      normalizedPaymentMethod = PaymentMethod.normalize(paymentMethod);
    } catch (e) {
      _error = 'Método de pagamento inválido: $paymentMethod';
      notifyListeners();
      return null;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uuid = const Uuid();
      final saleId = uuid.v4();
      final now = DateTime.now().toIso8601String();

      // Criar venda com payment_method normalizado
      // IMPORTANTE: Salvar como snake_case para compatibilidade com sincronização
      final sale = {
        'id': saleId,
        'customer_id': _customerId,
        'table_session_id': _tableSessionId,
        'subtotal': subtotal,
        'discount': 0.0,
        'total': total,
        'payment_method': normalizedPaymentMethod, // Sempre normalizado
        'payment_status': 'paid',
        'amount_paid': amountPaid ?? total,
        'change': change ?? 0.0,
        'notes': notes,
        'status': 'completed',
        'created_at': now,
        'updated_at': now,
        'synced': 0,
      };

      debugPrint('💰 Criando venda com payment_method: $normalizedPaymentMethod');
      await _db.insert('sales', sale);

      // Criar itens da venda
      for (final item in _items) {
        final saleItem = {
          'id': uuid.v4(),
          'sale_id': saleId,
          'product_id': item.productId,
          'product_name': item.productName,
          'qty_units': item.quantity,
          'unit_price': item.price,
          'total': item.total,
          'notes': item.notes,
          'synced': 0,
        };
        await _db.insert('sale_items', saleItem);

        // Baixar estoque
        await _updateInventory(item.productId, -item.quantity);
      }

      // Criar pagamento com método normalizado
      final payment = {
        'id': uuid.v4(),
        'sale_id': saleId,
        'method': normalizedPaymentMethod, // Usar método normalizado
        'amount': total,
        'status': 'completed',
        'created_at': now,
        'synced': 0,
      };
      debugPrint('💳 Criando pagamento com method: $normalizedPaymentMethod');
      await _db.insert('payments', payment);

      // Adicionar à fila de sincronização
      await _db.addToSyncQueue(
        entityType: 'sales',
        entityId: saleId,
        action: 'INSERT',
        data: sale,
      );

      // Limpar carrinho
      clear();

      _isLoading = false;
      notifyListeners();

      return sale;
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
      return null;
    }
  }

  /// Atualiza estoque do produto
  Future<void> _updateInventory(String productId, int quantityChange) async {
    try {
      final inventory = await _db.query(
        'inventory',
        where: 'productId = ?',
        whereArgs: [productId],
        limit: 1,
      );

      if (inventory.isNotEmpty) {
        final current = inventory.first;
        final newQuantity = (current['quantity'] as int? ?? 0) + quantityChange;
        await _db.update(
            'inventory',
            {
              'quantity': newQuantity < 0 ? 0 : newQuantity,
              'updatedAt': DateTime.now().toIso8601String(),
              'synced': 0,
            },
            where: 'id = ?',
            whereArgs: [current['id'].toString()]);
      }
    } catch (e) {
      debugPrint('Erro ao atualizar estoque: $e');
    }
  }

  /// Cria pedido para mesa (sem finalizar venda)
  Future<Map<String, dynamic>?> createTableOrder() async {
    if (_items.isEmpty || _tableSessionId == null) {
      _error = 'Carrinho vazio ou mesa não selecionada';
      notifyListeners();
      return null;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final uuid = const Uuid();
      final now = DateTime.now().toIso8601String();

      // Criar pedido para cada item
      for (final item in _items) {
        final order = {
          'id': uuid.v4(),
          'tableSessionId': _tableSessionId,
          'productId': item.productId,
          'productName': item.productName,
          'quantity': item.quantity,
          'unitPrice': item.price,
          'total': item.total,
          'notes': item.notes,
          'status': 'pending',
          'createdAt': now,
          'updatedAt': now,
          'synced': 0,
        };
        await _db.insert('table_orders', order);
        await _db.addToSyncQueue(
          entityType: 'table_orders',
          entityId: order['id'] as String,
          action: 'INSERT',
          data: order,
        );
      }

      // Limpar carrinho (manter mesa)
      _items.clear();

      _isLoading = false;
      notifyListeners();

      return {'success': true, 'tableSessionId': _tableSessionId};
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
      return null;
    }
  }
}
