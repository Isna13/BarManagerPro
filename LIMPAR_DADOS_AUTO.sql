-- Script para limpar dados gerados automaticamente
-- Mantém apenas dados inseridos manualmente via Compras

-- 1. Limpar todo o estoque automático (inventory_items)
DELETE FROM inventory_items;

-- 2. Limpar movimentações de estoque (stock_movements)
DELETE FROM stock_movements;

-- 3. Limpar produtos de exemplo (opcionalmente)
-- Descomente as linhas abaixo se quiser remover os produtos de exemplo também:
-- DELETE FROM products WHERE sku IN ('BEB-001', 'BEB-002', 'BEB-003', 'BEB-004', 'BEB-005');
-- DELETE FROM categories WHERE name = 'Bebidas';

-- 4. Verificar dados restantes
SELECT '=== PRODUTOS REGISTRADOS ===' as info;
SELECT id, sku, name, price_unit, cost_unit FROM products;

SELECT '=== COMPRAS REGISTRADAS ===' as info;
SELECT p.id, p.purchase_number, p.status, p.total_amount, 
       COUNT(pi.id) as items_count
FROM purchases p
LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
GROUP BY p.id;

SELECT '=== ESTOQUE ATUAL (deve estar vazio) ===' as info;
SELECT COUNT(*) as total_items FROM inventory_items;

-- Instruções:
-- 1. Pare o aplicativo desktop se estiver rodando
-- 2. Execute este script no banco de dados SQLite
-- 3. Reinicie o aplicativo
-- 4. Vá para a aba "Compras" e receba/complete as compras novamente
-- 5. O estoque será recriado automaticamente através da função completePurchase()
