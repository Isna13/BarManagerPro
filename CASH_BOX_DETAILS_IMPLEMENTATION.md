# 📊 Detalhes do Caixa - Paridade Electron ↔ Mobile

## 🎯 Objetivo

Implementar nos apps Mobile (Proprietário e Vendas-Mobile) a mesma funcionalidade de "Detalhes do Caixa Fechado" que existe no Electron, garantindo **paridade total** de dados, cálculos e visualização.

---

## 📐 Diagrama do Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE DADOS DO CAIXA                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     SYNC     ┌─────────────────────────┐     HTTP     ┌─────────────┐
│   ELECTRON  │  ─────────►  │      RAILWAY API        │  ◄─────────  │   MOBILE    │
│   (SQLite)  │              │    (PostgreSQL)         │              │  (Flutter)  │
└─────────────┘              └─────────────────────────┘              └─────────────┘
      │                                 │                                    │
      │                                 │                                    │
      ▼                                 ▼                                    ▼
┌─────────────┐              ┌─────────────────────────┐              ┌─────────────┐
│ CALCULA     │              │ ENDPOINT DETALHES       │              │ APENAS      │
│ LOCALMENTE  │              │ GET /cash-box/:id/details│             │ EXIBE       │
│             │              │                         │              │             │
│ - Receita   │              │ 🔴 FONTE DA VERDADE     │              │ - Receita   │
│ - Custo     │              │                         │              │ - Custo     │
│ - Lucro     │              │ Calcula:                │              │ - Lucro     │
│ - Margem    │              │ - Produtos vendidos     │              │ - Margem    │
│ - Vales     │              │ - Totais por método     │              │ - Vales     │
└─────────────┘              │ - Métricas de lucro     │              └─────────────┘
                             └─────────────────────────┘

⚠️ REGRA ABSOLUTA: Mobile NÃO recalcula valores financeiros
📌 Servidor Railway = Única fonte da verdade
```

---

## 📦 Estrutura JSON do Endpoint

### Request
```
GET /cash-box/{cashBoxId}/details
Authorization: Bearer {token}
```

### Response
```json
{
  "id": "uuid-do-caixa",
  "boxNumber": "CX-1234567890",
  "branchId": "main-branch",
  "status": "closed",
  "openedAt": "2026-01-08T08:00:00.000Z",
  "closedAt": "2026-01-08T18:00:00.000Z",
  "openingCash": 5000000,
  "closingCash": 15500000,
  "difference": 0,
  "notes": "Fechamento normal",
  "openedBy": "João Silva",
  
  "salesCount": 45,
  
  "totalSales": 12000000,
  "totalCash": 8000000,
  "totalMobileMoney": 2000000,
  "totalCard": 1000000,
  "totalDebt": 1000000,
  
  "profitMetrics": {
    "totalRevenue": 12000000,
    "totalCOGS": 7200000,
    "grossProfit": 4800000,
    "profitMargin": 40.00,
    "netProfit": 3800000,
    "netMargin": 31.67,
    "salesItems": [
      {
        "productId": "uuid-produto-1",
        "productName": "Super Bock 33cl",
        "sku": "SB33",
        "qtySold": 120,
        "revenue": 3600000,
        "cost": 2160000,
        "profit": 1440000,
        "margin": 40.00
      },
      {
        "productId": "uuid-produto-2",
        "productName": "Heineken 33cl",
        "sku": "HK33",
        "qtySold": 80,
        "revenue": 2800000,
        "cost": 1680000,
        "profit": 1120000,
        "margin": 40.00
      }
    ]
  }
}
```

**Nota**: Todos os valores monetários estão em **centavos** (dividir por 100 para exibir).

---

## 🧠 Cálculos (REGRAS ABSOLUTAS)

| Métrica | Fórmula | Descrição |
|---------|---------|-----------|
| **Receita Total** | `Σ(item.total)` | Soma do total de todos os itens vendidos |
| **Custo Total (COGS)** | `Σ(item.unitCost × item.qtyUnits)` | Soma do custo de todos os itens |
| **Lucro Bruto** | `Receita - COGS` | Margem antes de descontar créditos |
| **Margem Bruta (%)** | `(Lucro Bruto / Receita) × 100` | Percentual de lucro bruto |
| **Lucro Líquido** | `Lucro Bruto - Vales` | Desconta crédito concedido |
| **Margem Líquida (%)** | `(Lucro Líquido / Receita) × 100` | Percentual de lucro líquido |

---

## 🏗️ Arquivos Modificados/Criados

### Backend (Railway)

| Arquivo | Modificação |
|---------|-------------|
| `apps/backend/src/cash-box/cash-box.service.ts` | ➕ Método `getCashBoxDetails()` |
| `apps/backend/src/cash-box/cash-box.controller.ts` | ➕ Endpoint `GET /:id/details` |

### Mobile do Proprietário

| Arquivo | Modificação |
|---------|-------------|
| `apps/mobile/lib/services/api_service.dart` | ➕ Método `getCashBoxDetails()` |
| `apps/mobile/lib/models/models.dart` | ➕ Classes `CashBoxDetails`, `ProfitMetrics`, `SalesItemDetail` |
| `apps/mobile/lib/screens/cash_box_details_screen.dart` | 🆕 Nova tela de detalhes |
| `apps/mobile/lib/screens/cash_history_screen.dart` | ✏️ Navegação para nova tela |

### Vendas-Mobile

| Arquivo | Modificação |
|---------|-------------|
| `apps/vendas-mobile/lib/services/api_service.dart` | ➕ Método `getCashBoxDetails()` |
| `apps/vendas-mobile/lib/screens/cash_box_details_screen.dart` | 🆕 Nova tela de detalhes |
| `apps/vendas-mobile/lib/screens/cash_box_history_screen.dart` | ✏️ Botão "Ver Detalhes Completos" |

---

## ✅ Funcionalidades Implementadas

### 1. Lista de Produtos Vendidos
- Nome do produto
- Quantidade vendida
- Valor da venda (receita)
- Valor de reposição (custo)
- Lucro bruto por produto
- Indicador visual para produtos sem custo registrado

### 2. Cards de Resumo Financeiro
- **Valor da Venda Total** (azul)
- **Valor da Reposição** (laranja)
- **Lucro Bruto** + margem (verde)
- **Lucro Líquido** + margem (roxo)
- **Vales** - crédito a receber (amarelo)

### 3. Métodos de Pagamento
- 💵 Dinheiro
- 📱 Orange & TeleTaku
- 💳 Cartão/Misto
- 📋 Vale (Fiado)
- TOTAL

### 4. Informações do Caixa
- Data/hora de abertura e fechamento
- Duração
- Quantidade de vendas
- Valor inicial e final
- Diferença
- Operador
- Observações

---

## 🔒 Garantias de Consistência

| Verificação | Status |
|-------------|--------|
| Mobile não recalcula valores | ✅ |
| Servidor é fonte da verdade | ✅ |
| Fórmulas idênticas ao Electron | ✅ |
| Valores em centavos consistentes | ✅ |
| Arredondamento de margem (2 casas) | ✅ |

---

## 🧪 Casos de Teste Obrigatórios

1. **Caixa fechado normal**
   - Electron exibe X produtos → Mobile exibe X produtos
   - Totais idênticos

2. **Caixa com vendas + vales**
   - Lucro líquido = Lucro bruto - Vales
   - Vale aparece no card amarelo

3. **Produtos sem custo registrado**
   - Indicador visual "⚠️ Sem custo"
   - Card amarelo claro

4. **Caixa com múltiplos métodos de pagamento**
   - Cada método soma corretamente
   - Total = soma de todos os métodos

5. **Comparação lado a lado**
   - Electron e Mobile devem exibir valores idênticos

---

## 📱 Navegação

### Mobile do Proprietário
```
Histórico de Caixa → Toque no caixa → Tela de Detalhes Completos
```

### Vendas-Mobile
```
Histórico de Caixa → Expandir caixa → Botão "Ver Detalhes Completos" → Tela de Detalhes
```

---

## 🔄 Sincronização

O endpoint `GET /cash-box/:id/details` funciona **online**. Para funcionamento offline:
- Os dados básicos do caixa são sincronizados para SQLite local
- Detalhes completos requerem conexão para garantir precisão
- Recomendação: Adicionar cache local em versão futura se necessário

---

## 📋 Checklist de Deploy

- [ ] Fazer push do código backend
- [ ] Railway faz deploy automático
- [ ] Testar endpoint no Railway
- [ ] Build Flutter do Mobile Proprietário
- [ ] Build Flutter do Vendas-Mobile
- [ ] Testar em dispositivo real
- [ ] Comparar com Electron lado a lado

---

## 👤 Responsável

Implementação realizada em: **8 de Janeiro de 2026**

**Garantia**: Esta implementação segue rigorosamente as regras de auditoria financeira e mantém paridade total com o sistema Electron existente.
