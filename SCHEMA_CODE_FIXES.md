# Correções Necessárias no Código TypeScript

O schema Prisma foi atualizado, mas o código TypeScript precisa ser ajustado para usar os campos corretos.

## ❌ Problemas Identificados

### 1. Customer: `name` vs `fullName`
**Erro**: Código usa `customer.name`, schema tem `fullName`

**Arquivos afetados**:
- `src/feedback/feedback.service.ts`
- `src/loyalty/loyalty.service.ts`
- `src/notifications/notifications.service.ts`
- `src/reports/reports.service.ts`

**Correção**: Substituir todas as ocorrências de:
```typescript
// DE:
customer: { select: { name: true } }

// PARA:
customer: { select: { fullName: true } }
```

### 2. Debt: Falta `userId` e `branchId`
**Erro**: Código tenta adicionar `userId`, mas schema não tem

**Arquivos afetados**:
- `src/debts/debts.service.ts`
- `src/sales/sales.service.ts`
- `src/sync/sync.service.ts`
- `src/notifications/notifications.service.ts`

**Ação**: 
1. **Opção A**: Adicionar campos ao schema:
```prisma
model Debt {
  // ... campos existentes
  userId    String?  // usuário que criou a dívida (além de createdBy)
  branchId  String?  // filial onde a dívida foi criada
  // ... resto
}
```

2. **Opção B**: Remover tentativas de adicionar esses campos no código

### 3. Purchase/Sale: Falta relação `user`
**Erro**: Código usa `include: { user: true }`, mas relação não existe

**Arquivos afetados**:
- `src/purchases/purchases.service.ts`
- `src/sales/sales.service.ts`

**Correção**: Usar `createdByUser` ao invés de `user`:
```typescript
// DE:
include: { user: true }

// PARA:
include: { createdByUser: true }
```

### 4. LoyaltyReward: `pointsRequired` vs `pointsCost`
**Erro**: Código usa `pointsRequired`, schema tem `pointsCost`

**Arquivo afetado**:
- `src/loyalty/loyalty.service.ts`

**Correção**: Substituir:
```typescript
// DE:
pointsRequired: createRewardDto.pointsRequired

// PARA:
pointsCost: createRewardDto.pointsCost
```

### 5. Feedback: Falta relação `sale`
**Erro**: Código usa `include: { sale: ... }`, mas relação não existe no modelo Feedback

**Arquivo afetado**:
- `src/feedback/feedback.service.ts`

**Ação**: Adicionar relação ao schema:
```prisma
model Feedback {
  // ... campos existentes
  saleId  String?
  sale    Sale?   @relation("SaleFeedbacks", fields: [saleId], references: [id])
  // ... resto
}

model Sale {
  // ... campos existentes
  feedbacks Feedback[] @relation("SaleFeedbacks")
  // ... resto
}
```

### 6. Notification: Falta `branchId`
**Erro**: Código adiciona `branchId` mas campo não existe

**Arquivo afetado**:
- `src/notifications/notifications.service.ts`

**Ação**: Adicionar ao schema:
```prisma
model Notification {
  // ... campos existentes
  branchId  String?
  branch    Branch? @relation("BranchNotifications", fields: [branchId], references: [id])
  // ... resto
}

model Branch {
  // ... campos existentes
  notifications Notification[] @relation("BranchNotifications")
  // ... resto
}
```

### 7. Product: Falta `unitCost` e `minStock`
**Erro**: Código acessa `product.unitCost` e `product.minStock`, mas campos não existem

**Arquivos afetados**:
- `src/forecast/forecast.service.ts`
- `src/inventory/inventory.service.ts`
- `src/purchases/purchases.service.ts`

**Nota**: 
- O Product já tem `costUnit` (use esse ao invés de `unitCost`)
- O InventoryItem já tem `minStock` (adicionado)
- Usar `product.costUnit` ao invés de `product.unitCost`

### 8. PurchaseItem: `costPerUnit` vs `unitCost`
**Erro**: Código usa `costPerUnit`, schema tem `unitCost`

**Arquivo afetado**:
- `src/purchases/purchases.service.ts`

**Correção**:
```typescript
// DE:
costPerUnit: itemDto.unitCost

// PARA:
unitCost: itemDto.unitCost
```

### 9. Payment: `reference` vs `referenceNumber`
**Erro**: Código usa `reference`, schema tem `referenceNumber`

**Arquivo afetado**:
- `src/sales/sales.service.ts`

**Correção**:
```typescript
// DE:
reference: paymentDto.referenceNumber

// PARA:
referenceNumber: paymentDto.referenceNumber
```

### 10. SyncQueue: `entityType` vs `entity`
**Erro**: Código usa `entityType`, schema tem `entity`

**Arquivo afetado**:
- `src/sync/sync.service.ts`

**Correção**:
```typescript
// DE:
entityType: createSyncItemDto.entity

// PARA:
entity: createSyncItemDto.entity
```

### 11. SyncQueue: `syncedAt` não existe
**Erro**: Código acessa `syncedAt`, schema tem `processedAt`

**Arquivo afetado**:
- `src/sync/sync.service.ts`

**Correção**:
```typescript
// DE:
orderBy: { syncedAt: 'desc' }
select: { syncedAt: true }
lastSync?.syncedAt

// PARA:
orderBy: { processedAt: 'desc' }
select: { processedAt: true }
lastSync?.processedAt
```

### 12. SyncConflict: `resolved` vs `resolvedBy`
**Erro**: Código usa campo booleano `resolved`, schema tem apenas `resolvedBy` (String?)

**Arquivo afetado**:
- `src/sync/sync.service.ts`

**Ação**: Adicionar campo ao schema:
```prisma
model SyncConflict {
  // ... campos existentes
  resolved      Boolean  @default(false)  // adicionar
  resolvedBy    String?
  resolvedAt    DateTime?
  // ... resto
}
```

### 13. LoyaltyTransaction: `reason` não existe
**Erro**: Código adiciona campo `reason`, mas não existe no schema

**Arquivo afetado**:
- `src/loyalty/loyalty.service.ts`

**Nota**: O schema já tem campo `notes`, usar esse ao invés de `reason`:
```typescript
// DE:
reason: addPointsDto.reason

// PARA:
notes: addPointsDto.reason
```

### 14. ProductPriceHistory: `changedAt` vs `createdAt`
**Erro**: Código usa `changedAt`, schema tem `createdAt`

**Arquivo afetado**:
- `src/products/products.service.ts`

**Correção**:
```typescript
// DE:
orderBy: { changedAt: 'desc' }

// PARA:
orderBy: { createdAt: 'desc' }
```

## 🔧 Ação Recomendada

### Opção 1: Corrigir o Código (Rápido)
Ajustar os serviços TypeScript para usar os campos corretos do schema atual.

**Prós**: Deploy rápido, schema consistente  
**Contras**: Precisa ajustar ~20 arquivos

### Opção 2: Completar o Schema (Completo)
Adicionar os campos faltantes ao schema que o código espera.

**Prós**: Código funciona sem alteração  
**Contras**: Schema pode ficar inconsistente, precisa migração

### Opção 3: Híbrida (Recomendada)
1. Adicionar campos críticos ao schema (branchId em Debt, etc)
2. Corrigir nomenclaturas no código (name→fullName, etc)

## 📋 Checklist de Correções Prioritárias

Para deploy imediato, corrigir pelo menos:

- [ ] Customer: Usar `fullName` ao invés de `name`
- [ ] Debt: Adicionar `branchId` ao schema
- [ ] Purchase/Sale: Usar `createdByUser` ao invés de `user`
- [ ] LoyaltyReward: Usar `pointsCost` ao invés de `pointsRequired`
- [ ] Notification: Adicionar `branchId` ao schema
- [ ] SyncQueue: Usar `entity` ao invés de `entityType`
- [ ] SyncQueue: Usar `processedAt` ao invés de `syncedAt`
- [ ] Product: Usar `costUnit` ao invés de `unitCost`

## 🎯 Próximos Passos

1. Decidir estratégia (Opção 1, 2 ou 3)
2. Aplicar correções
3. Testar build: `pnpm build`
4. Commit e push para Railway
5. Monitorar deploy

---

**Status**: Schema parcialmente corrigido, código precisa ajustes para build completo.
