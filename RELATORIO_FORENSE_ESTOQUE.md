# 🚨 RELATÓRIO FORENSE: BUG CRÍTICO DE ESTOQUE

**Data:** 8 de Janeiro de 2026  
**Severidade:** CRÍTICA  
**Status:** CAUSA RAIZ IDENTIFICADA  

---

## 📋 SUMÁRIO EXECUTIVO

### O Problema
Produtos vendidos estavam tendo suas quantidades **AUMENTADAS** ao invés de subtraídas. O estoque no servidor Railway está **inconsistente** com a realidade financeira.

### A Causa Raiz
**DUAL-PATH DE SINCRONIZAÇÃO CONFLITANTE**

O sistema tinha **DOIS caminhos** de sincronização de estoque que competiam entre si:

1. **`stock_movement`** (CORRETO): Envia deltas (-N) para vendas
2. **`inventory` upsert** (INCORRETO): Sobrescreve valor absoluto do estoque local

Quando o Electron sincronizava, ele enviava:
- ✅ `stock_movement`: `adjustment: -3` (correto)
- ❌ `inventory`: `qtyUnits: 529` (valor absoluto local - **SOBRESCREVIA o servidor**)

---

## 🔍 EVIDÊNCIAS FORENSES

### 1. Discrepância Entre Movimentações e Estoque

```
AUDITORIA: ESTOQUE ATUAL vs SOMA DAS MOVIMENTAÇÕES
═════════════════════════════════════════════════════════════════════
Produto                      | Atual | Calculado | DIFERENÇA
Super Bock mini              |   529 |      -255 | +784 🔴
Cristal                      |   139 |       +50 | +89 🔴
fogo de Pias                 |    93 |       -19 | +112 🔴
... (total de 23 produtos afetados)

DISCREPÂNCIA TOTAL: +1549 unidades
```

**Significado:** Existem 1549 unidades no estoque que **NÃO TÊM** movimentação correspondente registrada. Foram inseridas por upsert direto.

### 2. Padrão de Duplicação Identificado

```
ANÁLISE DE MOVIMENTAÇÕES SUSPEITAS
═════════════════════════════════════════════════════════════════════
[2026-01-03T16:47] +240 | Super Bock mini | Compra recebida
[2026-01-03T16:47] +240 | Super Bock mini | Compra recebida  ← DUPLICADA
[2026-01-03T21:26] +152 | Super Bock mini | Correcao compras-vendas
[2026-01-03T22:07] +152 | Super Bock mini | Fix  ← DUPLICADA
```

### 3. Estoque Correto Calculado

Baseado em **Compras Completas - Vendas Válidas**:

| Produto | Compras | Vendas | CORRETO | ATUAL | CORREÇÃO |
|---------|---------|--------|---------|-------|----------|
| Super Bock mini | 1392 | 984 | **408** | 529 | -121 |
| Cristal | 264 | 184 | **80** | 139 | -59 |
| fogo de Pias | 228 | 154 | **74** | 93 | -19 |
| Maza | 96 | 46 | **50** | 24 | +26 |
| Coca cola | 72 | 22 | **50** | 32 | +18 |
| ... | ... | ... | ... | ... | ... |

---

## 🧱 CÓDIGO FONTE DO BUG

### Local 1: `sync/manager.ts` (linhas 3665-3700)

```typescript
case 'inventory':
case 'inventory_item':
  if (operation === 'update' || operation === 'create') {
    // Se tem adjustment, usar endpoint de delta (mais seguro para multi-PC)
    if (data.adjustment !== undefined && data.adjustment !== null) {
      // ... usa delta (correto)
    }
    
    // 🔴 FALLBACK PROBLEMÁTICO: 
    // Se delta falhar, SOBRESCREVE com valor absoluto!
    await this.apiClient.post('/inventory', {
      productId: data.productId,
      qtyUnits: data.qtyUnits,  // ← SOBRESCREVE TODO O ESTOQUE!
    });
  }
```

### Local 2: `inventory.service.ts` (linhas 333-418)

```typescript
async upsertInventoryItem(dto: UpsertInventoryItemDto) {
  // ...
  const inventoryData = {
    qtyUnits: data.qtyUnits ?? 0,  // ← SOBRESCREVE SEM REGISTRAR MOVIMENTAÇÃO
  };
  
  // 🔴 BUG: Atualiza estoque SEM criar InventoryMovement!
  return this.prisma.inventoryItem.update({
    where: { id: existing.id },
    data: inventoryData,  // ← PERDE HISTÓRICO!
  });
}
```

### Local 3: `database/manager.ts` (linhas 2620-2635)

O código foi corrigido recentemente para NÃO enviar `inventory` após venda:
```typescript
// 🔴 CORREÇÃO CRÍTICA: NÃO sincronizar como 'inventory' (valor absoluto)!
// O registerStockMovement() acima já adiciona à fila como 'stock_movement'
// REMOVIDO:
// this.addToSyncQueue('update', 'inventory', inventory.id, {...});
```

Porém, **a correção não foi aplicada a TODOS os pontos de entrada**.

---

## 🌳 DIAGRAMA DA CAUSA RAIZ

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DO BUG                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ELECTRON LOCAL (SQLite)                                                       │
│   ┌─────────────────────┐                                                       │
│   │ Estoque: 500        │                                                       │
│   │ Venda: -3           │                                                       │
│   │ Novo: 497           │                                                       │
│   └─────────┬───────────┘                                                       │
│             │                                                                   │
│             │ SYNC                                                              │
│             │                                                                   │
│   ┌─────────▼───────────┐    ┌─────────────────────────────────────┐           │
│   │ stock_movement:     │    │ inventory (fallback):               │           │
│   │ adjustment = -3     │    │ qtyUnits = 497                      │           │
│   └─────────┬───────────┘    └─────────────────┬───────────────────┘           │
│             │                                  │                               │
│             ▼                                  ▼                               │
│   ┌─────────────────────────────────────────────────────────────────┐         │
│   │                   RAILWAY (PostgreSQL)                           │         │
│   │                                                                  │         │
│   │   Estoque: 500                                                   │         │
│   │         │                                                        │         │
│   │         ├──── stock_movement (-3) ──────► 497 ✅                │         │
│   │         │                                                        │         │
│   │         └──── inventory (497) ──────────► 497 (OK agora)        │         │
│   │                                                                  │         │
│   │   MAS SE PC2 VENDEU -5 ANTES:                                   │         │
│   │         │                                                        │         │
│   │         └──── inventory do PC1 (497) ──► 497 🔴 SOBRESCREVEU!   │         │
│   │              (deveria ser 495)                                   │         │
│   └─────────────────────────────────────────────────────────────────┘         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ PLANO DE CORREÇÃO

### Fase 1: Correção Imediata dos Dados (HOJE)

1. **Aplicar correções calculadas no Railway:**
   - Super Bock mini: 529 → 408 (adjustment: -121)
   - Cristal: 139 → 80 (adjustment: -59)
   - fogo de Pias: 93 → 74 (adjustment: -19)
   - ... (todos os 20 produtos)

2. **Script de correção criado:** `fix-stock-railway.js`

### Fase 2: Correção do Código (HOJE)

1. **REMOVER fallback de upsert** no sync manager
2. **Adicionar validação de idempotência** por movement_id
3. **Bloquear endpoint POST /inventory** para não aceitar qtyUnits diretamente

### Fase 3: Prevenção (ESTA SEMANA)

1. **Implementar tabela `stock_ledger`** como fonte única da verdade
2. **Adicionar hash/idempotency_key** em movimentações
3. **Criar triggers de auditoria**
4. **Alertas automáticos** para divergências

---

## 📊 ARQUITETURA CORRETA (PROPOSTA)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA BLINDADA DE ESTOQUE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   REGRA DE OURO: ESTOQUE SÓ MUDA NO SERVIDOR VIA MOVIMENTAÇÃO                 │
│                                                                                 │
│   ┌──────────────────┐                                                         │
│   │  ELECTRON/MOBILE │                                                         │
│   │                  │                                                         │
│   │  ❌ NÃO FAZ:     │                                                         │
│   │  - Calcular      │                                                         │
│   │    estoque       │                                                         │
│   │  - Enviar valores│                                                         │
│   │    absolutos     │                                                         │
│   │                  │                                                         │
│   │  ✅ FAZ:         │                                                         │
│   │  - Enviar DELTA  │                                                         │
│   │  - Receber       │                                                         │
│   │    SNAPSHOT      │                                                         │
│   └────────┬─────────┘                                                         │
│            │                                                                   │
│            │ POST /stock-movements                                             │
│            │ { type: 'sale', delta: -3, idempotencyKey: 'uuid' }              │
│            │                                                                   │
│            ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────┐         │
│   │                    BACKEND (Railway)                             │         │
│   │                                                                  │         │
│   │   1. Verificar idempotencyKey (se existe, ignorar)              │         │
│   │   2. Calcular novo estoque: current + delta                     │         │
│   │   3. Inserir em stock_movements                                 │         │
│   │   4. Atualizar inventory_items.qty_units                        │         │
│   │   5. Retornar snapshot atualizado                               │         │
│   │                                                                  │         │
│   │   Tabela: stock_movements (APPEND-ONLY)                         │         │
│   │   ┌──────────────────────────────────────────────────────────┐ │         │
│   │   │ id | product_id | type   | delta | idempotency_key       │ │         │
│   │   │ 1  | prod123    | sale   | -3    | mov-uuid-001          │ │         │
│   │   │ 2  | prod123    | purch  | +24   | mov-uuid-002          │ │         │
│   │   └──────────────────────────────────────────────────────────┘ │         │
│   │                                                                  │         │
│   │   Estoque = SUM(delta) por produto                              │         │
│   │   (ou cache em inventory_items atualizado por trigger)          │         │
│   │                                                                  │         │
│   └─────────────────────────────────────────────────────────────────┘         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Imediato (Hoje)
- [ ] Executar `fix-stock-railway.js` para corrigir estoque atual
- [ ] Remover fallback de upsert no sync manager
- [ ] Deploy no Railway

### Curto Prazo (Esta Semana)
- [ ] Adicionar `idempotency_key` em stock_movements
- [ ] Criar endpoint único `/stock-movements` que calcula estoque
- [ ] Bloquear atualização direta de qtyUnits

### Médio Prazo (Este Mês)
- [ ] Dashboard de auditoria de estoque
- [ ] Alertas automáticos por discrepância
- [ ] Testes automatizados de cenários multi-PC

---

## 📜 CONCLUSÃO

**O bug foi causado por uma falha arquitetural**: o sistema permitia dois caminhos de atualização de estoque que conflitavam entre si. A correção exige:

1. **Corrigir dados** no Railway baseado em compras - vendas
2. **Eliminar fallback de upsert** que sobrescreve estoque
3. **Implementar idempotência** para movimentações
4. **Auditar continuamente** para detectar divergências

---

*Relatório gerado automaticamente pelo sistema de auditoria forense.*
