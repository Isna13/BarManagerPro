# Implementação de Sincronização Bidirecional de Mesas

## Resumo das Implementações

Este documento descreve a implementação completa da sincronização bidirecional para a aba "Mesas" entre o App Electron (BarManager Pro), Servidor Backend (Railway) e App Mobile (Vendas Manager Pro).

## 1. Arquitetura de Sincronização

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Electron App   │◄────►│  Railway Backend │◄────►│   Mobile App    │
│ (BarManager Pro)│      │  (Fonte Central) │      │ (Vendas Manager)│
└─────────────────┘      └──────────────────┘      └─────────────────┘
       │                         │                         │
       ▼                         ▼                         ▼
   SQLite Local            PostgreSQL              SQLite Local
   (offline-first)                                (offline-first)
```

## 2. Entidades Sincronizadas

| Entidade | Descrição | Prioridade |
|----------|-----------|------------|
| `tables` | Mesas do estabelecimento | 11 |
| `table_sessions` | Sessões abertas/fechadas | 12 |
| `table_customers` | Clientes associados à mesa | 13 |
| `table_orders` | Pedidos dos clientes | 14 |
| `table_payments` | Pagamentos processados | 15 |

## 3. Fluxo de Sincronização

### 3.1 Criação de Mesa

**Electron → Railway → Mobile:**
1. Mesa criada no Electron
2. Adicionada à `sync_queue` com prioridade 0
3. Sincronização envia para `/tables` (POST)
4. Mobile baixa no próximo ciclo de sync

**Mobile → Railway → Electron:**
1. Mesa criada no Mobile
2. Se online: API envia diretamente
3. Se offline: Adicionada à `sync_queue` com `source: 'mobile'`
4. Electron baixa no próximo `pullServerChanges()`

### 3.2 Abertura de Mesa (Sessão)

**Electron → Railway → Mobile:**
1. Sessão criada com `addToSyncQueue('table_session', ...)`
2. Sync envia para `/tables/sessions/open`
3. Mobile sincroniza via `_mergeTableSession()`

**Mobile → Railway → Electron:**
1. Sessão criada offline com `source: 'mobile'`
2. Sync envia para `/tables/sessions/open`
3. Electron recebe via `pullServerChanges()`

### 3.3 Adição de Clientes à Mesa

- Cliente adicionado: `addToSyncQueue('table_customer', ...)`
- Endpoint: `/tables/customers/add`
- Campos rastreados: `customer_name`, `customer_id`, `session_id`

### 3.4 Pedidos (table_orders)

- Pedido criado: `addToSyncQueue('table_order', ...)`
- Endpoint: `/tables/orders/add`
- Cancelamento: `/tables/orders/cancel`

### 3.5 Pagamentos

- Pagamento de cliente: `/tables/payments/customer`
- Pagamento de sessão: `/tables/payments/session`

## 4. Campos de Rastreamento

Cada entidade agora inclui:

| Campo | Descrição |
|-------|-----------|
| `synced` | 0 = pendente, 1 = sincronizado |
| `source` | 'electron' ou 'mobile' - origem da ação |
| `created_at` | Timestamp de criação |
| `updated_at` | Timestamp da última atualização |

## 5. Resolução de Conflitos

A resolução de conflitos usa a estratégia "last-write-wins" baseada em timestamp:

1. **Detecção**: Comparação de `updated_at` local vs servidor
2. **Registro**: Conflitos são registrados em `sync_conflicts`
3. **Resolução**: Servidor Railway é fonte central da verdade

```typescript
// Electron - Detecção de conflito
const localUpdated = new Date(localData.updated_at);
const serverUpdated = new Date(serverData.updated_at);

if (localUpdated > serverUpdated) {
  // Manter versão local (será enviada na próxima sync)
} else {
  // Aceitar versão do servidor
}
```

## 6. Endpoints do Backend

| Ação | Endpoint | Método |
|------|----------|--------|
| Criar mesa | `/tables` | POST |
| Atualizar mesa | `/tables/:id` | PUT |
| Listar mesas | `/tables` | GET |
| Abrir sessão | `/tables/sessions/open` | POST |
| Fechar sessão | `/tables/sessions/close` | POST |
| Obter sessão | `/tables/sessions/:id` | GET |
| Adicionar cliente | `/tables/customers/add` | POST |
| Adicionar pedido | `/tables/orders/add` | POST |
| Cancelar pedido | `/tables/orders/cancel` | POST |
| Pagamento cliente | `/tables/payments/customer` | POST |
| Pagamento sessão | `/tables/payments/session` | POST |
| Transferir mesa | `/tables/sessions/transfer` | POST |
| Unir mesas | `/tables/sessions/merge` | POST |
| Dividir mesa | `/tables/sessions/split` | POST |

## 7. Arquivos Modificados

### Mobile (Flutter/Dart)
- `lib/services/sync_service.dart` - Adicionado suporte para todas as entidades de mesa
- `lib/providers/sync_provider.dart` - Adicionado download de sessões ativas
- `lib/providers/tables_provider.dart` - Adicionado campos source e updated_at
- `lib/services/api_service.dart` - Adicionado método updateTable

### Electron (TypeScript)
- `electron/database/manager.ts` - Adicionado método updateTable
- `electron/main.ts` - Adicionado handler IPC tables:update

## 8. Validação

### Checklist de Funcionamento

- [x] Mesa criada no Electron aparece no Mobile
- [x] Mesa criada no Mobile aparece no Electron
- [x] Status da mesa sincronizado em tempo real
- [x] Pedidos adicionados em qualquer app aparecem nos outros
- [x] Clientes da mesa sincronizados
- [x] Pagamentos processados corretamente
- [x] Funciona offline-first em ambos os apps
- [x] Sem duplicação de mesas
- [x] Origem da ação rastreada (source)
- [x] Timestamps para resolução de conflitos

## 9. Como Testar

1. **Criar mesa no Electron:**
   ```
   Aba Mesas → Nova Mesa → Confirmar
   ```
   Verificar: Mesa aparece no Mobile após sync (≤60s)

2. **Criar mesa no Mobile:**
   ```
   Aba Mesas → + → Preencher dados → Salvar
   ```
   Verificar: Mesa aparece no Electron após sync

3. **Abrir mesa e adicionar pedidos:**
   - Abrir mesa em qualquer app
   - Adicionar cliente e pedidos
   - Verificar sincronização nos outros apps

4. **Testar offline:**
   - Desconectar da rede
   - Fazer operações
   - Reconectar
   - Verificar sincronização automática

## 10. Logs de Debug

Para verificar a sincronização, observe os logs:

**Electron:**
```
📤 Sincronizando table_session...
✅ Sessão de mesa sincronizada: [id]
```

**Mobile:**
```
📋 Sincronizando mesa: [id]
✅ Mesa sincronizada: [id]
```

---

*Implementação concluída em 17/12/2024*
