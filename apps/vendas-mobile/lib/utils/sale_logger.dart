import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../services/database_service.dart';

/// Logger para monitorar vendas e detectar problemas
class SaleLogger {
  static final SaleLogger instance = SaleLogger._init();
  final DatabaseService _db = DatabaseService.instance;

  SaleLogger._init();

  /// Registra uma venda para análise posterior
  Future<void> logSale({
    required String saleId,
    required String saleNumber,
    required List<Map<String, dynamic>> cartItems,
    required String paymentMethod,
    required int total,
    String? customerId,
  }) async {
    try {
      debugPrint('');
      debugPrint(
          '═══════════════════════════════════════════════════════════════');
      debugPrint('📋 LOG DE VENDA - INÍCIO');
      debugPrint(
          '═══════════════════════════════════════════════════════════════');
      debugPrint('🆔 Sale ID: $saleId');
      debugPrint('📝 Sale Number: $saleNumber');
      debugPrint('💳 Payment Method: $paymentMethod');
      debugPrint('💰 Total: $total');
      debugPrint('👤 Customer ID: ${customerId ?? "N/A"}');
      debugPrint('📦 Itens do carrinho: ${cartItems.length}');
      debugPrint(
          '───────────────────────────────────────────────────────────────');

      // Analisar cada item
      final Map<String, List<Map<String, dynamic>>> productOccurrences = {};

      for (int i = 0; i < cartItems.length; i++) {
        final item = cartItems[i];
        final productId = item['productId'] ?? item['product_id'] ?? 'unknown';
        final productName = item['productName'] ?? item['name'] ?? 'Unknown';
        final quantity = item['quantity'] ?? item['qty_units'] ?? 0;
        final unitPrice = item['unitPrice'] ?? item['unit_price'] ?? 0;
        final itemTotal = item['total'] ?? (quantity * unitPrice);

        debugPrint('  Item #${i + 1}:');
        debugPrint('    - Product ID: $productId');
        debugPrint('    - Name: $productName');
        debugPrint('    - Quantity: $quantity');
        debugPrint('    - Unit Price: $unitPrice');
        debugPrint('    - Item Total: $itemTotal');

        // Agrupar por productId para detectar duplicatas
        if (!productOccurrences.containsKey(productId)) {
          productOccurrences[productId] = [];
        }
        productOccurrences[productId]!.add(item);
      }

      debugPrint(
          '───────────────────────────────────────────────────────────────');

      // Verificar duplicatas
      bool hasDuplicates = false;
      for (final entry in productOccurrences.entries) {
        if (entry.value.length > 1) {
          hasDuplicates = true;
          debugPrint('⚠️ DUPLICATA DETECTADA!');
          debugPrint('   Product ID: ${entry.key}');
          debugPrint('   Ocorrências: ${entry.value.length}');
          for (int i = 0; i < entry.value.length; i++) {
            debugPrint(
                '   Ocorrência #${i + 1}: ${jsonEncode(entry.value[i])}');
          }
        }
      }

      if (!hasDuplicates) {
        debugPrint('✅ Nenhuma duplicata detectada no carrinho');
      }

      debugPrint(
          '═══════════════════════════════════════════════════════════════');
      debugPrint('📋 LOG DE VENDA - FIM');
      debugPrint(
          '═══════════════════════════════════════════════════════════════');
      debugPrint('');

      // Verificar no banco também
      await _checkDatabaseForDuplicates(saleId);
    } catch (e) {
      debugPrint('❌ Erro ao registrar log de venda: $e');
    }
  }

  /// Verifica se há itens duplicados no banco de dados
  Future<void> _checkDatabaseForDuplicates(String saleId) async {
    try {
      debugPrint('');
      debugPrint('🔍 VERIFICAÇÃO NO BANCO DE DADOS');
      debugPrint(
          '───────────────────────────────────────────────────────────────');

      // Buscar todos os itens desta venda
      final saleItems = await _db.query(
        'sale_items',
        where: 'sale_id = ?',
        whereArgs: [saleId],
      );

      debugPrint('📦 Itens no banco: ${saleItems.length}');

      // Agrupar por product_id
      final Map<String, List<Map<String, dynamic>>> dbProductOccurrences = {};

      for (final item in saleItems) {
        final productId = item['product_id'] ?? 'unknown';
        debugPrint(
            '   - ID: ${item['id']}, Product: $productId, Qty: ${item['qty_units']}');

        if (!dbProductOccurrences.containsKey(productId)) {
          dbProductOccurrences[productId] = [];
        }
        dbProductOccurrences[productId]!.add(item);
      }

      // Verificar duplicatas
      bool hasDbDuplicates = false;
      for (final entry in dbProductOccurrences.entries) {
        if (entry.value.length > 1) {
          hasDbDuplicates = true;
          debugPrint('');
          debugPrint('⚠️ DUPLICATA NO BANCO DETECTADA!');
          debugPrint('   Product ID: ${entry.key}');
          debugPrint('   Registros duplicados: ${entry.value.length}');
          for (int i = 0; i < entry.value.length; i++) {
            final dup = entry.value[i];
            debugPrint(
                '   Registro #${i + 1}: ID=${dup['id']}, Qty=${dup['qty_units']}, Total=${dup['total']}');
          }
        }
      }

      if (!hasDbDuplicates) {
        debugPrint('✅ Nenhuma duplicata detectada no banco de dados');
      }

      debugPrint(
          '───────────────────────────────────────────────────────────────');
      debugPrint('');
    } catch (e) {
      debugPrint('❌ Erro ao verificar duplicatas no banco: $e');
    }
  }

  /// Analisa vendas recentes em busca de anomalias
  Future<void> analyzeRecentSales({int limit = 10}) async {
    try {
      debugPrint('');
      debugPrint(
          '═══════════════════════════════════════════════════════════════');
      debugPrint('🔍 ANÁLISE DE VENDAS RECENTES');
      debugPrint(
          '═══════════════════════════════════════════════════════════════');

      // Buscar vendas recentes
      final sales = await _db.query(
        'sales',
        orderBy: 'created_at DESC',
        limit: limit,
      );

      debugPrint('📊 Vendas encontradas: ${sales.length}');
      debugPrint('');

      int salesWithDuplicates = 0;

      for (final sale in sales) {
        final saleId = sale['id'];
        final saleNumber = sale['sale_number'] ?? 'N/A';

        // Buscar itens
        final items = await _db.query(
          'sale_items',
          where: 'sale_id = ?',
          whereArgs: [saleId],
        );

        // Verificar duplicatas
        final Map<String, int> productCount = {};
        for (final item in items) {
          final productId = item['product_id'] ?? 'unknown';
          productCount[productId] = (productCount[productId] ?? 0) + 1;
        }

        final duplicates =
            productCount.entries.where((e) => e.value > 1).toList();

        if (duplicates.isNotEmpty) {
          salesWithDuplicates++;
          debugPrint('⚠️ Venda $saleNumber ($saleId) - DUPLICATAS:');
          for (final dup in duplicates) {
            debugPrint('   Product ${dup.key}: ${dup.value} registros');
          }
        } else {
          debugPrint('✅ Venda $saleNumber - OK');
        }
      }

      debugPrint('');
      debugPrint(
          '───────────────────────────────────────────────────────────────');
      debugPrint(
          '📈 RESUMO: $salesWithDuplicates de ${sales.length} vendas com duplicatas');
      debugPrint(
          '═══════════════════════════════════════════════════════════════');
      debugPrint('');
    } catch (e) {
      debugPrint('❌ Erro ao analisar vendas: $e');
    }
  }

  /// Monitora o carrinho em tempo real
  void logCartState(List<Map<String, dynamic>> cart) {
    debugPrint('');
    debugPrint('🛒 ESTADO DO CARRINHO');
    debugPrint(
        '───────────────────────────────────────────────────────────────');
    debugPrint('Itens: ${cart.length}');

    final Map<String, int> productCount = {};
    for (final item in cart) {
      final productId = item['productId'] ?? item['product_id'] ?? 'unknown';
      productCount[productId] = (productCount[productId] ?? 0) + 1;
    }

    for (final entry in productCount.entries) {
      if (entry.value > 1) {
        debugPrint('⚠️ Produto ${entry.key} aparece ${entry.value} vezes!');
      }
    }

    for (int i = 0; i < cart.length; i++) {
      final item = cart[i];
      debugPrint(
          '  [$i] ${item['productName'] ?? item['name']} x${item['quantity']} = ${item['total']}');
    }
    debugPrint(
        '───────────────────────────────────────────────────────────────');
    debugPrint('');
  }
}
