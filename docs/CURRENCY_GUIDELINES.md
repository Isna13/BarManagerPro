# 💰 Diretrizes de Moeda - FCFA (Franco CFA)

## Informações Gerais

**Moeda Oficial:** FCFA (Franco CFA - Comunidade Financeira Africana)  
**País:** Guiné-Bissau  
**Código ISO:** XOF (Franco CFA BCEAO)  
**Símbolo:** FCFA  

## Padrão de Armazenamento

### ⚠️ IMPORTANTE: Todos os valores monetários devem ser armazenados em **centavos** (multiplicados por 100)

**Por quê?**
- Evita problemas de arredondamento com números decimais
- Mantém precisão em cálculos
- Padrão internacional para sistemas financeiros

**Exemplos:**
```typescript
// ✅ CORRETO
const price = 1500;           // Armazena como 150000 (1500 FCFA)
const totalCents = price * 100; // 150000

// ❌ ERRADO
const price = 15.00;          // Pode causar erros de arredondamento
```

## Utilitário de Formatação

Use o módulo `utils/currency.ts` para todas as operações com moeda:

### Importação
```typescript
import { formatCurrency, toCents, fromCents } from '../utils/currency';
```

### Funções Disponíveis

#### 1. `formatCurrency(value, options?)`
Formata centavos para exibição com símbolo FCFA

```typescript
formatCurrency(150000)                          // "1.500 FCFA"
formatCurrency(150000, { showDecimals: true })  // "1.500,00 FCFA"
formatCurrency(150000, { includeCurrency: false }) // "1.500"
```

#### 2. `toCents(value)`
Converte FCFA para centavos (para armazenamento)

```typescript
toCents(1500)    // 150000
toCents(10.50)   // 1050
```

#### 3. `fromCents(cents)`
Converte centavos para FCFA (para exibição)

```typescript
fromCents(150000)  // 1500
fromCents(1050)    // 10.50
```

#### 4. `parseCurrency(value)`
Parse string para valor numérico

```typescript
parseCurrency("1.500")       // 1500
parseCurrency("1.500,50")    // 1500.50
parseCurrency("1.500 FCFA")  // 1500
```

#### 5. `isValidCurrencyValue(value)`
Valida se um valor é válido para moeda

```typescript
isValidCurrencyValue(1500)    // true
isValidCurrencyValue(-100)    // false (negativo)
isValidCurrencyValue(NaN)     // false
```

## Padrões de Implementação

### 1. Componentes React

```typescript
import { formatCurrency } from '../utils/currency';

function ProductCard({ product }) {
  return (
    <div>
      <p>Preço: {formatCurrency(product.price)}</p>
      {/* Exibe: "Preço: 1.500 FCFA" */}
    </div>
  );
}
```

### 2. Formulários (Input)

```typescript
import { toCents, fromCents } from '../utils/currency';

const [price, setPrice] = useState(0); // Armazena em centavos

<input
  type="number"
  value={fromCents(price)} // Converte para exibição
  onChange={(e) => {
    const value = parseFloat(e.target.value) || 0;
    setPrice(toCents(value)); // Converte para armazenamento
  }}
  placeholder="Preço em FCFA"
/>
```

### 3. API/Database

```typescript
// Ao enviar para API
const data = {
  productId: '123',
  price: toCents(1500), // 150000 centavos
};

// Ao receber da API
const displayPrice = formatCurrency(data.price);
// "1.500 FCFA"
```

### 4. Cálculos

```typescript
// ✅ SEMPRE trabalhe com centavos nos cálculos
const item1 = 150000; // 1500 FCFA
const item2 = 250000; // 2500 FCFA
const total = item1 + item2; // 400000 centavos = 4000 FCFA

// Exibir resultado
console.log(formatCurrency(total)); // "4.000 FCFA"
```

## Exemplos Práticos por Módulo

### POS (Ponto de Venda)
```typescript
const cartItem = {
  productId: 'prod-1',
  quantity: 2,
  unitPrice: toCents(500), // 50000 centavos
  subtotal: toCents(500) * 2, // 100000 centavos
};

// Exibição
<p>Subtotal: {formatCurrency(cartItem.subtotal)}</p>
// "Subtotal: 1.000 FCFA"
```

### Produtos
```typescript
const product = {
  name: 'Cerveja',
  priceUnit: toCents(400),  // 40000 centavos
  costUnit: toCents(250),   // 25000 centavos
};

// Margem de lucro
const margin = product.priceUnit - product.costUnit;
console.log(formatCurrency(margin)); // "150 FCFA"
```

### Caixa
```typescript
const cashBox = {
  openingCash: toCents(50000),     // 5.000.000 centavos
  totalSales: toCents(125000),      // 12.500.000 centavos
  closingCash: toCents(175000),     // 17.500.000 centavos
};

// Relatório
<div>
  <p>Abertura: {formatCurrency(cashBox.openingCash)}</p>
  <p>Vendas: {formatCurrency(cashBox.totalSales)}</p>
  <p>Fechamento: {formatCurrency(cashBox.closingCash)}</p>
</div>
```

## Migração de Código Existente

Se você encontrar código antigo com outras moedas:

### ❌ Antes (Incorreto)
```typescript
const price = new Intl.NumberFormat('pt-AO', {
  style: 'currency',
  currency: 'AOA', // Kwanza angolano
}).format(value);
```

### ✅ Depois (Correto)
```typescript
import { formatCurrency } from '../utils/currency';
const price = formatCurrency(value);
```

## Checklist de Desenvolvimento

Ao implementar novas funcionalidades com valores monetários:

- [ ] Valores são armazenados em **centavos** (× 100)
- [ ] Uso de `formatCurrency()` para exibição
- [ ] Uso de `toCents()` para conversão de input
- [ ] Validação com `isValidCurrencyValue()`
- [ ] Cálculos feitos em centavos
- [ ] Testes incluem verificação de arredondamento
- [ ] Documentação atualizada

## FAQ

**Q: Por que não usar o Intl.NumberFormat com XOF?**  
A: O XOF (Franco CFA) não é amplamente suportado em todas as localizações. Nossa implementação customizada garante consistência.

**Q: Como lidar com descontos percentuais?**  
A: Sempre calcule em centavos e arredonde no final:
```typescript
const price = 150000; // 1500 FCFA
const discount = 0.10; // 10%
const finalPrice = Math.round(price * (1 - discount));
console.log(formatCurrency(finalPrice)); // "1.350 FCFA"
```

**Q: E se eu precisar de decimais?**  
A: Use a opção `showDecimals`:
```typescript
formatCurrency(150050, { showDecimals: true }); 
// "1.500,50 FCFA"
```

---

**Última atualização:** 26/11/2025  
**Mantido por:** Equipe BarManager Pro
