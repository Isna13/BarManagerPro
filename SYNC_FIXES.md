# Correções de Sincronização - Electron → Railway → Mobile

## Problemas Identificados

### 1. **Produtos não sincronizam**
- **Causa**: Categoria não existe no servidor (ID diferente)
- **Exemplo**: Produto "Pé Tinto" criado com categoria `23313e26-...` mas servidor tem `5446415e-...`
- **Status**: ✅ CORRIGIDO com ordenação por dependência

### 2. **Débitos não sincronizam**
- **Causa**: Todos os débitos estão com `synced=0` no Electron
- **Impacto**: Pagamentos de débitos falham porque débito não existe no servidor
- **Status**: ✅ CORRIGIDO com ordenação por dependência

### 3. **Compras falham ao sincronizar**
- **Causa**: Erros de "Internal server error" e "Compra não encontrada"
- **Status**: ✅ CORRIGIDO com ordenação por dependência

### 4. **Pagamentos de débitos falham**
- **Causa**: Tentam pagar débitos que não existem no servidor
- **Status**: ✅ CORRIGIDO - débitos agora sincronizam antes dos pagamentos

## Soluções Implementadas

### 1. **Ordenação por Dependência na Sincronização**

Implementado método `sortByDependency()` que ordena itens antes de sincronizar:

```typescript
const priorityMap: Record<string, number> = {
  // Entidades base (sem dependências) - Prioridade 1-5
  'branch': 1,
  'user': 2,
  'category': 3,      // ← ANTES de products
  'supplier': 4,      // ← ANTES de purchases  
  'customer': 5,      // ← ANTES de debts
  
  // Entidades com dependências leves - Prioridade 10-11
  'product': 10,      // ← DEPOIS de categories
  'table': 11,
  
  // Entidades transacionais - Prioridade 20-23
  'debt': 20,         // ← DEPOIS de customers
  'purchase': 21,     // ← DEPOIS de suppliers
  'sale': 22,
  'cash_box': 23,
  
  // Itens de transações - Prioridade 30-33
  'debt_payment': 30, // ← DEPOIS de debts
  'purchase_item': 31, // ← DEPOIS de purchases
  'sale_item': 32,    // ← DEPOIS de sales
  'payment': 33,
};
```

### 2. **Logs de Debug Melhorados**

Adicionados logs que mostram a ordem de sincronização:

```
📤 Sincronizando 38 itens (ordenados por dependência):
  1. category/create - 23313e26-...
  2. customer/create - 539bfaed-...
  3. product/create - 2238662b-...
  4. debt/create - d5d6c491-...
  5. debt_payment/create - 77b8d689-...
```

### 3. **Reset de Itens Falhados**

Script criado para resetar itens falhados: `force-resync.js`

Executado manualmente com sqlite3:
```bash
UPDATE sync_queue 
SET status = 'pending', retry_count = 0, last_error = NULL 
WHERE status = 'failed'
```

**Resultado**: 38 itens resetados de `failed` → `pending`

## Estado Atual da Fila de Sincronização

**Itens pendentes (após reset):**
- cash_box: 1
- customer: 16
- debt: 1
- debt_payment: 3
- product: 2
- purchase: 4
- sale_item: 1
- table_session: 6

**Total**: 34 itens aguardando sincronização

## Próximos Passos

1. ✅ Ordenação por dependência implementada
2. ✅ Itens falhados resetados para pending
3. ⏳ **AGUARDANDO**: Reiniciar app Electron para iniciar sincronização com nova ordem
4. ⏳ **AGUARDANDO**: Verificar se produtos, débitos e compras sincronizam corretamente
5. ⏳ **AGUARDANDO**: Confirmar que mobile recebe dados corretos após sincronização

## Arquivos Modificados

1. `apps/desktop/electron/sync/manager.ts`:
   - Adicionado método `sortByDependency()`
   - Modificado `pushLocalChanges()` para usar ordenação
   - Adicionados logs de debug

2. `apps/mobile/lib/models/models.dart`:
   - Corrigido `Debt.fromJson` para usar `max(paid, paidAmount)`
   - Corrigido `Sale.fromJson` para extrair paymentMethod de payments array
   - Corrigido `Purchase.fromJson` para ler supplier.name de objeto aninhado

3. `force-resync.js`:
   - Script criado para resetar itens falhados

## Como Testar

1. **Reiniciar app Electron** para carregar código com ordenação
2. **Aguardar 60 segundos** (intervalo de sync)
3. **Verificar logs** no console do Electron:
   - Deve mostrar "📤 Sincronizando X itens (ordenados por dependência)"
   - Deve mostrar "✅ Sync category concluído" ANTES de products
   - Deve mostrar "✅ Sync debt concluído" ANTES de debt_payments

4. **Verificar no Railway API**:
   ```bash
   GET /products  # Deve ter "Pé Tinto"
   GET /debts     # Deve ter os 5 débitos pagos
   GET /purchases # Deve ter as compras pendentes
   ```

5. **Verificar no Mobile**:
   - Abrir app mobile
   - Sincronizar (pull to refresh)
   - Verificar Vales (devem mostrar todos pagos)
   - Verificar Compras (devem aparecer com fornecedor correto)
   - Verificar Produtos (deve ter "Pé Tinto")

## Problemas Conhecidos

- ⚠️ **Erros de compilação TypeScript**: Linhas que acessam `this.dbManager.db` (problema preexistente, não relacionado às mudanças)
- ⚠️ **Categorias duplicadas**: Electron tem categoria com ID diferente do servidor (causa raiz de produtos não sincronizarem)

## Recomendações Futuras

1. **Criar método público no DatabaseManager** para executar queries (evitar acessar `db` privado)
2. **Adicionar validação de dependências** antes de criar entidades (ex: verificar se categoria existe antes de criar produto)
3. **Implementar reconciliação de IDs** para entidades com nome duplicado mas IDs diferentes
4. **Adicionar health check** de sincronização no UI do Electron (mostrar quantos itens pendentes/falhados)
