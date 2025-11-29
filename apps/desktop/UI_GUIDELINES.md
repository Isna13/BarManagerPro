# Diretrizes de Interface do Usuário (UI Guidelines)

## 🎨 Padrões de UI Modernos

Este documento estabelece os padrões de interface para o BarManagerPro, garantindo consistência e qualidade visual em todas as funcionalidades.

---

## ❌ Componentes Nativos - NÃO USAR

### **NUNCA use os seguintes componentes nativos do navegador:**

```typescript
// ❌ NUNCA FAZER ISSO
confirm('Tem certeza?')
alert('Operação concluída!')
prompt('Digite um valor:')
```

**Motivos:**
- Aparência antiga e não profissional
- Não são customizáveis
- Não seguem o design do sistema
- Experiência de usuário ruim
- Não são responsivos

---

## ✅ Componentes Modernos - SEMPRE USAR

### 1. **ConfirmDialog** - Para Confirmações

**Localização:** `src/components/ConfirmDialog.tsx`

**Quando usar:**
- Confirmar exclusões
- Confirmar cancelamentos
- Confirmar ações irreversíveis ou importantes
- Qualquer decisão que precise de confirmação do usuário

**Como usar:**

```typescript
import ConfirmDialog from '../components/ConfirmDialog';

// No componente:
const [showConfirmDialog, setShowConfirmDialog] = useState(false);
const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
  title: string;
  message: string;
  onConfirm: () => void;
  type?: 'danger' | 'warning' | 'info';
}>({ title: '', message: '', onConfirm: () => {} });

// Para mostrar o diálogo:
const handleAction = () => {
  setConfirmDialogConfig({
    title: 'Título do Diálogo',
    message: 'Mensagem descritiva do que vai acontecer',
    type: 'danger', // 'danger' | 'warning' | 'info'
    onConfirm: async () => {
      setShowConfirmDialog(false);
      // Sua lógica aqui
    }
  });
  setShowConfirmDialog(true);
};

// No JSX:
{showConfirmDialog && (
  <ConfirmDialog
    title={confirmDialogConfig.title}
    message={confirmDialogConfig.message}
    confirmText="Confirmar"
    cancelText="Cancelar"
    type={confirmDialogConfig.type}
    onConfirm={confirmDialogConfig.onConfirm}
    onCancel={() => setShowConfirmDialog(false)}
  />
)}
```

**Tipos disponíveis:**
- `danger` (vermelho) - Para ações destrutivas (excluir, bloquear)
- `warning` (amarelo) - Para ações que precisam atenção (cancelar, modificar)
- `info` (azul) - Para informações importantes

---

### 2. **Toast** - Para Notificações

**Localização:** `src/contexts/ToastContext.tsx`

**Quando usar:**
- Feedback de sucesso após operações
- Mensagens de erro
- Avisos ao usuário
- Informações temporárias

**Como usar:**

```typescript
import { useToast } from '../contexts/ToastContext';

const Component = () => {
  const toast = useToast();

  const handleAction = async () => {
    try {
      // Sua operação
      toast?.success('Operação realizada com sucesso!');
    } catch (error) {
      toast?.error('Erro ao realizar operação: ' + error.message);
    }
  };
};
```

**Métodos disponíveis:**
- `toast?.success('mensagem')` - Notificação verde de sucesso
- `toast?.error('mensagem')` - Notificação vermelha de erro
- `toast?.info('mensagem')` - Notificação azul informativa
- `toast?.warning('mensagem')` - Notificação amarela de aviso

---

### 3. **Modais Customizados**

**Para inputs complexos e formulários, use modais customizados:**

```typescript
{showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Título do Modal</h2>
        {/* Conteúdo do modal */}
      </div>
      <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end rounded-b-lg">
        <button
          onClick={() => setShowModal(false)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Confirmar
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 🎯 Exemplos Práticos

### ✅ Correto: Cancelar Pedido

```typescript
const handleCancelOrder = async (orderId: string) => {
  setConfirmDialogConfig({
    title: 'Cancelar Pedido',
    message: 'Tem certeza que deseja cancelar este pedido? O estoque será restaurado.',
    type: 'warning',
    onConfirm: async () => {
      setShowConfirmDialog(false);
      try {
        await electronAPI.tableOrders.cancel({ orderId, cancelledBy: userId });
        toast?.success('Pedido cancelado e estoque restaurado!');
        loadSession(selectedSession!.id);
      } catch (error: any) {
        toast?.error('Erro ao cancelar pedido: ' + error.message);
      }
    }
  });
  setShowConfirmDialog(true);
};
```

### ✅ Correto: Bloquear Cliente

```typescript
const handleBlockCustomer = async (customer: Customer) => {
  setConfirmDialogConfig({
    title: 'Bloquear Cliente',
    message: `Deseja realmente bloquear o cliente ${customer.name}? Esta ação pode ser revertida posteriormente.`,
    type: 'danger',
    onConfirm: async () => {
      setShowConfirmDialog(false);
      try {
        await window.electronAPI?.customers?.delete?.(customer.id);
        toast?.success('Cliente bloqueado com sucesso!');
        loadCustomers();
      } catch (error) {
        toast?.error('Erro ao bloquear cliente');
      }
    }
  });
  setShowConfirmDialog(true);
};
```

---

## 🚀 Checklist para Novas Funcionalidades

Antes de implementar qualquer nova funcionalidade, verifique:

- [ ] **NÃO** usei `confirm()`, `alert()` ou `prompt()` nativos
- [ ] Usei `ConfirmDialog` para todas as confirmações
- [ ] Usei `toast` para feedback de operações
- [ ] Modais customizados seguem o padrão visual estabelecido
- [ ] Cores e estilos são consistentes com o resto do sistema
- [ ] Animações estão suaves (usando classes Tailwind como `animate-scale-in`)
- [ ] Acessibilidade: ESC fecha modais, Enter confirma ações

---

## 🎨 Paleta de Cores Padrão

### Ações e Estados:
- **Sucesso:** `bg-green-600` / `text-green-600`
- **Erro/Perigo:** `bg-red-600` / `text-red-600`
- **Aviso:** `bg-yellow-600` / `text-yellow-600`
- **Info:** `bg-blue-600` / `text-blue-600`
- **Primário:** `bg-orange-600` / `text-orange-600`
- **Neutro:** `bg-gray-600` / `text-gray-600`

### Botões:
```typescript
// Primário
className="bg-blue-600 hover:bg-blue-700 text-white"

// Secundário
className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"

// Perigo
className="bg-red-600 hover:bg-red-700 text-white"

// Sucesso
className="bg-green-600 hover:bg-green-700 text-white"
```

---

## 📝 Mensagens de Usuário

### Boas Práticas:

✅ **Seja específico:**
- "Pedido #1234 cancelado com sucesso"
- "Cliente João Silva bloqueado"

❌ **Evite mensagens genéricas:**
- "Operação realizada"
- "Sucesso"

✅ **Informe consequências:**
- "Pedido cancelado e estoque restaurado"
- "Cliente bloqueado. Não poderá fazer novos pedidos."

✅ **Use tom profissional mas amigável:**
- "Tem certeza que deseja cancelar este pedido?"
- "Esta ação não pode ser desfeita. Deseja continuar?"

---

## 🔍 Referências Rápidas

### Arquivos de Exemplo:
- `src/pages/Tables.tsx` - Uso completo de ConfirmDialog e Toast
- `src/pages/Customers.tsx` - Bloqueio de cliente com confirmação
- `src/components/ConfirmDialog.tsx` - Componente de confirmação
- `src/contexts/ToastContext.tsx` - Sistema de notificações

### Documentação Adicional:
- Tailwind CSS: https://tailwindcss.com/docs
- Lucide Icons: https://lucide.dev/icons

---

**Última atualização:** 27 de novembro de 2025

**Mantenha este documento atualizado ao criar novos componentes de UI!**
