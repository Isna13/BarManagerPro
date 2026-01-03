# 🔍 AUDITORIA COMPLETA DE ARQUITETURA DE SINCRONIZAÇÃO
## BarManager Pro - Sistema Multi-PC Offline-First

**Data:** Janeiro 2026  
**Autor:** Arquiteto de Software Sênior  
**Classificação:** CRÍTICO - PRODUÇÃO

---

# ✅ CORREÇÕES IMPLEMENTADAS

## Status: 5/5 Pontos Críticos Corrigidos ✅

| # | Problema | Status | Arquivos Modificados |
|---|----------|--------|---------------------|
| F1 | Usuários não sincronizam para novos PCs | ✅ CORRIGIDO | `sync/manager.ts`, `database/manager.ts` |
| F2 | CashBox isolado por PC | ✅ CORRIGIDO | `sync/manager.ts`, `database/manager.ts`, `main.ts` |
| F3 | Sem pull reativo | ✅ CORRIGIDO | `sync/manager.ts` (polling agressivo 10s) |
| F4 | Conflitos de inventário | ✅ CORRIGIDO | `sync/manager.ts`, `database/manager.ts` (delta operations) |
| F5 | Configurações não globais | ✅ CORRIGIDO | `sync/manager.ts`, `database/manager.ts` |

---

### Detalhes das Correções:

#### F1: Usuários Sincronizam do Servidor (CORRIGIDO)

**Problema Original:** Usuários criados no servidor não eram replicados para outros PCs.

**Correções Aplicadas:**
1. Novo método `createUserFromServer()` em `database/manager.ts`
   - Cria usuário localmente com senha placeholder `$NEEDS_ONLINE_LOGIN$`
   - Define flag `needs_online_auth = 1`
   
2. Modificado merge de usuários em `mergeEntityData()` 
   - Agora CRIA usuários do servidor que não existem localmente
   
3. Novo método `updateUserPasswordLocal()` em `database/manager.ts`
   - Atualiza senha local após primeiro login online bem-sucedido
   
4. Login offline verifica `needs_online_auth`
   - Usuários sincronizados precisam fazer login online primeiro
   - Após login online, senha local é salva para uso offline

5. Migration 21 adicionada para coluna `needs_online_auth`

---

#### F2: CashBox com Verificação de Servidor (CORRIGIDO)

**Problema Original:** Cada PC tinha seu próprio caixa, sem verificação de estado global.

**Correções Aplicadas:**
1. Novo método `checkServerCashBox()` em `sync/manager.ts`
   - Verifica se já existe caixa aberto no servidor antes de permitir abertura
   
2. Novo método `openCashBoxWithServerCheck()` em `sync/manager.ts`
   - Verifica servidor → Cria no servidor → Cria localmente com mesmo ID
   - Garante apenas 1 caixa aberto por branch em todo sistema
   
3. Novo método `getCurrentCashBoxWithServerCheck()` em `sync/manager.ts`
   - Busca caixa do servidor primeiro, sincroniza para local
   
4. Novos métodos `createCashBoxFromServer()` e `updateCashBoxFromServer()` em `database/manager.ts`
   - Permitem criar/atualizar caixa local sem adicionar à fila de sync
   
5. IPC handlers modificados em `main.ts`
   - `cashbox:open` agora usa `openCashBoxWithServerCheck()`
   - `cashbox:getCurrent` agora usa `getCurrentCashBoxWithServerCheck()`

---

#### F3: Polling Agressivo para Entidades Críticas (CORRIGIDO)

**Problema Original:** Sync apenas a cada 60s não é suficiente para multi-PC.

**Correções Aplicadas:**
1. Novo timer `criticalSyncInterval` de 10 segundos
2. Novo método `syncCriticalEntities()` que sincroniza:
   - CashBox: `pullCriticalCashBoxStatus()`
   - Users: `pullCriticalUsers()`
   - Settings: `pullGlobalSettings()` (a cada 30s)
3. Eventos emitidos para UI reagir a mudanças:
   - `sync:cashBoxUpdated`
   - `sync:usersUpdated`
   - `sync:settingsUpdated`

---

#### F4: Delta Operations para Inventário (CORRIGIDO)

**Problema Original:** Sync de estoque usava valores absolutos, causando perda de dados em vendas simultâneas.

**Correções Aplicadas:**
1. Método `registerStockMovement()` agora adiciona à fila de sync
   - Envia movimento como delta (`adjustment: +X ou -X`)
   - Prioridade 1 (alta) para consistência
   
2. Novo handler `stock_movement` no sync push
   - Usa endpoint `PUT /inventory/adjust-by-product`
   - Aplica delta no servidor ao invés de valor absoluto
   
3. Novo método `markStockMovementSynced()` em `database/manager.ts`

**Resultado:** Vendas simultâneas em múltiplos PCs agora funcionam corretamente!
- PC1: estoque 100 → vende 5 → sync delta -5
- PC2: estoque 100 → vende 3 → sync delta -3
- Servidor: 100 - 5 - 3 = 92 ✅

---

#### F5: Configurações Globais (CORRIGIDO)

**Problema Original:** Configurações não sincronizavam entre PCs.

**Correções Aplicadas:**
1. Migration 22 adiciona coluna `synced` na tabela `settings`
2. Método `setSetting()` agora adiciona à fila de sync
3. Novos métodos:
   - `setSettingFromServer()` - recebe do servidor
   - `getUnsyncedSettings()` - lista pendentes
   - `markSettingSynced()` - marca como sincronizada
   - `getAllSettings()` - lista todas
4. Novo handler `setting` no sync push
5. Método `pullGlobalSettings()` no sync crítico

---

# 📋 ÍNDICE

1. [Diagnóstico Técnico Completo](#1-diagnóstico-técnico-completo)
2. [Arquitetura Atual vs Arquitetura Ideal](#2-arquitetura-atual-vs-arquitetura-ideal)
3. [Auditoria por Entidade](#3-auditoria-por-entidade)
4. [Pontos Críticos de Falha](#4-pontos-críticos-de-falha)
5. [Arquitetura Definitiva Proposta](#5-arquitetura-definitiva-proposta)
6. [Estratégia de Sincronização por Entidade](#6-estratégia-de-sincronização-por-entidade)
7. [Regras de Ouro do Sistema](#7-regras-de-ouro-do-sistema)
8. [Plano de Migração](#8-plano-de-migração)
9. [Implementação Técnica](#9-implementação-técnica)

---

# 1. DIAGNÓSTICO TÉCNICO COMPLETO

## 1.1 Estado Atual da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA ATUAL                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │  PC 1       │     │  PC 2       │     │  PC 3       │              │
│   │  (SQLite)   │     │  (SQLite)   │     │  (SQLite)   │              │
│   │             │     │             │     │             │              │
│   │ ▪ CashBox A │     │ ▪ CashBox B │     │ ▪ CashBox C │  ❌ PROBLEMA │
│   │ ▪ Users X   │     │ ▪ Users Y   │     │ ▪ Users Z   │  DIVERGÊNCIA │
│   │ ▪ Config 1  │     │ ▪ Config 2  │     │ ▪ Config 3  │              │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘              │
│          │                   │                   │                      │
│          │    Push/Pull      │                   │                      │
│          │   (Independente)  │                   │                      │
│          ▼                   ▼                   ▼                      │
│   ┌─────────────────────────────────────────────────────────┐          │
│   │                  RAILWAY (PostgreSQL)                    │          │
│   │                                                         │          │
│   │  ▪ Estado "oficial" mas não refletido em todos PCs      │          │
│   │  ▪ Sem broadcast de mudanças para outros dispositivos   │          │
│   │  ▪ Cada PC sincroniza isoladamente                      │          │
│   └─────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Problemas Identificados

### 🔴 CRÍTICO: Sincronização de Usuários

**Arquivo:** `apps/desktop/electron/sync/manager.ts` (linha 1584-1640)

```typescript
// PROBLEMA: Usuários do servidor NÃO são criados localmente
users: (items) => {
  // ...
  if (existing) {
    // Atualiza usuário existente ✅
  } else {
    // ❌ FALHA: NÃO CRIA O USUÁRIO
    console.log(`ℹ️ Usuário ${item.email} existe no servidor mas não localmente (sem senha para criar)`);
  }
}
```

**Impacto:**
- Um novo PC não recebe usuários do servidor
- Operadores precisam criar usuários manualmente em cada máquina
- Login offline impossível para usuários criados em outras máquinas

### 🔴 CRÍTICO: Caixa (CashBox) Não Compartilhado

**Arquivo:** `apps/desktop/electron/database/manager.ts` (linha 4247-4253)

```typescript
getCurrentCashBox() {
  return this.db.prepare(`
    SELECT * FROM cash_boxes 
    WHERE status = 'open' 
    ORDER BY opened_at DESC 
    LIMIT 1
  `).get();
}
```

**Problema:** Cada PC vê apenas o caixa que ELE PRÓPRIO abriu. Não há lógica para:
1. Verificar se já existe caixa aberto no servidor ANTES de permitir abertura
2. Sincronizar estado do caixa em tempo real entre PCs
3. Bloquear abertura de múltiplos caixas simultaneamente

**Impacto:**
- PC1 abre caixa A, PC2 abre caixa B → Dois caixas abertos simultaneamente
- Fechamento em um PC não reflete no outro
- Totais de vendas divergem entre máquinas

### 🔴 CRÍTICO: Sync Unidirecional Efetivo

Embora o código tenha estrutura para sync bidirecional, na prática:

**Push (Local → Servidor):** ✅ Funciona
- `addToSyncQueue()` adiciona itens
- `pushLocalChanges()` envia para Railway
- Itens marcados com `synced = 1` após sucesso

**Pull (Servidor → Local):** ⚠️ Parcial
- `pullServerChanges()` baixa dados
- `mergeEntityData()` mescla com local
- **PROBLEMA:** Não há trigger para pull automático quando OUTRO PC faz mudança

### 🟡 MODERADO: Resolução de Conflitos Baseada Apenas em Timestamp

```typescript
private hasLocalPendingChanges(entityName, itemId, existing, serverItem): boolean {
  // Usa apenas timestamp para resolver
  if (serverUpdatedAt > localUpdatedAt) {
    return false; // Aceita servidor
  }
  return true; // Mantém local
}
```

**Problema:** Sem versionamento ou vector clocks - conflitos silenciosos possíveis.

### 🟡 MODERADO: Configurações Não Sincronizadas

Configurações como métodos de pagamento, taxas, permissões são específicas por máquina.

---

# 2. ARQUITETURA ATUAL VS ARQUITETURA IDEAL

## 2.1 Modelo Atual (Problemático)

| Aspecto | Estado Atual | Problema |
|---------|--------------|----------|
| **Fonte da Verdade** | Railway (parcial) | Não propagada para todos PCs |
| **Estado do Caixa** | Local por PC | Divergência entre máquinas |
| **Usuários** | Criação local | Não replicados para novos PCs |
| **Sync Trigger** | Timer 60s | Muito lento para operações críticas |
| **Conflitos** | Timestamp | Sem auditoria de perdas |
| **Broadcast** | Inexistente | PCs não sabem de mudanças em outros |

## 2.2 Modelo Ideal (Proposto)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ARQUITETURA DEFINITIVA                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │  PC 1       │     │  PC 2       │     │  PC 3       │              │
│   │  (SQLite)   │     │  (SQLite)   │     │  (SQLite)   │              │
│   │             │     │             │     │             │              │
│   │ ▪ CashBox ──┼─────┼─────────────┼─────┼── ÚNICO ◄──│   ✅         │
│   │ ▪ Users  ───┼─────┼─────────────┼─────┼── IGUAIS ◄─│   CONSISTENTE│
│   │ ▪ Config ───┼─────┼─────────────┼─────┼── GLOBAL ◄─│              │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘              │
│          │                   │                   │                      │
│          └───────────────────┼───────────────────┘                      │
│                              ▼                                          │
│   ┌─────────────────────────────────────────────────────────┐          │
│   │                  RAILWAY (PostgreSQL)                    │          │
│   │                                                         │          │
│   │  ▪ SINGLE SOURCE OF TRUTH                               │          │
│   │  ▪ Notificações de mudanças (polling agressivo)         │          │
│   │  ▪ Locks distribuídos para operações críticas           │          │
│   │  ▪ Versionamento de entidades                           │          │
│   └─────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 3. AUDITORIA POR ENTIDADE

## 3.1 👤 USUÁRIOS

| Aspecto | Estado Atual | Problema | Solução |
|---------|--------------|----------|---------|
| **Criação** | Local apenas | Não replica | Criar sem senha localmente |
| **Sync S→L** | Atualiza apenas | Não cria novos | Criar com hash placeholder |
| **Sync L→S** | Funciona | - | Manter |
| **Login Offline** | Funciona se existir | Usuário novo não loga | Sync forçado no login |

**Correção Necessária em `sync/manager.ts`:**

```typescript
users: (items) => {
  if (!existing) {
    // ✅ CORREÇÃO: CRIAR usuário do servidor localmente
    // Usar hash placeholder que será substituído no primeiro login online
    this.dbManager.createUserFromServer({
      id: item.id,
      username: item.username,
      email: item.email,
      fullName: item.fullName,
      // Hash placeholder - usuário DEVE fazer login online primeiro
      passwordHash: '$NEEDS_ONLINE_LOGIN$',
      role: item.role,
      branchId: item.branchId,
      allowedTabs: item.allowedTabs,
      synced: 1,
      needsOnlineLogin: true, // Flag para UI
    });
  }
}
```

## 3.2 💰 CAIXA (CashBox) - CRÍTICO

| Aspecto | Estado Atual | Problema | Solução |
|---------|--------------|----------|---------|
| **Abertura** | Local isolada | Múltiplos caixas | Lock no servidor |
| **Estado** | Por PC | Divergente | Estado global único |
| **Fechamento** | Local | Não propaga | Sync imediato obrigatório |
| **Histórico** | Fragmentado | Incompleto | Centralizado no servidor |

**Arquitetura de Caixa Proposta:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE ABERTURA DE CAIXA                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PC Qualquer                                                           │
│       │                                                                 │
│       ▼                                                                 │
│   ┌─────────────┐                                                       │
│   │ Tentar Abrir│                                                       │
│   │   Caixa     │                                                       │
│   └──────┬──────┘                                                       │
│          │                                                              │
│          ▼                                                              │
│   ┌─────────────────────────────────────────────────────────┐          │
│   │ 1. VERIFICAR NO SERVIDOR: Existe caixa aberto?          │          │
│   │    GET /cash-box/current                                │          │
│   └──────────────────────────┬──────────────────────────────┘          │
│                              │                                          │
│              ┌───────────────┴───────────────┐                          │
│              ▼                               ▼                          │
│   ┌──────────────────┐            ┌──────────────────┐                 │
│   │ SIM: Caixa Aberto│            │ NÃO: Pode Abrir  │                 │
│   │                  │            │                  │                 │
│   │ ✅ Sincronizar   │            │ 2. POST /open    │                 │
│   │    caixa do      │            │    (Com Lock)    │                 │
│   │    servidor      │            │                  │                 │
│   │    localmente    │            │ 3. Sync Local    │                 │
│   │                  │            │                  │                 │
│   │ ❌ Bloquear nova │            │ ✅ Caixa aberto  │                 │
│   │    abertura      │            │    globalmente   │                 │
│   └──────────────────┘            └──────────────────┘                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.3 🛒 VENDAS

| Aspecto | Estado Atual | Problema | Solução |
|---------|--------------|----------|---------|
| **Criação Offline** | Funciona | - | Manter |
| **Sync** | Push OK | - | Manter |
| **Dedup** | Por ID | - | Adicionar idempotency key |
| **Totais Caixa** | Local | Diverge | Calcular no servidor |

**Status:** ✅ Funcionando bem, apenas ajustes menores.

## 3.4 🍽️ MESAS

| Aspecto | Estado Atual | Problema | Solução |
|---------|--------------|----------|---------|
| **Sessões** | Sync OK | - | Manter |
| **Pedidos** | Sync OK | - | Manter |
| **Pagamentos** | Sync OK | - | Manter |
| **Estado Tempo Real** | Polling 60s | Lento | Polling 10s para mesas |

**Status:** ⚠️ Funciona mas com delay excessivo.

## 3.5 📦 ESTOQUE

| Aspecto | Estado Atual | Problema | Solução |
|---------|--------------|----------|---------|
| **Qty Sync** | Timestamp | Conflitos | Vector de versão |
| **Movimentos** | Sync OK | - | Manter |
| **Concorrência** | Última escrita | Pode perder | Operações atômicas |

**Status:** ⚠️ Risco de perda em alta concorrência.

## 3.6 ⚙️ CONFIGURAÇÕES

| Aspecto | Estado Atual | Problema | Solução |
|---------|--------------|----------|---------|
| **Globais** | Não sincroniza | Diverge | Adicionar sync |
| **Locais** | OK | - | Manter separado |
| **Admin** | Local | Não replica | Flag isGlobal |

**Status:** ❌ Precisa implementação.

---

# 4. PONTOS CRÍTICOS DE FALHA

## 4.1 Falhas de Sincronização Identificadas

### 🔴 F1: Usuários Não Replicam para Novos PCs

**Localização:** `sync/manager.ts` linha 1628-1640

**Causa Raiz:** Código explicitamente NÃO cria usuários do servidor:
```typescript
console.log(`ℹ️ Usuário ${item.email} existe no servidor mas não localmente (sem senha para criar)`);
```

**Impacto em Produção:**
- Novo PC não tem operadores
- Login impossível
- Operação paralizada

**Correção:** Criar método `createUserFromServer()` que aceita usuários sem senha.

### 🔴 F2: Caixa com Estado Isolado por Máquina

**Localização:** `database/manager.ts` linha 4201-4253

**Causa Raiz:** `openCashBox()` e `getCurrentCashBox()` operam apenas localmente.

**Impacto em Produção:**
- PC1 abre caixa, PC2 não vê
- Fechamento em PC1 não afeta PC2
- Totais financeiros incorretos

**Correção:** Verificar servidor ANTES de abrir, sincronizar estado.

### 🔴 F3: Ausência de Pull Reativo

**Localização:** `sync/manager.ts` - fluxo geral

**Causa Raiz:** Pull só acontece:
1. No timer de 60 segundos
2. No login inicial

Não há trigger quando:
- Outro PC faz venda
- Outro PC abre/fecha caixa
- Admin muda configuração

**Correção:** Polling agressivo para entidades críticas + webhook se possível.

### 🟡 F4: Conflitos Silenciosos de Estoque

**Localização:** `sync/manager.ts` linha 1900-1970

**Causa Raiz:** Apenas timestamp resolve conflitos:
```typescript
if (serverUpdatedAt > localUpdatedAt) {
  // Aceita servidor
}
```

**Impacto:** 
- PC1 vende 5 cervejas (stock: 100→95)
- PC2 vende 3 cervejas (stock: 100→97) 
- Sync: servidor aceita 97 (mais recente)
- 5 cervejas "sumiram" do controle

**Correção:** Operações de estoque devem ser delta (+/-), não valor absoluto.

### 🟡 F5: Configurações Não Globais

**Localização:** `sync/manager.ts` linha 2530-2575

**Causa Raiz:** Configurações específicas são puladas:
```typescript
const deviceSpecificKeys = ['device_id', 'last_sync_date', 'offline_mode'];
```

Mas configurações como:
- Métodos de pagamento ativos
- Taxa de serviço
- Horário de funcionamento

NÃO são sincronizadas.

---

# 5. ARQUITETURA DEFINITIVA PROPOSTA

## 5.1 Modelo de Dados Híbrido

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLASSIFICAÇÃO DE DADOS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              DADOS GLOBAIS (Server First)                    │       │
│  │                                                              │       │
│  │  ▪ Usuários          - Criados/editados no servidor         │       │
│  │  ▪ Produtos          - Catálogo único                       │       │
│  │  ▪ Categorias        - Estrutura única                      │       │
│  │  ▪ Fornecedores      - Cadastro único                       │       │
│  │  ▪ Clientes          - Base de clientes única               │       │
│  │  ▪ Configurações*    - Parâmetros operacionais              │       │
│  │                                                              │       │
│  │  REGRA: Servidor é SOURCE OF TRUTH                          │       │
│  │         PCs DEVEM sincronizar do servidor                   │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              DADOS TRANSACIONAIS (Local First)               │       │
│  │                                                              │       │
│  │  ▪ Vendas            - Criadas offline, sync quando online  │       │
│  │  ▪ Pagamentos        - Idem                                 │       │
│  │  ▪ Pedidos de Mesa   - Idem                                 │       │
│  │  ▪ Movimentos Estoque- Idem (mas como DELTA, não absoluto)  │       │
│  │                                                              │       │
│  │  REGRA: Criados localmente, enviados ao servidor            │       │
│  │         Servidor consolida e distribui                      │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              ESTADO OPERACIONAL (Singleton Global)           │       │
│  │                                                              │       │
│  │  ▪ CashBox Ativo     - ÚNICO para toda operação             │       │
│  │  ▪ Sessões de Mesa   - Compartilhadas entre PCs             │       │
│  │                                                              │       │
│  │  REGRA: Lock exclusivo no servidor                          │       │
│  │         Todos PCs veem o mesmo estado                       │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              DADOS LOCAIS (Device Specific)                  │       │
│  │                                                              │       │
│  │  ▪ device_id         - Identificador único do dispositivo   │       │
│  │  ▪ last_sync_date    - Controle de sync                     │       │
│  │  ▪ offline_mode      - Flag de modo                         │       │
│  │  ▪ cached_token      - Token de autenticação                │       │
│  │                                                              │       │
│  │  REGRA: NUNCA sincroniza, específico do dispositivo         │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 5.2 Fluxo de Sincronização Definitivo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   FLUXO DE SINCRONIZAÇÃO                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    INICIALIZAÇÃO (App Start)                    │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                │                                        │
│                                ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  1. FULL PULL OBRIGATÓRIO                                       │    │
│  │     - Usuários (TODOS)                                          │    │
│  │     - Produtos (TODOS)                                          │    │
│  │     - Categorias (TODOS)                                        │    │
│  │     - CashBox atual (se existir)                                │    │
│  │     - Configurações globais                                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                │                                        │
│                                ▼                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    OPERAÇÃO NORMAL                              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                │                                        │
│          ┌─────────────────────┴─────────────────────┐                  │
│          ▼                                           ▼                  │
│  ┌───────────────────┐                   ┌───────────────────┐         │
│  │ PUSH IMEDIATO     │                   │ PULL PERIÓDICO    │         │
│  │                   │                   │                   │         │
│  │ Trigger:          │                   │ Intervalo:        │         │
│  │ - Venda finalizada│                   │ - CashBox: 5s     │         │
│  │ - Caixa aberto    │                   │ - Mesas: 10s      │         │
│  │ - Caixa fechado   │                   │ - Estoque: 30s    │         │
│  │ - Pagamento dívida│                   │ - Outros: 60s     │         │
│  │                   │                   │                   │         │
│  │ Ação:             │                   │ Ação:             │         │
│  │ - Sync imediato   │                   │ - Buscar mudanças │         │
│  │ - Confirmar ACK   │                   │ - Merge local     │         │
│  └───────────────────┘                   └───────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# 6. ESTRATÉGIA DE SINCRONIZAÇÃO POR ENTIDADE

## 6.1 Usuários

```typescript
// ESTRATÉGIA: Server-First com Cache Local

interface UserSyncStrategy {
  source: 'SERVER';
  localCreation: 'ALLOWED_WITH_SYNC';
  conflict: 'SERVER_WINS';
  pullInterval: '60s';
  
  rules: {
    // 1. Usuário do servidor SEMPRE criado localmente
    serverToLocal: 'CREATE_OR_UPDATE';
    
    // 2. Usuário local vai para servidor
    localToServer: 'PUSH_WITH_PASSWORD';
    
    // 3. Login offline permitido SE sincronizado antes
    offlineLogin: 'ALLOWED_IF_SYNCED';
    
    // 4. Usuário do servidor sem senha local
    passwordHandling: 'REQUIRE_FIRST_ONLINE_LOGIN';
  }
}
```

**Implementação:**
```typescript
// Em sync/manager.ts - mergeEntityData - users
users: (items) => {
  for (const item of items) {
    const existing = this.dbManager.getUserByEmail(item.email);
    
    if (existing) {
      // Atualizar
      this.dbManager.updateUserFromServer(existing.id, {...});
    } else {
      // ✅ CRIAR - Esta é a correção principal
      this.dbManager.createUserFromServer({
        id: item.id,
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        // Placeholder - exige login online primeiro
        passwordHash: '$PLACEHOLDER$',
        needsOnlineAuth: true,
        synced: 1,
      });
    }
  }
}
```

## 6.2 CashBox (Caixa)

```typescript
// ESTRATÉGIA: Singleton Global com Lock Distribuído

interface CashBoxSyncStrategy {
  source: 'SERVER';
  localCreation: 'BLOCKED_WITHOUT_SERVER';
  conflict: 'LOCK_BASED';
  pullInterval: '5s'; // Crítico - polling agressivo
  
  rules: {
    // 1. Só pode abrir se NÃO existir caixa aberto no servidor
    openRule: 'CHECK_SERVER_FIRST';
    
    // 2. Estado sempre sincronizado do servidor
    stateSync: 'ALWAYS_FROM_SERVER';
    
    // 3. Totais calculados no servidor
    totals: 'SERVER_CALCULATES';
    
    // 4. Fechamento sincroniza imediatamente
    close: 'IMMEDIATE_PUSH_REQUIRED';
  }
}
```

**Implementação:**
```typescript
// Em database/manager.ts - openCashBox modificado
async openCashBox(data: any) {
  // 1. VERIFICAR SERVIDOR PRIMEIRO
  const serverCashBox = await this.syncManager.getServerCurrentCashBox();
  
  if (serverCashBox && serverCashBox.status === 'open') {
    // 2. SINCRONIZAR DO SERVIDOR
    this.createOrUpdateCashBoxFromServer(serverCashBox);
    throw new Error('Já existe um caixa aberto. Sincronizado do servidor.');
  }
  
  // 3. ABRIR NO SERVIDOR PRIMEIRO
  const serverResponse = await this.syncManager.openCashBoxOnServer(data);
  
  // 4. CRIAR LOCALMENTE COM ID DO SERVIDOR
  const localCashBox = this.createLocalCashBox({
    ...data,
    id: serverResponse.id,
    synced: 1,
  });
  
  return localCashBox;
}
```

## 6.3 Vendas

```typescript
// ESTRATÉGIA: Local-First com Push Imediato

interface SalesSyncStrategy {
  source: 'LOCAL';
  localCreation: 'ALWAYS_ALLOWED';
  conflict: 'MERGE_BY_ID';
  pushTiming: 'IMMEDIATE';
  
  rules: {
    // 1. Venda SEMPRE criada localmente primeiro
    creation: 'LOCAL_FIRST';
    
    // 2. Push imediato após finalização
    push: 'IMMEDIATE_ON_COMPLETE';
    
    // 3. Deduplicação por ID + idempotency key
    dedup: 'ID_AND_IDEMPOTENCY';
    
    // 4. Offline: funciona normal, sync quando reconectar
    offline: 'QUEUE_AND_RETRY';
  }
}
```

## 6.4 Estoque

```typescript
// ESTRATÉGIA: Delta-Based com Versioning

interface InventorySyncStrategy {
  source: 'SERVER';
  localCreation: 'DELTA_OPERATIONS';
  conflict: 'OPERATION_LOG';
  pullInterval: '30s';
  
  rules: {
    // ✅ CORREÇÃO CRÍTICA: Nunca sincronizar valor absoluto
    // Sempre usar operações de delta
    stockUpdate: 'DELTA_ONLY';  // +5, -3, não "100"
    
    // Servidor mantém log de operações
    logging: 'OPERATION_LOG';
    
    // Conflitos resolvidos por ordem de operação
    conflict: 'TIMESTAMP_ORDER';
  }
}
```

**Implementação:**
```typescript
// Em vez de:
// inventory.qty = serverQty; ❌

// Fazer:
// inventory.qty += movement.delta; ✅

syncInventoryMovement(movement) {
  const current = this.getInventory(movement.productId);
  const newQty = current.qty + movement.delta;
  this.updateInventory(movement.productId, newQty);
  this.logMovement(movement);
}
```

## 6.5 Mesas

```typescript
// ESTRATÉGIA: Realtime-Sync com Estado Compartilhado

interface TablesSyncStrategy {
  source: 'HYBRID';
  localCreation: 'ALLOWED';
  conflict: 'LAST_WRITE_WINS';
  pullInterval: '10s';
  
  rules: {
    // Sessões são globais
    sessions: 'GLOBAL_STATE';
    
    // Pedidos podem ser criados offline
    orders: 'LOCAL_FIRST';
    
    // Pagamentos exigem confirmação
    payments: 'CONFIRM_ON_SERVER';
  }
}
```

## 6.6 Configurações

```typescript
// ESTRATÉGIA: Global vs Local Split

interface SettingsSyncStrategy {
  globalSettings: {
    paymentMethods: true,
    taxRate: true,
    operatingHours: true,
    printerSettings: false,  // Local
  };
  
  syncRule: 'GLOBAL_FROM_SERVER';
  pullInterval: '300s'; // 5 minutos
}
```

---

# 7. REGRAS DE OURO DO SISTEMA

## 7.1 O QUE É LOCAL (NUNCA SINCRONIZA)

```typescript
const LOCAL_ONLY = [
  'device_id',           // Identificador do dispositivo
  'last_sync_date',      // Controle de sync
  'offline_mode',        // Estado de conexão
  'cached_token',        // Token de autenticação
  'printer_config',      // Configuração de impressora
  'ui_preferences',      // Preferências de interface
];
```

## 7.2 O QUE É GLOBAL (SEMPRE DO SERVIDOR)

```typescript
const GLOBAL_ENTITIES = [
  'users',               // Operadores
  'products',            // Catálogo
  'categories',          // Estrutura
  'suppliers',           // Fornecedores
  'customers',           // Clientes
  'global_settings',     // Configurações operacionais
  'cash_box_current',    // Estado do caixa (SINGLETON)
];
```

## 7.3 O QUE NUNCA PODE DIVERGIR

```typescript
const CRITICAL_SYNC = [
  {
    entity: 'cash_box',
    rule: 'SINGLE_INSTANCE',
    validation: 'Apenas UM caixa aberto por vez, globalmente',
  },
  {
    entity: 'inventory.qty',
    rule: 'DELTA_BASED',
    validation: 'Quantidade calculada por soma de movimentos',
  },
  {
    entity: 'sale.total',
    rule: 'IMMUTABLE_AFTER_COMPLETE',
    validation: 'Valor não muda após status = completed',
  },
  {
    entity: 'debt.balance',
    rule: 'CALCULATED',
    validation: 'original - sum(payments)',
  },
];
```

## 7.4 Regras de Conflito

| Entidade | Estratégia | Justificativa |
|----------|------------|---------------|
| Users | Server Wins | Segurança - permissões centralizadas |
| Products | Server Wins | Catálogo único |
| Sales | Client Wins (ID único) | Venda local tem prioridade |
| Inventory | Delta Merge | Evita perda de movimentos |
| CashBox | Lock | Só um caixa por vez |
| Settings | Server Wins | Configuração central |

---

# 8. PLANO DE MIGRAÇÃO

## 8.1 Fase 1: Correções Críticas (Sem Downtime)

**Duração:** 1-2 dias

### 8.1.1 Correção de Usuários

```typescript
// Adicionar em database/manager.ts
createUserFromServer(userData: any) {
  const id = userData.id;
  this.db.prepare(`
    INSERT OR REPLACE INTO users (
      id, username, email, full_name, 
      password_hash, role, branch_id,
      allowed_tabs, synced, needs_online_auth
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id,
    userData.username,
    userData.email,
    userData.fullName,
    userData.passwordHash || '$NEEDS_ONLINE$',
    userData.role,
    userData.branchId,
    JSON.stringify(userData.allowedTabs || []),
    userData.passwordHash ? 0 : 1  // needs_online_auth
  );
}
```

### 8.1.2 Correção de CashBox

```typescript
// Adicionar em database/manager.ts
async ensureCashBoxSync() {
  const serverCashBox = await syncManager.getServerCurrentCashBox();
  
  if (serverCashBox) {
    this.createOrUpdateCashBox(serverCashBox);
  }
}

// Modificar openCashBox para verificar servidor
async openCashBox(data: any) {
  // Verificar servidor primeiro
  const existing = await this.ensureCashBoxSync();
  if (existing && existing.status === 'open') {
    return { error: 'CASH_BOX_ALREADY_OPEN', cashBox: existing };
  }
  // ... resto do código
}
```

## 8.2 Fase 2: Polling Agressivo (Sem Downtime)

**Duração:** 1 dia

```typescript
// Em sync/manager.ts - modificar intervalos
const SYNC_INTERVALS = {
  cashBox: 5000,      // 5 segundos - crítico
  tables: 10000,      // 10 segundos - importante
  inventory: 30000,   // 30 segundos
  others: 60000,      // 60 segundos
};

// Criar sync separado para entidades críticas
startCriticalSync() {
  setInterval(() => this.syncCashBox(), SYNC_INTERVALS.cashBox);
  setInterval(() => this.syncTables(), SYNC_INTERVALS.tables);
}
```

## 8.3 Fase 3: Inventory Delta (Requer Testes)

**Duração:** 2-3 dias

```typescript
// Mudar modelo de sync de estoque
// DE: qty = serverQty
// PARA: qty += movement.delta

// Adicionar tabela de movimentos
CREATE TABLE inventory_sync_log (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  operation TEXT NOT NULL,
  source_device TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced INTEGER DEFAULT 0
);
```

## 8.4 Fase 4: Configurações Globais

**Duração:** 1 dia

```typescript
// Adicionar flag isGlobal em settings
ALTER TABLE settings ADD COLUMN is_global INTEGER DEFAULT 0;

// Marcar configurações globais
UPDATE settings SET is_global = 1 WHERE key IN (
  'payment_methods',
  'tax_rate',
  'service_fee',
  'operating_hours'
);
```

---

# 9. IMPLEMENTAÇÃO TÉCNICA

## 9.1 Arquivos a Modificar

| Arquivo | Modificação | Prioridade |
|---------|-------------|------------|
| `sync/manager.ts` | Criar usuários do servidor | 🔴 ALTA |
| `sync/manager.ts` | Polling diferenciado | 🔴 ALTA |
| `database/manager.ts` | `createUserFromServer()` | 🔴 ALTA |
| `database/manager.ts` | CashBox verificar servidor | 🔴 ALTA |
| `database/manager.ts` | Inventory delta | 🟡 MÉDIA |
| `main.ts` | IPC para sync crítico | 🟡 MÉDIA |
| `preload.ts` | Expor novas APIs | 🟡 MÉDIA |

## 9.2 Novas APIs Necessárias

### Backend (Railway)

```typescript
// Já existem, mas verificar comportamento:
GET  /cash-box/current     // Retornar caixa aberto ou null
POST /cash-box/open        // Abrir com lock
POST /cash-box/:id/close   // Fechar

// Adicionar se não existir:
GET  /users/active         // Todos usuários ativos (para sync inicial)
POST /inventory/movement   // Registrar movimento (delta)
GET  /settings/global      // Configurações globais
```

### Electron

```typescript
// Em preload.ts
cashBox: {
  ensureSync: () => ipcRenderer.invoke('cashBox:ensureSync'),
  checkServerState: () => ipcRenderer.invoke('cashBox:checkServerState'),
}

sync: {
  forceCritical: () => ipcRenderer.invoke('sync:forceCritical'),
  getConflicts: () => ipcRenderer.invoke('sync:getConflicts'),
}
```

## 9.3 Testes Obrigatórios

### Cenários Críticos

1. **Dois PCs tentam abrir caixa simultaneamente**
   - Esperado: Apenas um consegue, outro recebe erro

2. **PC offline vende, reconecta**
   - Esperado: Venda sincroniza sem duplicar

3. **Usuário criado em PC1, login em PC2**
   - Esperado: Sync automático, login funciona

4. **Estoque vendido em PC1 e PC2 simultaneamente**
   - Esperado: Servidor tem total correto (soma de ambos)

5. **Configuração alterada no servidor**
   - Esperado: Todos PCs recebem em até 60s

---

# CONCLUSÃO

A arquitetura atual tem **3 falhas críticas** que causam divergência de dados:

1. **Usuários não replicam** para novos PCs
2. **CashBox não é global** - cada PC tem seu próprio
3. **Sync é apenas por timer** - não há reação a mudanças em outros PCs

A solução proposta mantém a filosofia **offline-first** mas garante **consistência eventual** com:

- Server como **Single Source of Truth** para dados globais
- **Polling agressivo** para entidades críticas (CashBox: 5s)
- **Lock distribuído** para operações exclusivas (abertura de caixa)
- **Delta-based** sync para estoque (evita conflitos de quantidade)

**Todas as correções podem ser feitas sem downtime**, mantendo compatibilidade com dados existentes.

---

**Próximo Passo:** Implementar correções da Fase 1 (Usuários + CashBox)
