# Arquitetura - BarManager Pro

## 🏗️ Visão Geral

BarManager Pro utiliza arquitetura **offline-first** com sincronização bidirecional, garantindo operação contínua mesmo sem conexão à internet.

```
┌─────────────────────────────────────────────────────────┐
│                    DISPOSITIVOS CLIENTE                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Desktop   │  │   Mobile    │  │     PWA     │     │
│  │  Electron  │  │   Flutter   │  │   React     │     │
│  │            │  │             │  │             │     │
│  │  SQLite    │  │   SQLite    │  │  IndexedDB  │     │
│  └──────┬─────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                 │            │
│         └────────────────┴─────────────────┘            │
│                          │                               │
│                          │ HTTPS + JWT                   │
│                          │ WebSocket                     │
└──────────────────────────┼───────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    CAMADA DE API                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│        ┌──────────────────────────────────┐             │
│        │       NestJS Backend             │             │
│        │  - REST API                      │             │
│        │  - WebSocket Gateway             │             │
│        │  - Sync Manager                  │             │
│        │  - Business Logic Modules        │             │
│        └──────────────┬───────────────────┘             │
│                       │                                   │
└───────────────────────┼───────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 CAMADA DE DADOS                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐   ┌────────────┐   ┌──────────────┐  │
│  │  PostgreSQL  │   │   Redis    │   │   S3/Minio   │  │
│  │  (Principal) │   │  (Filas)   │   │  (Backups)   │  │
│  └──────────────┘   └────────────┘   └──────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Componentes Principais

### 1. Backend (NestJS)

**Responsabilidades:**
- API REST (CRUD de todas entidades)
- WebSocket (notificações em tempo real)
- Autenticação e autorização (JWT)
- Sincronização de dados
- Processamento de pagamentos Mobile Money
- Geração de relatórios
- Envio de notificações (FCM, WhatsApp)
- Forecasting e ML

**Estrutura Modular:**

```
src/
├── auth/              # Autenticação JWT + 2FA
├── users/             # Gestão usuários
├── branches/          # Multi-filial
├── products/          # Catálogo
├── inventory/         # Estoque
├── sales/             # Vendas + PDV
├── cash-box/          # Caixa
├── customers/         # Clientes
├── debts/             # Dívidas
├── suppliers/         # Fornecedores
├── purchases/         # Compras
├── forecast/          # Previsão demanda
├── loyalty/           # Fidelidade
├── campaigns/         # Marketing
├── sync/              # Sincronização
├── notifications/     # Push/Email/WhatsApp
├── reports/           # BI e relatórios
├── backup/            # Backups AES-256
└── audit/             # Logs de auditoria
```

### 2. Desktop (Electron)

**Responsabilidades:**
- Interface PDV (balcão + mesas)
- Gestão de vendas offline
- Controle de caixa
- Inventário local
- Impressão térmica
- Sincronização com servidor

**Tecnologias:**
- Electron 28+ (multi-plataforma)
- React 18 + TypeScript
- SQLite (banco local WAL mode)
- Zustand (state management)
- TanStack Query (cache + sync)

**Banco SQLite Local:**

```sql
-- Principais tabelas
- products (cache)
- inventory_items
- sales (operações offline)
- sale_items
- payments
- cash_boxes
- sync_queue (fila de sincronização)
```

### 3. Mobile (Flutter)

**Responsabilidades:**
- Dashboard dono/gerente
- App garçons (pedidos)
- Inventário mobile
- Notificações push
- Relatórios básicos

**Tecnologias:**
- Flutter 3.16+ (Android/iOS)
- Provider (state)
- sqflite (SQLite local)
- dio (HTTP client)
- firebase_messaging (FCM)

### 4. PWA (Progressive Web App)

**Responsabilidades:**
- Inventário leve
- Relatórios visualização
- QR Menu
- Operação offline limitada

**Tecnologias:**
- React/Vue
- Service Workers
- IndexedDB
- Chart.js / Recharts

---

## 🔄 Fluxo de Sincronização

### Arquitetura Offline-First

```
┌─────────────────────────────────────────────────────┐
│              DISPOSITIVO LOCAL                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│  1. Operação (ex: criar venda)                      │
│          ↓                                           │
│  2. Salvar no SQLite local                          │
│          ↓                                           │
│  3. Adicionar à sync_queue (prioridade 1-10)       │
│          ↓                                           │
│  4. Retornar sucesso imediato ao usuário            │
│                                                       │
└─────────────────────────────────────────────────────┘
                        ↓
                        │ (Network disponível)
                        ↓
┌─────────────────────────────────────────────────────┐
│            SINCRONIZAÇÃO (a cada 30s)                │
├─────────────────────────────────────────────────────┤
│                                                       │
│  5. Push: Enviar itens pendentes por prioridade     │
│     - Prioridade 1 (vendas) primeiro                │
│     - Prioridade 5 (cadastros) depois               │
│          ↓                                           │
│  6. Pull: Buscar mudanças do servidor               │
│     - Desde última sincronização (timestamp)        │
│          ↓                                           │
│  7. Resolução de conflitos                          │
│     - Last-write-wins (timestamp)                   │
│     - UI manual para casos críticos                 │
│          ↓                                           │
│  8. Atualizar SQLite local                          │
│          ↓                                           │
│  9. Marcar items sync_queue como "completed"        │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Prioridades de Sincronização

| Prioridade | Tipo                    | Timeout | Retries |
|------------|-------------------------|---------|---------|
| 1          | Vendas, Pagamentos      | 60s     | 10      |
| 2          | Compras, Movimentos     | 45s     | 5       |
| 3          | Cadastros               | 30s     | 3       |
| 5          | Relatórios, Logs        | 30s     | 2       |
| 10         | Anexos, Imagens         | 120s    | 1       |

### Resolução de Conflitos

**Automática (Last-Write-Wins):**
- Comparar timestamps de `updated_at`
- Versão mais recente prevalece
- Aplicável a: produtos, clientes, fornecedores

**Manual (UI para resolver):**
- Vendas modificadas em múltiplos dispositivos
- Inventário com contagens conflitantes
- Usuário escolhe qual versão manter

---

## 🔐 Segurança

### Autenticação

```
┌─────────┐
│  Login  │
└────┬────┘
     │
     ▼
┌────────────────────┐
│  POST /auth/login  │
│  {email, password} │
└────────┬───────────┘
         │
         ▼
┌─────────────────────────┐
│ Validar bcrypt (10x)    │
│ Gerar JWT (7d)          │
│ Salvar Session table    │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Retornar token + user    │
│ {accessToken, user}      │
└──────────────────────────┘
```

**JWT Payload:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "roleId": "role_uuid",
  "branchId": "branch_uuid",
  "iat": 1234567890,
  "exp": 1235172690
}
```

### Permissões (RBAC)

```
Role
 └─ Permission[]
     └─ resource:action
        ex: sales:create, inventory:update, reports:read
```

**Exemplo Roles:**
- `admin`: Todas permissões
- `manager`: Tudo exceto configurações críticas
- `cashier`: PDV, vendas, caixa
- `waiter`: Pedidos, mesas
- `owner`: Apenas visualização e relatórios

### Auditoria

Todas operações críticas geram logs:

```typescript
AuditLog {
  userId: string
  action: string // 'create_sale', 'close_cash', 'delete_product'
  resource: string // 'sale', 'cash_box', 'product'
  resourceId: string
  details: JSON // dados da operação
  ipAddress: string
  userAgent: string
  createdAt: DateTime
}
```

---

## 📊 Banco de Dados

### Modelo Relacional (Simplificado)

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│  User   │────▶│   Role   │────▶│Permission│
└─────────┘     └──────────┘     └──────────┘
     │
     │          ┌──────────┐
     └─────────▶│  Branch  │
                └────┬─────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌─────────┐    ┌──────────┐   ┌──────────┐
│ Product │    │  Sale    │   │ CashBox  │
└────┬────┘    └────┬─────┘   └──────────┘
     │              │
┌────────────┐ ┌─────────┐
│ Inventory  │ │SaleItem │
│   Item     │ │         │
└────────────┘ └────┬────┘
                    │
               ┌─────────┐
               │ Payment │
               └─────────┘
```

### Índices Importantes

```sql
-- Performance crítica
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_sales_branch_status ON sales(branch_id, status);
CREATE INDEX idx_inventory_product_branch ON inventory_items(product_id, branch_id);
CREATE INDEX idx_sync_queue_priority ON sync_queue(status, priority, created_at);
CREATE INDEX idx_audit_user_date ON audit_logs(user_id, created_at);
```

---

## 🚀 Escalabilidade

### Horizontal (Múltiplas Instâncias)

```
                  ┌───────────────┐
                  │ Load Balancer │
                  │  (Nginx/HAProxy)
                  └───────┬───────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────────┐      ┌────────┐      ┌────────┐
    │ API 1  │      │ API 2  │      │ API 3  │
    │ NestJS │      │ NestJS │      │ NestJS │
    └────────┘      └────────┘      └────────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │  (Primary)   │
                   └──────┬───────┘
                          │
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │  (Replica)   │
                   └──────────────┘
```

### Particionamento por Filial

Para clientes com muitas filiais (>50):

```sql
-- Tabela particionada por branch_id
CREATE TABLE sales (
    id UUID,
    branch_id UUID,
    ...
) PARTITION BY HASH (branch_id);

CREATE TABLE sales_p0 PARTITION OF sales FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sales_p1 PARTITION OF sales FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sales_p2 PARTITION OF sales FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sales_p3 PARTITION OF sales FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### Cache Redis

```typescript
// Cache de produtos mais vendidos
const topProducts = await redis.get('top_products:daily');
if (!topProducts) {
  const data = await db.getTopProducts();
  await redis.setex('top_products:daily', 3600, JSON.stringify(data));
}
```

---

## 🔌 Integrações Externas

### Mobile Money (Orange Money, TeleTaku)

```typescript
interface MobileMoneyProvider {
  initiate(amount: number, phone: string): Promise<TransactionRef>
  check(ref: string): Promise<TransactionStatus>
  refund(ref: string): Promise<void>
}
```

### WhatsApp Business API

```typescript
await whatsapp.sendMessage({
  to: '+245966123456',
  body: 'Sua dívida vence amanhã. Total: 50.000 FCFA'
});
```

### FCM (Firebase Cloud Messaging)

```typescript
await fcm.sendToDevice(deviceTokens, {
  notification: {
    title: 'Estoque Baixo',
    body: 'Cerveja Sagres: 5 unidades restantes'
  }
});
```

---

## 📈 Monitoramento

### Métricas Chave (KPIs)

- **Uptime**: >99.5%
- **Latência API**: <200ms (p95)
- **Sync Success Rate**: >98%
- **Database Connection Pool**: <80% utilização
- **Redis Hit Rate**: >90%

### Tools

- **Logs**: Winston + Elasticsearch
- **APM**: New Relic / DataDog
- **Errors**: Sentry
- **Alertas**: PagerDuty / OpsGenie

---

## 🧪 Testes

### Cobertura Mínima

- Backend: 80% (unit + integration)
- Desktop: 60% (components + integration)
- Mobile: 60% (widgets + integration)

### E2E Critical Paths

1. Login → Criar Venda → Adicionar Itens → Pagar → Fechar
2. Abrir Caixa → Vendas → Fechar Caixa com Diferença
3. Offline → Criar Venda → Online → Sincronizar
4. Multi-dispositivo: Venda simultânea mesmo produto

---

**Documentação mantida por**: Equipe BarManager Pro  
**Última atualização**: Novembro 2024
