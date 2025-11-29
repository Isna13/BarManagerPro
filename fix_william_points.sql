-- Correção de Pontos: William Brandão (CUST-941388)
-- 
-- Compras:
-- - 2x Muntu Super Bock (6 garrafas) = 2.400 FCFA
-- - 1x XL garrafa = 1.000 FCFA
-- Total: 3.400 FCFA
-- 
-- Lógica: 1.000 FCFA = 1 ponto
-- Pontos corretos: 3.400 ÷ 1.000 = 3 pontos (400 FCFA não conta)

-- 1. Verificar situação atual
SELECT 
  code as 'Código',
  full_name as 'Nome',
  loyalty_points as 'Pontos Atuais',
  COALESCE(SUM(s.total), 0)/100 as 'Total Gasto (FCFA)',
  FLOOR(COALESCE(SUM(s.total), 0) / 100000) as 'Pontos Corretos'
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id AND s.status = 'paid'
WHERE c.code = 'CUST-941388'
GROUP BY c.id;

-- 2. Corrigir pontos para 3
UPDATE customers 
SET loyalty_points = 3,
    updated_at = datetime('now'),
    synced = 0
WHERE code = 'CUST-941388';

-- 3. Verificar correção
SELECT 
  code as 'Código',
  full_name as 'Nome',
  loyalty_points as 'Pontos Após Correção'
FROM customers
WHERE code = 'CUST-941388';

-- 4. Ver histórico de vendas do cliente
SELECT 
  s.sale_number as 'Número Venda',
  s.type as 'Tipo',
  s.total/100 as 'Total (FCFA)',
  s.status as 'Status',
  s.created_at as 'Data',
  p.method as 'Método Pagamento'
FROM sales s
LEFT JOIN payments p ON s.id = p.sale_id
WHERE s.customer_id = (SELECT id FROM customers WHERE code = 'CUST-941388')
ORDER BY s.created_at DESC;
