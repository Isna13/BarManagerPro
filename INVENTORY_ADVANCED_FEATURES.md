# Sistema Avançado de Estoque - BarManagerPro

## 📦 Visão Geral

Sistema inteligente de gestão de estoque com **abertura automática de caixas**, **previsões de consumo**, **rastreamento completo de movimentações** e **auditoria detalhada**.

---

## ✨ Funcionalidades Implementadas

### 1. **Coluna "Total em Garrafas"** ✅

**Fórmula automática:**
```
TotalEmGarrafas = (CaixasFechadas × QuantidadePorCaixa) + GarrafasAvulsas
```

**Características:**
- ✅ Recalculado automaticamente após cada venda
- ✅ Suporte a ordenação ascendente/descendente
- ✅ Status visual colorido:
  - 🔴 **Vermelho**: Sem estoque (0 unidades)
  - 🟡 **Amarelo**: Estoque baixo (≤ alerta)
  - 🟢 **Verde**: Normal (acima do alerta)

---

### 2. **Separação de Estoque** ✅

O sistema agora gerencia **três componentes independentes**:

| Componente | Descrição | Coluna no Banco |
|------------|-----------|-----------------|
| **Caixas Fechadas** | Caixas lacradas não abertas | `closed_boxes` |
| **Caixa Aberta** | Garrafas avulsas da caixa aberta | `open_box_units` |
| **Total em Garrafas** | Soma calculada automaticamente | `total_bottles` (calculado) |

**Exemplo:**
```
Produto: Heineken
- Caixas Fechadas: 5 (5 × 12 = 60 garrafas)
- Caixa Aberta: 8 garrafas
- Total: 68 garrafas
```

---

### 3. **Regra de Prioridade de Vendas** ✅

#### 3.1 Venda Unitária (Garrafas)

**Algoritmo:**
1. **Prioridade 1**: Subtrair da caixa aberta
2. **Se caixa aberta = 0**: Abrir automaticamente uma caixa fechada
   - `closed_boxes -= 1`
   - `open_box_units += units_per_box`
3. **Continuar**: Deduzir da caixa recém aberta

**Exemplo Real:**
```
Estado Inicial:
  Caixas Fechadas: 5
  Caixa Aberta: 0
  Total: 60 garrafas

Venda: 2 garrafas

Processo:
  1. Caixa aberta está vazia (0)
  2. Sistema abre automaticamente 1 caixa
     - Caixas Fechadas: 4
     - Caixa Aberta: 12
  3. Deduz 2 garrafas da caixa aberta
     - Caixas Fechadas: 4
     - Caixa Aberta: 10
     - Total: 58 garrafas

✅ Log registrado: "Caixa aberta automaticamente"
```

#### 3.2 Venda por Muntu (Promoção)

**Características:**
- ✅ Subtrai sempre de `open_box_units` primeiro
- ✅ Abre caixa automaticamente se necessário
- ✅ Suporte a **múltiplos Muntu** (2×, 3×, etc.)
- ✅ **Modo Rigoroso**: Impede venda sem estoque suficiente
- ✅ **Modo Permissivo**: Permite Muntu parcial (configurável)

**Validação de Estoque:**
```typescript
const totalAvailable = (closed_boxes × units_per_box) + open_box_units;
if (totalAvailable < qtyToDeduct) {
  throw new Error('Estoque insuficiente');
}
```

---

### 4. **Relatório de Aberturas Automáticas de Caixa** ✅

**Tabela:** `stock_movements`

**Campos registrados:**
- 📅 Data/Hora da movimentação
- 📦 Produto (nome + SKU)
- 🤖 **Caixa aberta automaticamente?** (Sim/Não)
- 👤 Vendedor/Terminal
- 📝 Motivo (ex: "venda unitária", "venda Muntu")
- 📊 Before/After (qty_units, closed_boxes, open_box_units)
- 🗒️ Observações

**Tipos de Movimentação:**
- `sale` - Venda normal
- `sale_muntu` - Venda Muntu
- `purchase` - Compra/recebimento
- `box_opening` - Abertura manual de caixa
- `loss` - Perda (roubo, extravio, vencido)
- `breakage` - Quebra (queda, manuseio)
- `adjustment` - Ajuste manual

**Acesso:**
- Interface na aba **"Movimentações"** com filtros
- Exportável para PDF/Excel (futuro)

---

### 5. **Sistema de Consistência do Estoque** ✅

**Validações Automáticas:**

| Regra | Ação |
|-------|------|
| `total_bottles < 0` | ❌ **ERRO CRÍTICO** |
| `closed_boxes < 0` | ❌ **ERRO CRÍTICO** |
| `open_box_units > units_per_box` | ⚙️ **Auto-correção** |

**Auto-correção de Caixa Aberta:**
```typescript
// Se caixa aberta tem 15 unidades e caixa tem 12 unidades
const extraBoxes = Math.floor(15 / 12); // 1 caixa extra
const remaining = 15 % 12; // 3 unidades

// Resultado:
closed_boxes += 1;
open_box_units = 3;
```

**Método:** `validateInventoryConsistency(productId, branchId)`

---

### 6. **Previsão de Esgotamento** ✅

**Fórmula:**
```
DiasRestantes = TotalEmGarrafas / ConsumoDiarioMedio
```

**Consumo Diário Médio:**
- Calculado automaticamente com base nas vendas reais
- **3 períodos** de análise:
  - Média 7 dias: Consumo recente
  - Média 15 dias: Tendência intermediária ⭐ (usado para previsão)
  - Média 30 dias: Tendência de longo prazo

**Status Visual:**
- 🔴 **≤ 3 dias**: Crítico (reposição urgente)
- 🟡 **≤ 7 dias**: Atenção (planejar reposição)
- 🟢 **> 7 dias**: Normal

**Atualização:**
```typescript
inventory.calculateConsumption(productId, branchId)
```

---

### 7. **Reposição Inteligente** ✅

**Fórmula:**
```
ReposiçãoSugerida = (MetaDias × ConsumoDiarioMedio) - TotalEmGarrafas
```

**Parâmetros:**
- `MetaDias`: 15 dias (configurável)
- `ConsumoDiarioMedio`: Média dos últimos 15 dias

**Exemplo:**
```
Produto: Brahma Lata
- Consumo médio: 8 unidades/dia
- Estoque atual: 50 unidades
- Meta: manter 15 dias de estoque

Cálculo:
  Necessário = 15 × 8 = 120 unidades
  Atual = 50 unidades
  Sugestão = 120 - 50 = 70 unidades

💡 Sugestão: Comprar 70 unidades
```

**Interface:**
- Coluna "Reposição Sugerida" na tabela de estoque
- Badge verde "✓ OK" quando estoque está adequado

---

### 8. **Perdas, Quebras e Ajustes Controlados** ✅

#### 8.1 Registrar Perda
**Motivos:** Roubo, Extravio, Vencido, Outro

```typescript
inventory.registerLoss(
  productId,
  branchId,
  quantity: 5,
  reason: "Roubo",
  responsible: "João Silva",
  notes: "Detectado na contagem"
)
```

#### 8.2 Registrar Quebra
**Motivos:** Queda, Manuseio incorreto, Transporte, Outro

```typescript
inventory.registerBreakage(
  productId,
  branchId,
  quantity: 2,
  reason: "Queda",
  responsible: "Maria Santos",
  notes: "Durante reposição"
)
```

#### 8.3 Ajuste Manual
**Motivos:** Contagem de inventário, Correção de erro, Transferência, Outro

```typescript
inventory.manualAdjustment(
  productId,
  branchId,
  quantity: +10, // positivo = adiciona, negativo = remove
  reason: "Contagem de inventário",
  responsible: "Admin",
  notes: "Inventário anual"
)
```

**Logs Obrigatórios:**
- ✅ Responsável (obrigatório)
- ✅ Motivo (obrigatório)
- ✅ Before/After (automático)
- ✅ Data/Hora (automático)

---

### 9. **Suporte a Doses** ✅

**Para produtos como whisky, vodka, licores:**

**Configuração no Produto:**
```typescript
{
  dose_enabled: true,
  doses_per_bottle: 25 // 1 garrafa = 25 doses
}
```

**Cálculo Automático:**
```
Venda: 3 doses

Conversão:
  unitsToDeduct = Math.ceil(3 / 25) = 1 garrafa

Dedução:
  open_box_units -= 1
```

**Interface:**
- Campo "Doses por Garrafa" na página de Produtos
- Checkbox "Vender por Doses"

---

### 10. **API de Estoque** ✅

**Métodos IPC Disponíveis:**

```typescript
// Listar estoque
window.electronAPI.inventory.list(filters)

// Registrar perda
window.electronAPI.inventory.registerLoss(
  productId, branchId, quantity, reason, responsible, notes
)

// Registrar quebra
window.electronAPI.inventory.registerBreakage(
  productId, branchId, quantity, reason, responsible, notes
)

// Ajuste manual
window.electronAPI.inventory.manualAdjustment(
  productId, branchId, quantity, reason, responsible, notes
)

// Calcular consumo e previsões
window.electronAPI.inventory.calculateConsumption(productId, branchId)

// Buscar movimentações
window.electronAPI.inventory.getMovements(filters)

// Validar consistência
window.electronAPI.inventory.validateConsistency(productId, branchId)
```

**Estrutura de Dados:**
```typescript
interface InventoryItem {
  id: string;
  product_id: string;
  branch_id: string;
  qty_units: number;
  closed_boxes: number;
  open_box_units: number;
  total_bottles: number; // calculado
  consumption_avg_7d: number;
  consumption_avg_15d: number;
  consumption_avg_30d: number;
  days_until_stockout: number | null;
  suggested_reorder: number;
}
```

---

### 11. **Dashboard Especial de Estoque** ✅

**Indicadores em Tempo Real:**

| Card | Descrição | Ícone |
|------|-----------|-------|
| **Caixas Fechadas** | Total de caixas lacradas | 📦 |
| **Caixa Aberta** | Total de unidades avulsas | 📂 |
| **Total Garrafas** | Soma geral calculada | 🍾 |
| **Estoque Baixo** | Produtos próximos do alerta | ⚠️ |
| **Sem Estoque** | Produtos esgotados | ❌ |
| **Total de Produtos** | Quantidade de SKUs | 📊 |

**Métricas Avançadas:**
- 📈 Velocidade de consumo (unidades/dia)
- 📅 Previsão de ruptura (dias restantes)
- 💡 Sugestão de reposição (unidades)
- 🎁 Muntu vendidos hoje

---

## 🗂️ Estrutura do Banco de Dados

### Tabela: `inventory_items`

```sql
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  qty_units INTEGER DEFAULT 0,
  closed_boxes INTEGER DEFAULT 0,           -- ✨ NOVO
  open_box_units INTEGER DEFAULT 0,         -- ✨ NOVO
  batch_number TEXT,
  expiry_date DATETIME,
  location TEXT,
  consumption_avg_7d REAL DEFAULT 0,        -- ✨ NOVO
  consumption_avg_15d REAL DEFAULT 0,       -- ✨ NOVO
  consumption_avg_30d REAL DEFAULT 0,       -- ✨ NOVO
  days_until_stockout INTEGER DEFAULT NULL, -- ✨ NOVO
  suggested_reorder INTEGER DEFAULT 0,      -- ✨ NOVO
  synced BOOLEAN DEFAULT 0,
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(product_id, branch_id, batch_number)
);
```

### Tabela: `stock_movements` (Auditoria)

```sql
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  closed_boxes_before INTEGER DEFAULT 0,    -- ✨ NOVO
  closed_boxes_after INTEGER DEFAULT 0,     -- ✨ NOVO
  open_box_before INTEGER DEFAULT 0,        -- ✨ NOVO
  open_box_after INTEGER DEFAULT 0,         -- ✨ NOVO
  box_opened_automatically BOOLEAN DEFAULT 0, -- ✨ NOVO
  reason TEXT NOT NULL,
  responsible TEXT,
  terminal TEXT,
  sale_id TEXT,
  purchase_id TEXT,
  notes TEXT,
  synced BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### Tabela: `products` (Adições)

```sql
-- Novas colunas
dose_enabled BOOLEAN DEFAULT 0,     -- ✨ NOVO
doses_per_bottle INTEGER DEFAULT 0  -- ✨ NOVO
```

---

## 🎯 Fluxo de Trabalho

### 1. Recebimento de Compra
```
Compra: 10 caixas de Heineken (12 unidades/caixa)

Processamento:
  ├─ qty_units += 120
  ├─ closed_boxes += 10
  └─ open_box_units += 0

Resultado:
  ├─ Caixas Fechadas: 10
  ├─ Caixa Aberta: 0
  └─ Total: 120 garrafas

📝 Log: "Compra recebida"
```

### 2. Venda no POS
```
Venda: 3 garrafas

Estado Atual:
  ├─ Caixas Fechadas: 10
  ├─ Caixa Aberta: 0
  └─ Total: 120

Processamento:
  1. open_box_units (0) < qty_to_sell (3)
  2. 🤖 Abrir caixa automaticamente
     ├─ closed_boxes: 10 → 9
     └─ open_box_units: 0 → 12
  3. Deduzir 3 garrafas
     └─ open_box_units: 12 → 9

Resultado:
  ├─ Caixas Fechadas: 9
  ├─ Caixa Aberta: 9
  └─ Total: 117 garrafas

📝 Log: "1 caixa aberta automaticamente (Venda)"
```

### 3. Registro de Perda
```
Perda: 2 garrafas (Vencidas)

Estado Atual:
  ├─ Caixas Fechadas: 9
  ├─ Caixa Aberta: 9
  └─ Total: 117

Processamento:
  └─ open_box_units: 9 → 7 (deduz da caixa aberta)

Resultado:
  ├─ Caixas Fechadas: 9
  ├─ Caixa Aberta: 7
  └─ Total: 115 garrafas

📝 Log: "Perda registrada por João Silva (Vencido)"
```

---

## 📱 Interface do Usuário

### Tela: Estoque Detalhado

**Colunas:**
1. **Produto** (nome + SKU)
2. **Caixas Fechadas** 📦 (com total de unidades)
3. **Caixa Aberta** 📂 (X de Y unidades)
4. **Total Garrafas** 🍾 (colorido por status)
5. **Consumo Médio** (7d / 15d / 30d)
6. **Dias p/ Esgotamento** (colorido por urgência)
7. **Reposição Sugerida** (unidades ou ✓ OK)
8. **Status** (badge colorido)
9. **Ações** (Ajustar / Perda / Quebra)

**Filtros:**
- 🔍 Busca por nome/SKU
- ☑️ Apenas estoque baixo
- ☑️ Sem estoque
- 🔄 Atualizar

**Ordenação:**
- Clique em qualquer coluna
- Setas indicam direção (↑↓)

---

### Tela: Dashboard

**6 Cards Principais:**
- **Caixas Fechadas**: Total de caixas lacradas
- **Unidades em Caixa Aberta**: Total de garrafas avulsas
- **Total em Garrafas**: Soma geral
- **Estoque Baixo**: Quantidade de produtos em alerta
- **Sem Estoque**: Quantidade de produtos esgotados
- **Total de Produtos**: Quantidade de SKUs cadastrados

---

### Tela: Movimentações

**Tabela de Auditoria:**
- Data/Hora
- Produto (nome + SKU)
- Tipo de Movimentação (ícone + label)
- Quantidade (+/-)
- **Caixas Abertas?** (badge "✓ Sim" ou "-")
- Motivo
- Responsável

**Filtros (futuro):**
- Por produto
- Por tipo de movimentação
- Por período
- Apenas aberturas automáticas

---

## 🚀 Próximos Passos

### Fase 1: Endpoints REST/GraphQL
- [ ] Expor APIs para integração mobile
- [ ] Documentação Swagger/OpenAPI
- [ ] Autenticação JWT

### Fase 2: Relatórios Avançados
- [ ] Exportação PDF de movimentações
- [ ] Exportação Excel de estoque
- [ ] Relatório de eficiência de reposição
- [ ] Análise de desperdício (perdas + quebras)

### Fase 3: IA e Machine Learning
- [ ] Previsão de demanda com IA
- [ ] Detecção de anomalias no consumo
- [ ] Sugestão inteligente de compras
- [ ] Alertas proativos de ruptura

### Fase 4: Integração Mobile
- [ ] Sincronização offline-first
- [ ] App Android com todas as funcionalidades
- [ ] Leitura de código de barras
- [ ] Contagem de estoque mobile

---

## 🛠️ Tecnologias Utilizadas

- **SQLite**: Banco de dados local
- **better-sqlite3**: Driver sincronizado de alta performance
- **Electron**: Desktop app cross-platform
- **React**: Interface do usuário
- **TypeScript**: Tipagem estática
- **Tailwind CSS**: Estilização

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- README.md principal
- ARCHITECTURE.md
- DATABASE_SETUP.md

---

**Desenvolvido com ❤️ para gestão inteligente de bares e restaurantes**
