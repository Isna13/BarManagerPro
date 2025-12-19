# Correção: VALE de Mobile não aparece na aba Dívidas

## Problema Identificado

Vendas com método de pagamento VALE feitas pelo Mobile (PDV e Mesas) não apareciam na aba Dívidas do Electron.

## Análise Realizada

### 1. Como a aba Dívidas funciona
- A aba Dívidas consulta a tabela `debts` (não a tabela `sales`)
- Para uma venda aparecer na aba Dívidas, deve existir um registro na tabela `debts`
- A tabela `debts` requer `customer_id NOT NULL` e `branch_id NOT NULL`

### 2. Causas Raiz Encontradas

#### Causa 1: Sincronização falhando no INSERT
O INSERT de dívidas no sync/manager.ts estava **faltando o campo `branch_id`**, que é obrigatório:

```typescript
// ANTES (incorreto)
const insert = db.prepare(`
  INSERT OR REPLACE INTO debts (
    id, debt_number, customer_id, sale_id, ...
  ) VALUES (?, ?, ?, ?, ...)
`);

// DEPOIS (correto)
const insert = db.prepare(`
  INSERT OR REPLACE INTO debts (
    id, debt_number, customer_id, branch_id, sale_id, ...
  ) VALUES (?, ?, ?, ?, ?, ...)
`);
```

#### Causa 2: Validação VALE incompleta no Mobile
A validação de VALE existia na UI (tables_screen.dart), mas não no provider. Isso permitia que em certas condições uma venda VALE fosse processada sem `customerId`.

## Correções Aplicadas

### Arquivo: `apps/desktop/electron/sync/manager.ts`
- Adicionado campo `branch_id` no INSERT de debts
- Adicionada verificação se o cliente existe antes de inserir dívida
- **Commit:** `651a269` - "fix: corrigir sincronização de dívidas no Electron"

### Arquivo: `apps/vendas-mobile/lib/providers/tables_provider.dart`
- Adicionada validação VALE no nível do provider (não apenas UI)
- **Commit:** `e49fe02` - "fix: adicionar validação VALE no processPayment do provider de mesas"

## Estado dos Dados no Railway

- **39 dívidas** existem no Railway
- **25 pendentes**, 14 pagas/parciais
- Os dados estão corretos no servidor

## Para Testar

### 1. Reconstruir o Electron
```bash
cd apps/desktop
pnpm build
```

### 2. Forçar resync completo
Ao iniciar o Electron reconstruído, ele deve baixar automaticamente as 39 dívidas.

### 3. Verificar aba Dívidas
As 25 dívidas pendentes devem aparecer na aba.

## Problema de Ambiente (melhor-sqlite3)

O ambiente de desenvolvimento atual tem um problema com `better-sqlite3`:
- O módulo foi compilado para Node.js v24 (MODULE_VERSION 137)
- Electron requer MODULE_VERSION 119

Para resolver em desenvolvimento:
```bash
cd apps/desktop
pnpm exec electron-rebuild -f -w better-sqlite3
```

**Nota:** Este é um problema de ambiente de desenvolvimento, não de código. O build de produção funciona normalmente.

## Commits Relacionados

1. `651a269` - fix: corrigir sincronização de dívidas no Electron
2. `e49fe02` - fix: adicionar validação VALE no processPayment do provider de mesas

## Data: 18/12/2025
