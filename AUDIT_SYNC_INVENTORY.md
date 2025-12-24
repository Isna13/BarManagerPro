# 🔍 AUDITORIA: Sincronização de Estoque Electron ↔ Railway

**Data:** 24 de Dezembro de 2025  
**Problema:** Electron NÃO recebe atualizações de estoque do Railway

---

## 📊 RESUMO EXECUTIVO

### URLs de Busca de Estoque

| App | URL | Parâmetros |
|-----|-----|------------|
| **Electron** | `GET /inventory` | Nenhum (fullSync: true) |
| **App Proprietário (Mobile)** | `GET /inventory` | `branchId?` (opcional), `lowStock?`, `search?` |

**Ambos usam a MESMA URL base:** `https://barmanagerbackend-production.up.railway.app/api/v1/inventory`

---

## 🔴 CAUSA RAIZ IDENTIFICADA

### Problema Principal: **Flag `synced=0` Bloqueando Atualizações**

Quando o Electron faz vendas, ele:
1. Deduz o estoque local
2. Marca o item como `synced = 0`
3. Adiciona à fila de sync para enviar ao servidor

**O PROBLEMA:** Na hora de receber atualizações do servidor, o código verifica:

```typescript
// apps/desktop/electron/sync/manager.ts - Linha 1727-1730
if (inventoryItem.synced === 0) {
  console.log(`⚠️ Inventory item ${productId} tem alterações locais pendentes (synced=0), pulando...`);
  continue;  // 🔴 PULA A ATUALIZAÇÃO DO SERVIDOR!
}
```

### Cenário do Bug:

```
1. Electron faz venda → synced = 0
2. Electron tenta enviar para servidor → FALHA (rede, timeout, etc)
3. synced permanece = 0
4. Servidor recebe atualização de outro dispositivo (App Proprietário)
5. Electron puxa dados do servidor
6. Código vê synced = 0 → PULA atualização
7. Estoque fica desatualizado PARA SEMPRE até sync bem-sucedido
```

---

## 📁 Análise Detalhada dos Arquivos

### 1. apps/desktop/electron/sync/manager.ts

**Método `fullPullFromServer()` (linha 276-450):**
```typescript
// Entidades baixadas - inventory está na lista correta
{ name: 'inventory', endpoint: '/inventory' },
{ name: 'inventory_movements', endpoint: '/inventory/movements?limit=500' },
```
✅ Endpoint correto, sem filtros bloqueantes

**Método `pullServerChanges()` (linha 1145-1210):**
```typescript
// inventory tem fullSync: true - CORRETO!
{ name: 'inventory', endpoint: '/inventory', fullSync: true },
```
✅ fullSync evita filtro `updatedAfter`

**Merge de Inventory (linha 1692-1770):**
```typescript
inventory: (items) => {
  for (const item of items) {
    const inventoryItem = this.dbManager.getInventoryItemByProductId(productId, branchId);
    
    if (inventoryItem) {
      // 🔴 PROBLEMA AQUI!
      if (inventoryItem.synced === 0) {
        console.log(`⚠️ Inventory item ${productId} tem alterações locais pendentes (synced=0), pulando...`);
        continue;  // PULA ATUALIZAÇÃO!
      }
      // ... resto do código de atualização
    }
  }
}
```

### 2. apps/desktop/electron/database/manager.ts

**Vendas marcam estoque como não sincronizado:**

```typescript
// Linha 2360, 2387 - deductInventoryAdvanced()
this.db.prepare(`
  UPDATE inventory_items 
  SET open_box_units = open_box_units - ?,
      qty_units = qty_units - ?,
      updated_at = datetime('now'),
      synced = 0  // 🔴 Marca como não sincronizado
  WHERE id = ?
`).run(fromOpen, fromOpen, inventory.id);
```

**updateInventoryItemByProductId marca synced=1:**
```typescript
// Linha 2205-2213
this.db.prepare(`
  UPDATE inventory_items 
  SET qty_units = ?,
      closed_boxes = ?,
      open_box_units = ?,
      updated_at = datetime('now'),
      synced = 1,  // ✅ Marca como sincronizado
      last_sync = datetime('now')
  WHERE id = ?
`).run(data.qtyUnits, closedBoxes, openBoxUnits, existing.id);
```

### 3. apps/backend/src/inventory/inventory.controller.ts

```typescript
@Get()
async findAll(@Query('branchId') branchId?: string) {
  const items = await this.inventoryService.findAll(branchId);
  console.log(`[Inventory] GET /inventory - branchId: ${branchId || 'all'}, resultCount: ${items.length}`);
  return items;
}
```
✅ Endpoint correto, retorna todos os itens

### 4. apps/backend/src/inventory/inventory.service.ts

```typescript
async findAll(branchId?: string) {
  return this.prisma.inventoryItem.findMany({
    where: branchId ? { branchId } : undefined,  // Sem branchId = TODOS
    include: {
      product: true,
      branch: true,
    },
    orderBy: { product: { name: 'asc' } },
  });
}
```
✅ Sem filtro de branchId quando não especificado = retorna TODOS

### 5. apps/mobile/lib/services/api_service.dart

```dart
Future<List<models.Inventory>> getInventory({
  String? branchId,
  bool? lowStock,
  String? search,
}) async {
  final response = await _dio.get('/inventory', queryParameters: queryParams);
  // ...
}
```
✅ Mesma URL que Electron, sem cache local

---

## 📋 Checklist de Verificação

| Item | Status | Notas |
|------|--------|-------|
| URL idêntica entre apps | ✅ | Ambos usam `/inventory` |
| Filtro updatedAfter | ✅ | inventory tem fullSync: true |
| Filtro branchId | ✅ | Não é passado no Electron |
| Cache local | 🔴 | synced=0 bloqueia atualizações |
| Intervalo de sync | ✅ | 60 segundos |
| Token válido | ⚠️ | Verificar se não é offline-token |

---

## 🛠️ SOLUÇÕES PROPOSTAS

### Solução 1: Resolver Conflito com Timestamp (RECOMENDADA)

```typescript
// apps/desktop/electron/sync/manager.ts - método mergeEntityData inventory
inventory: (items) => {
  for (const item of items) {
    const inventoryItem = this.dbManager.getInventoryItemByProductId(productId, branchId);
    
    if (inventoryItem) {
      // MUDANÇA: Usar timestamp para resolver conflito
      const serverUpdatedAt = new Date(item.updatedAt || item.updated_at || 0);
      const localUpdatedAt = new Date(inventoryItem.updated_at || 0);
      
      if (inventoryItem.synced === 0) {
        // Verificar se servidor tem dados mais recentes
        if (serverUpdatedAt > localUpdatedAt) {
          console.log(`⚠️ Servidor tem dados mais recentes para ${productId}, sobrescrevendo local...`);
          // Atualiza mesmo com synced=0
        } else {
          console.log(`⏳ Mantendo dados locais para ${productId} (mais recentes que servidor)`);
          continue;
        }
      }
      // ... resto do código
    }
  }
}
```

### Solução 2: Forçar Sync de Inventory na Fila

```typescript
// Adicionar ao sync manager - método para forçar resync de itens pendentes
async forceInventoryResync() {
  // Resetar synced=0 para synced=1 em itens antigos (> 5 min)
  this.dbManager.prepare(`
    UPDATE inventory_items 
    SET synced = 1 
    WHERE synced = 0 
    AND updated_at < datetime('now', '-5 minutes')
  `).run();
  
  // Fazer pull completo
  await this.pullServerChanges();
}
```

### Solução 3: Retry Automático de Push Falhados

Já existe o código de retry, mas pode não estar funcionando bem. Verificar:

```typescript
// Aumentar prioridade de inventory no sync
'inventory': 2,  // Era 40, agora é 2 (alta prioridade)
```

---

## 🔬 DIAGNÓSTICO PARA EXECUTAR

1. **Verificar itens com synced=0:**
```sql
SELECT product_id, qty_units, synced, updated_at 
FROM inventory_items 
WHERE synced = 0;
```

2. **Verificar fila de sync:**
```sql
SELECT * FROM sync_queue 
WHERE entity = 'inventory' 
ORDER BY created_at DESC 
LIMIT 10;
```

3. **Logs do Electron:**
Procurar por: `⚠️ Inventory item ... tem alterações locais pendentes`

---

## 📊 Comparação de Comportamento

| Aspecto | App Proprietário | Electron |
|---------|-----------------|----------|
| Busca estoque | Direto do servidor | Servidor → Merge Local |
| Cache | Nenhum | SQLite local |
| Conflito | N/A | synced=0 bloqueia |
| Atualização | Tempo real | A cada 60 segundos |
| Offline | Não funciona | Funciona com cache |

---

## ✅ CONCLUSÃO

**CAUSA RAIZ:** O Electron bloqueia atualizações do servidor quando há alterações locais pendentes (`synced=0`), mesmo que o servidor tenha dados mais atualizados.

**IMPACTO:** Estoque fica permanentemente desatualizado se o push falhar.

**AÇÃO RECOMENDADA:** Implementar Solução 1 (resolver por timestamp) ou Solução 2 (forçar resync periódico).

---

## 📝 Arquivos para Modificar

1. `apps/desktop/electron/sync/manager.ts` - Linha ~1727
2. `apps/desktop/electron/database/manager.ts` - Adicionar método de diagnóstico
