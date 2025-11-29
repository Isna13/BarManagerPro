# 🚀 Guia Rápido - Sistema de Mesas

## 📦 Instalação

O sistema já está instalado e pronto para uso! As tabelas serão criadas automaticamente na primeira execução.

## 🎯 Primeiro Uso

### 1. Criar Mesas (Apenas Uma Vez)

Abra o console do navegador (F12) no aplicativo e execute:

```javascript
// No console do navegador
await window.initializeTables();
```

Isso criará 20 mesas de exemplo:
- 8 mesas no Salão Principal (1-8)
- 4 mesas no Terraço (9-12)
- 3 mesas VIP (13-15)
- 5 lugares no Balcão (B1-B5)

### 2. Acessar o Sistema

No menu lateral, clique em **"Mesas"**

---

## 📱 Como Usar

### ✅ Abrir uma Mesa

1. Clique em uma mesa verde (disponível)
2. Confirme "Abrir Mesa"
3. Mesa muda para azul (ocupada)

### ✅ Adicionar Clientes

1. Com mesa aberta, clique em **"+ Cliente"**
2. Digite o nome (ex: "João", "Cliente 01", "Casal Mesa 5")
3. Confirme
4. Cliente aparece no painel lateral

**Dica**: Você pode adicionar quantos clientes quiser na mesma mesa!

### ✅ Fazer Pedidos

1. Clique no **ícone +** ao lado do nome do cliente
2. Busque ou selecione o produto
3. Ajuste a quantidade
4. Marque "Vender por caixa" se necessário
5. Clique em **"Adicionar Pedido"**

**O estoque é deduzido automaticamente!** ✨

### ✅ Cancelar Pedido

1. Clique no **ícone de lixeira** 🗑️ ao lado do pedido
2. Confirme o cancelamento
3. **O estoque é restaurado automaticamente!** ✨

### ✅ Transferir Item Entre Clientes

**Exemplo**: João pediu 2 cervejas mas quer dar 1 para Maria

1. Abra o console (F12)
2. Execute:
```javascript
await electronAPI.tableOrders.transfer({
  orderId: "ID_DO_PEDIDO",
  fromCustomerId: "ID_JOAO",
  toCustomerId: "ID_MARIA",
  qtyUnits: 1, // Transferir apenas 1 unidade
  transferredBy: localStorage.getItem('userId')
});
```

**Nota**: A interface visual para transferência será adicionada em breve.

### ✅ Dividir Item

**Exemplo**: 1 garrafa dividida entre 3 pessoas

```javascript
await electronAPI.tableOrders.split({
  orderId: "ID_DO_PEDIDO",
  splits: [
    { customerId: "ID_CLIENTE_1", qtyUnits: 1 },
    { customerId: "ID_CLIENTE_2", qtyUnits: 1 },
    { customerId: "ID_CLIENTE_3", qtyUnits: 1 }
  ],
  splitBy: localStorage.getItem('userId')
});
```

### ✅ Processar Pagamento

#### Pagar Conta Individual
1. No card do cliente, clique em **"Pagar [valor]"**
2. Escolha o método (Dinheiro, Orange, Cartão)
3. Ajuste o valor se for pagamento parcial
4. Confirme

#### Pagar Mesa Inteira
1. Clique em **"+ Pagamento"** no topo
2. Escolha o método
3. Digite o valor total
4. Confirme

**Aceita múltiplos pagamentos!** Ex: 50% cartão + 50% dinheiro

### ✅ Fechar Mesa

1. Certifique-se que **tudo está pago** (Pendente = 0 FCFA)
2. Clique em **"Fechar Mesa"**
3. Confirme
4. Mesa volta para verde (disponível)

---

## 🎨 Cores e Status

| Cor | Status | Significado |
|-----|--------|-------------|
| 🟢 Verde | Disponível | Mesa livre para abrir |
| 🔵 Azul | Ocupada | Mesa com pedidos ativos |
| 🟡 Amarelo | Aguardando | Pedidos finalizados, falta pagar |
| ⚫ Cinza | Fechada | Sessão encerrada |

---

## 📊 Informações na Mesa

Ao passar o mouse ou clicar numa mesa ocupada, você vê:

- 👥 Número de clientes
- 🛒 Quantidade de pedidos
- 💰 Valor total
- 🕐 Horário de abertura

---

## ⚡ Atalhos e Dicas

### Auto-Refresh
O sistema atualiza automaticamente a cada **10 segundos**. Você também pode clicar em **"Atualizar"** no topo.

### Busca Rápida
Na tela de adicionar pedido, use o campo de busca para encontrar produtos rapidamente.

### Nomes Personalizados
- ✅ "João Silva"
- ✅ "Casal Mesa 3"
- ✅ "Cliente VIP"
- ✅ "Cliente 01", "Cliente 02", etc.

### Pedidos em Lote
Você pode adicionar vários pedidos seguidos para o mesmo cliente sem fechar o modal.

---

## 🔒 Segurança e Validações

### ✅ O Sistema Garante:
- Mesa ocupada não pode ser aberta novamente
- Mesa com pagamento pendente não pode ser fechada
- Pedido cancelado restaura o estoque
- Transferência valida se clientes estão na mesma mesa
- Divisão valida se soma das partes = total
- Todas as ações são auditadas com usuário e timestamp

---

## 🐛 Solução de Problemas

### Mesa não abre
- ✅ Verifique se não está ocupada (azul)
- ✅ Certifique-se que o caixa está aberto

### Não consigo fechar mesa
- ✅ Verifique se há valores pendentes
- ✅ Todos os clientes devem estar com status "Pago"

### Estoque não está sendo deduzido
- ✅ Verifique se o produto tem estoque disponível
- ✅ Confira se a branch está correta

### Pedido não aparece
- ✅ Clique em "Atualizar" no topo
- ✅ Verifique se o cliente está selecionado

---

## 📞 Fluxo Completo de Exemplo

### Cenário: Mesa 5 com Família de 4 Pessoas

```
1. Abrir Mesa 5
   ├─ Sistema cria sessão SESSION-001
   └─ Mesa fica azul

2. Adicionar Clientes
   ├─ + "Pai" (Cliente 1)
   ├─ + "Mãe" (Cliente 2)
   ├─ + "Filho" (Cliente 3)
   └─ + "Filha" (Cliente 4)

3. Fazer Pedidos
   ├─ Pai: 2x Cerveja Heineken
   ├─ Mãe: 1x Vinho Tinto
   ├─ Filho: 1x Coca-Cola
   └─ Filha: 1x Sprite

4. Totais Atualizados
   ├─ Pai: 4.000 FCFA
   ├─ Mãe: 8.000 FCFA
   ├─ Filho: 500 FCFA
   ├─ Filha: 500 FCFA
   └─ TOTAL MESA: 13.000 FCFA

5. Pagamentos
   ├─ Pai paga sua conta: 4.000 FCFA (Dinheiro)
   ├─ Mãe paga sua conta: 8.000 FCFA (Cartão)
   └─ Pai paga pelos filhos: 1.000 FCFA (Dinheiro)

6. Fechar Mesa
   ├─ Validação: Tudo pago? ✅ Sim
   ├─ Mesa fechada
   └─ Mesa volta para verde
```

---

## 🎉 Pronto!

Agora você está pronto para usar o **Sistema de Gestão de Mesas** do BarManager Pro!

Para funcionalidades avançadas (transferências, divisões, relatórios), consulte a documentação completa em `TABLES_SYSTEM.md`.

---

**Versão**: 1.0  
**Última atualização**: 26 de novembro de 2025  
**Suporte**: Consulte a documentação técnica completa
