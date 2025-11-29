# Correção de Pontos de Fidelidade

## Problema Identificado
A lógica de pontos estava incorreta:
- ❌ **ANTES**: 1.000 centavos (10 FCFA) = 1 ponto
- ✅ **DEPOIS**: 100.000 centavos (1.000 FCFA) = 1 ponto

## Correção Implementada

### 1. Lógica Corrigida em `manager.ts`

#### `processTableCustomerPayment()` (linha ~4393)
```typescript
// ANTES (ERRADO):
const pointsToAdd = Math.floor(data.amount / 1000); // 1 ponto por 10 FCFA ❌

// DEPOIS (CORRETO):
const pointsToAdd = Math.floor(data.amount / 100000); // 1 ponto por 1.000 FCFA ✅
```

#### `processTableSessionPayment()` (linha ~4655)
```typescript
// ANTES (ERRADO):
const pointsToAdd = Math.floor(data.amount / 1000); // 1 ponto por 10 FCFA ❌

// DEPOIS (CORRETO):
const pointsToAdd = Math.floor(data.amount / 100000); // 1 ponto por 1.000 FCFA ✅
```

### 2. Método de Correção Automática

Adicionado método `fixCustomerLoyaltyPoints()` que:
- Calcula total gasto pelo cliente em todas as vendas
- Recalcula pontos corretos (1 ponto = 1.000 FCFA)
- Atualiza automaticamente os pontos do cliente

## Como Corrigir os Pontos do William Brandão

### Opção 1: Via DevTools (Console do Navegador)

1. Abrir o aplicativo desktop
2. Pressionar `F12` para abrir DevTools
3. Ir para aba **Console**
4. Executar o comando:

```javascript
window.electronAPI.loyalty.fixCustomerPoints('CUST-941388').then(result => {
  console.log('✅ Pontos corrigidos!');
  console.log('Cliente:', result.customerName);
  console.log('Pontos anteriores:', result.previousPoints);
  console.log('Pontos corretos:', result.correctPoints);
  console.log('Diferença:', result.difference);
  console.log('Total gasto:', result.totalSpent, 'FCFA');
});
```

### Opção 2: Via IPC (Código TypeScript)

```typescript
const result = await electronAPI.loyalty.fixCustomerPoints('CUST-941388');
console.log(result);
```

### Opção 3: Direto no Banco SQLite

```sql
-- 1. Ver total gasto pelo William
SELECT 
  c.code,
  c.full_name,
  c.loyalty_points as pontos_atuais,
  COALESCE(SUM(s.total), 0) as total_gasto,
  FLOOR(COALESCE(SUM(s.total), 0) / 100000) as pontos_corretos
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id AND s.status = 'paid'
WHERE c.code = 'CUST-941388'
GROUP BY c.id;

-- 2. Atualizar pontos (substituir X pelo valor correto)
UPDATE customers 
SET loyalty_points = X,
    updated_at = datetime('now')
WHERE code = 'CUST-941388';
```

## Exemplo de Cálculo

Se William Brandão (CUST-941388) gastou **34.000 FCFA**:

```
Total gasto: 34.000 FCFA = 3.400.000 centavos
Pontos corretos: 3.400.000 ÷ 100.000 = 34 pontos

Mas ele tem 340 pontos (calculado com a fórmula errada)
Diferença: 340 - 34 = 306 pontos A MENOS
```

## Logs de Debug

O método `fixCustomerLoyaltyPoints()` gera logs detalhados:

```
[FIX LOYALTY] Cliente: William Brandão (CUST-941388)
[FIX LOYALTY] Total gasto: 34000 FCFA
[FIX LOYALTY] Pontos atuais: 340
[FIX LOYALTY] Pontos corretos: 34
[FIX LOYALTY] Diferença: -306
```

## Resultado Esperado

Após executar a correção:
- ✅ Pontos do William serão recalculados automaticamente
- ✅ Banco de dados atualizado
- ✅ Sincronização marcada (synced = 0)
- ✅ Futuros pagamentos usarão lógica correta

## Verificação

Para verificar se os pontos estão corretos:

```javascript
// Console do navegador
window.electronAPI.customers.getById('ID_DO_CLIENTE').then(customer => {
  console.log('Nome:', customer.name);
  console.log('Pontos:', customer.loyalty_points);
});
```

---

**Última atualização:** 27/11/2025
**Status:** ✅ Correção implementada e pronta para uso
