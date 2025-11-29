# Remoção de Automações de Estoque

## O que foi removido?

### 1. Migration 6 - Re-processamento automático de compras
- **Localização**: `apps/desktop/electron/database/manager.ts` (linhas 525-595, removidas)
- **O que fazia**: A cada inicialização do sistema, pegava todas as compras com status 'completed' ou 'received' e re-criava/atualizava registros em `inventory_items`
- **Problema**: Executava toda vez que o app era aberto, duplicando ou corrigindo dados automaticamente

### 2. Migration 7 - Correções de estoque hard-coded
- **Localização**: `apps/desktop/electron/database/manager.ts` (linhas 597-640, removidas)
- **O que fazia**: Corrigia o estoque de 5 produtos específicos (Cristal, Super Bock, Sagres, Fogo de Pias, XL) com valores fixos
- **Problema**: Sobrescrevia os valores reais com valores hard-coded toda vez que o sistema iniciava

### 3. Seed automático de produtos de exemplo
- **Localização**: `apps/desktop/electron/database/manager.ts`
- **Funções removidas**:
  - `seedSampleProducts()` - criava 5 produtos de bebidas com estoque inicial
  - `addStockToExistingProducts()` - adicionava estoque para produtos sem estoque
- **O que faziam**: Criavam produtos de demonstração e estoque automático
- **Problema**: Inseriam dados não solicitados no sistema

## Como funciona agora?

### Fluxo correto de estoque:
1. **Você registra uma compra** na aba "Compras"
2. **Você recebe/completa a compra** clicando no botão correspondente
3. **O sistema chama `completePurchase()`** que:
   - Atualiza o status da compra para 'completed'
   - Para cada item da compra, chama `addInventory()`
4. **`addInventory()` cria/atualiza o estoque**:
   - Calcula caixas fechadas e unidades avulsas
   - Cria novo registro em `inventory_items` ou atualiza existente
   - Registra movimentação em `stock_movements`

### Inicialização do sistema:
- **Antes**: Migrations 6 e 7 executavam automaticamente, re-processando compras e corrigindo valores
- **Agora**: Apenas a filial padrão é criada se não existir. Nenhum produto ou estoque é gerado automaticamente.

## Como limpar os dados automáticos?

### Opção 1: Script SQL (Recomendado)
Execute o script `LIMPAR_DADOS_AUTO.sql`:

```bash
# No Windows PowerShell
cd c:\BarManagerPro
# Você precisará de uma ferramenta SQLite como DB Browser for SQLite
# ou sqlite3.exe para executar o script
```

### Opção 2: Deletar banco e recomeçar
Se preferir começar do zero:

1. Feche o aplicativo desktop completamente
2. Localize o arquivo do banco de dados (geralmente em `AppData` ou na pasta do projeto)
3. Delete o arquivo `.db`
4. Reinicie o aplicativo - ele criará um banco limpo
5. Registre suas compras novamente

### Opção 3: Limpar apenas estoque (manter produtos)
Se quiser manter os produtos mas limpar o estoque:

```sql
-- Execute no banco de dados:
DELETE FROM inventory_items;
DELETE FROM stock_movements;
```

## Verificação

Após limpar os dados:

1. **Vá para "Estoque Detalhado"** → aba "Estoque Detalhado"
   - Deve estar vazio ou mostrar apenas produtos sem quantidade

2. **Vá para "Compras"**
   - Suas compras devem estar lá
   - Se alguma está como 'completed', o estoque dela já foi processado

3. **Para reprocessar uma compra**:
   - Se a compra já está 'completed', você precisará alterá-la para 'pending'
   - Depois clique em "Receber" novamente
   - O estoque será criado corretamente

## Arquivos modificados

```
apps/desktop/electron/database/manager.ts
  - Removidas Migrations 6 e 7 (linhas 525-640)
  - Removida função seedSampleProducts() e addStockToExistingProducts()
  - Simplificado seedInitialData() para criar apenas a filial padrão
```

## Status das Migrations

| Migration | Status | Descrição |
|-----------|--------|-----------|
| 1-5 | ✅ Mantidas | Migrações essenciais de estrutura |
| 6 | ❌ Removida | Re-processamento automático de compras |
| 7 | ❌ Removida | Correções hard-coded de estoque |

## Próximos passos

1. ✅ **Remova as automações** (já feito)
2. ⚠️ **Limpe o banco de dados** usando um dos métodos acima
3. ✅ **Registre compras manualmente** na aba Compras
4. ✅ **Complete/Receba as compras** para gerar estoque
5. ✅ **Verifique o estoque** na aba Estoque Detalhado

---

**Data da modificação**: 2025
**Versão**: Pós-remoção de automações
