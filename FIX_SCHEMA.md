# 🔧 Correções Necessárias no Schema Prisma

## ❌ Erros Encontrados no Build Railway

O build falhou porque o código TypeScript espera campos que não existem no schema Prisma.

### **Principais Problemas:**

1. **Tabela `AuditLog` - Falta campo `entity`**
2. **Tabela `Customer` - Falta campos: `name`, `totalPurchases`**
3. **Tabela `Campaign` - Falta campos: `status`, `discountPercentage`, `targetProducts`**
4. **Tabela `Debt` - Falta campos: `balance`, `paid`, `amount`, `amountPaid`**
5. **Tabela `Sale` - Falta campos: `totalAmount`, `discount`**
6. **Tabela `SaleItem` - Falta campos: `tax`, `quantity`**
7. **Tabela `Product` - Falta campo: `unitCost`, relação `purchases`**
8. **Tabela `InventoryItem` - Falta campo: `minStock`**
9. **Tabela `CashBox` - Falta campos: `openingAmount`, `closingAmount`, `openAmount`, `user`**
10. **Tabela `Purchase` - Falta campos: `userId`, `user`, `completedAt`**
11. **Tabela `PurchaseItem` - Falta campo: `totalCost`**
12. **Tabela `Payment` - Falta campo: `reference`**
13. **Tabela `LoyaltyTransaction` - Falta campo: `reason`, `sale`**
14. **Tabela `LoyaltyReward` - Tabela inexistente**
15. **Tabela `Notification` - Tabela inexistente**
16. **Tabela `Feedback` - Tabela inexistente**
17. **Tabela `SyncConflict` - Falta campos: `branchId`, `resolved`**
18. **Tabela `SyncQueue` - Falta campo: `syncedAt`**
19. **Tabela `ProductPriceHistory` - Falta campo: `changedAt`**

---

## ✅ Solução Rápida

**OPÇÃO 1: Usar Schema Simplificado (RECOMENDADO)**

O projeto tem um schema SQLite simplificado que funciona:
```
apps/backend/prisma/schema-sqlite-simple.txt
```

**Passos:**
1. Substituir `schema.prisma` pelo conteúdo simplificado
2. Adaptar para PostgreSQL
3. Gerar client Prisma
4. Fazer push no Railway

**OPÇÃO 2: Corrigir Schema Atual**

Adicionar todos os campos faltantes manualmente (complexo e demorado).

---

## 🚀 Ação Imediata Recomendada

Vou criar um schema PostgreSQL funcional baseado no código TypeScript existente.

**Arquivo:** `schema.prisma.fixed`

Este schema terá:
- ✅ Todos os campos esperados pelo código
- ✅ Compatível com PostgreSQL
- ✅ Pronto para Railway

**Depois:**
1. Substituir `schema.prisma` por `schema.prisma.fixed`
2. Fazer commit
3. Railway rebuild automaticamente
4. ✅ Deploy com sucesso

---

## 📝 Alternativa: Simplificar Código

Remover funcionalidades não essenciais do código para corresponder ao schema atual:
- Remover Feedback module
- Remover Notification module  
- Remover LoyaltyReward
- Simplificar Campaign, Debt, etc.

**Desvantagem:** Perde funcionalidades avançadas.

---

## 💡 Recomendação Final

**Use o schema SQLite simplificado adaptado para PostgreSQL.**

É o caminho mais rápido para fazer deploy funcionar no Railway.
