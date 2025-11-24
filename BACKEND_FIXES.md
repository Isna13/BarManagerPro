# 🔧 Correções Necessárias - Backend Schema Prisma

## ⚠️ Problema Atual:
O código TypeScript do backend está usando campos e modelos que não existem no schema Prisma, causando 113 erros de compilação.

## ✅ Solução: Atualizar Schema Prisma

### 1. Abrir arquivo: `apps/backend/prisma/schema.prisma`

### 2. Aplicar as seguintes correções:

#### **InventoryItem** - Adicionar minStock
```prisma
model InventoryItem {
  id          String   @id @default(uuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id])
  qtyUnits    Int      @default(0)
  minStock    Int      @default(0)  // ← ADICIONAR ESTA LINHA
  batchNumber String?
  expiryDate  DateTime?
  location    String?
  // ... resto do modelo
}
```

#### **Purchase** - Adicionar totalCost e completedAt
```prisma
model Purchase {
  id           String    @id @default(uuid())
  branchId     String
  branch       Branch    @relation(fields: [branchId], references: [id])
  supplierId   String
  supplier     Supplier  @relation(fields: [supplierId], references: [id])
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  status       String    @default("draft") // draft, completed, cancelled
  totalCost    Int       @default(0)  // ← ADICIONAR ESTA LINHA
  notes        String?
  completedAt  DateTime?  // ← ADICIONAR ESTA LINHA
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  items        PurchaseItem[]
  // ... resto do modelo
}
```

#### **PurchaseItem** - Adicionar unitCost e totalCost
```prisma
model PurchaseItem {
  id          String   @id @default(uuid())
  purchaseId  String
  purchase    Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  qtyUnits    Int
  qtyBoxes    Int      @default(0)
  costPerUnit Int
  unitCost    Int      // ← ADICIONAR ESTA LINHA (alias de costPerUnit)
  subtotal    Int
  totalCost   Int      // ← ADICIONAR ESTA LINHA (alias de subtotal)
  createdAt   DateTime @default(now())
  // ... resto do modelo
}
```

#### **ProductPriceHistory** - Renomear createdAt para changedAt
```prisma
model ProductPriceHistory {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  priceUnit Int
  priceBox  Int
  reason    String?
  changedAt DateTime @default(now())  // ← RENOMEAR DE createdAt
  // ... resto do modelo
}
```

#### **SyncQueue** - Adicionar entity e branchId
```prisma
model SyncQueue {
  id          String    @id @default(uuid())
  entity      String    // ← ADICIONAR ESTA LINHA (sale, product, customer, etc)
  operation   String    // create, update, delete
  entityId    String
  branchId    String?   // ← ADICIONAR ESTA LINHA
  data        String    // JSON serialized
  status      String    @default("pending") // pending, synced, failed
  priority    Int       @default(5)
  retryCount  Int       @default(0)
  lastError   String?
  syncedAt    DateTime?
  createdAt   DateTime  @default(now())
  // ... resto do modelo
}
```

#### **SyncConflict** - Adicionar entity, branchId, resolved
```prisma
model SyncConflict {
  id          String   @id @default(uuid())
  entity      String   // ← ADICIONAR ESTA LINHA
  entityId    String
  entityType  String
  branchId    String?  // ← ADICIONAR ESTA LINHA
  localData   String   // JSON
  remoteData  String   // JSON
  resolution  String   // keep_local, keep_remote, merge
  resolved    Boolean  @default(false)  // ← ADICIONAR ESTA LINHA
  resolvedBy  String
  resolvedAt  DateTime
  createdAt   DateTime @default(now())
  // ... resto do modelo
}
```

#### **Notification** - Adicionar branchId e readAt
```prisma
model Notification {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  branchId    String?  // ← ADICIONAR ESTA LINHA
  type        NotificationType
  title       String
  message     String
  priority    NotificationPriority
  isRead      Boolean  @default(false)
  readAt      DateTime?  // ← ADICIONAR ESTA LINHA
  metadata    String?  // JSON
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // ... resto do modelo
}
```

#### **Debt** - Adicionar branchId (ou remover do código)
```prisma
model Debt {
  id          String    @id @default(uuid())
  customerId  String
  customer    Customer  @relation(fields: [customerId], references: [id])
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  // branchId já existe? Se não, adicionar:
  // branchId    String?
  amount      Int
  paid        Int       @default(0)
  balance     Int
  status      String    @default("active") // active, paid, written_off
  dueDate     DateTime
  description String?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  payments    Payment[]
  // ... resto do modelo
}
```

#### **LoyaltyTransaction** - Adicionar reason e saleId
```prisma
model LoyaltyTransaction {
  id          String   @id @default(uuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  points      Int
  type        String   // earn, redeem, expire
  reason      String?  // ← ADICIONAR ESTA LINHA
  saleId      String?  // ← ADICIONAR ESTA LINHA
  createdAt   DateTime @default(now())
  // ... resto do modelo
}
```

#### **NOVO MODELO: LoyaltyReward**
```prisma
model LoyaltyReward {
  id             String   @id @default(uuid())
  name           String
  description    String?
  pointsRequired Int
  value          Int      // Valor em centavos
  isActive       Boolean  @default(true)
  expiresAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@map("loyalty_rewards")
}
```

### 3. Após fazer as correções:

```bash
# 1. Gerar Prisma Client
cd C:\BarManagerPro\apps\backend
pnpm prisma:generate

# 2. Criar migration
pnpm prisma migrate dev --name fix-schema-fields

# 3. Verificar se build funciona
pnpm build

# 4. Se build OK, testar localmente
pnpm start

# 5. Testar API
curl http://localhost:3000/api/v1/health
```

### 4. Verificação Final:

Se o build passar sem erros TypeScript:
```bash
pnpm build
# Deve mostrar: "Compilation complete"
```

### 5. Deploy no Railway:

Só fazer push para o GitHub após confirmar que o build funciona:
```bash
git add .
git commit -m "fix: update prisma schema with missing fields"
git push origin main
```

Railway detectará e fará deploy automático.

---

## 📝 Notas:

- **Backup primeiro:** Faça backup do schema.prisma antes de editar
- **Teste local:** Sempre teste localmente antes de fazer push
- **Migrations:** Certifique-se de que as migrations foram aplicadas
- **Dados existentes:** Se já tem dados no banco, verifique se as migrations não causarão perda de dados

---

## 🆘 Se algo der errado:

1. **Reverter schema:**
   ```bash
   git checkout apps/backend/prisma/schema.prisma
   ```

2. **Limpar migrations:**
   ```bash
   rm -rf apps/backend/prisma/migrations
   pnpm prisma migrate dev --name initial
   ```

3. **Regenerar tudo:**
   ```bash
   pnpm prisma:generate
   pnpm build
   ```

---

**Tempo estimado para correções: 30-45 minutos**
