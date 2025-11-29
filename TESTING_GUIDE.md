# 🧪 Guia de Testes - Sistema Online/Offline

## 🚀 Como Executar o Sistema

### Pré-requisitos
```bash
# Node.js 18+ e pnpm instalados
node --version  # Deve ser 18+
pnpm --version  # Deve estar instalado
```

### Iniciando o Sistema

#### Modo Desktop (Electron)
```bash
# Na raiz do projeto
cd c:\BarManagerPro

# Instalar dependências (se ainda não instalou)
pnpm install

# Iniciar aplicativo desktop
pnpm --filter desktop dev

# Ou direto no diretório
cd apps/desktop
pnpm dev
```

O aplicativo Electron será aberto automaticamente.

---

## 🧪 Roteiro de Testes Completo

### Teste 1: Login Offline (sem backend)

**Objetivo**: Verificar autenticação local

**Passos**:
1. ✅ Certifique-se de que o backend **NÃO** está rodando
2. ✅ Abra o aplicativo desktop
3. ✅ Na tela de login, use credenciais de um usuário cadastrado:
   ```
   Email: itchuda@gmail.com
   Senha: [sua senha]
   ```
4. ✅ Clique em "Entrar"

**Resultado Esperado**:
- ✅ Login bem-sucedido
- ✅ Dashboard carregado
- ✅ Indicador mostra: 🔴 **Offline**
- ✅ Texto: "Offline - Dados serão sincronizados ao reconectar"

**Console deve mostrar**:
```
🔐 Tentando login com: itchuda@gmail.com
Backend indisponível, tentando login offline...
✅ Login offline bem-sucedido
```

---

### Teste 2: Operações Offline

**Objetivo**: Criar dados sem conexão

**Passos**:
1. ✅ Ainda em modo offline, vá para **Produtos**
2. ✅ Clique em "Novo Produto"
3. ✅ Preencha:
   ```
   Nome: Cerveja Teste Offline
   SKU: TESTE-001
   Preço Unitário: 500 FCFA
   Custo Unitário: 300 FCFA
   ```
4. ✅ Salve o produto
5. ✅ Vá para **Clientes**
6. ✅ Crie um novo cliente:
   ```
   Nome: Cliente Teste Offline
   Email: teste@offline.com
   ```
7. ✅ Salve o cliente

**Resultado Esperado**:
- ✅ Produto criado com sucesso (toast verde)
- ✅ Cliente criado com sucesso (toast verde)
- ✅ Indicador ainda mostra: 🔴 **Offline**
- ✅ Indicador agora mostra: **"2 pendente(s)"** (ou mais)

**Verificar no SQLite** (opcional):
```sql
-- Abrir: %APPDATA%/barmanager-pro/barmanager.db
SELECT * FROM sync_queue WHERE status = 'pending';
-- Deve mostrar 2 itens (produto + cliente)
```

---

### Teste 3: Verificar Persistência

**Objetivo**: Dados permanecem após reiniciar

**Passos**:
1. ✅ Feche completamente o aplicativo (X)
2. ✅ Abra novamente
3. ✅ Faça login (offline)
4. ✅ Vá para **Produtos**
5. ✅ Vá para **Clientes**

**Resultado Esperado**:
- ✅ Produto "Cerveja Teste Offline" está na lista
- ✅ Cliente "Cliente Teste Offline" está na lista
- ✅ Indicador ainda mostra: 🔴 **Offline**
- ✅ Ainda mostra itens pendentes

---

### Teste 4: Reconexão e Sincronização Automática

**Objetivo**: Sincronizar ao restaurar conexão

**Pré-requisito**: Backend rodando

#### 4.1. Iniciar Backend (NestJS)
```bash
# Em outro terminal
cd c:\BarManagerPro\apps\backend

# Instalar dependências (se necessário)
pnpm install

# Iniciar backend
pnpm dev

# Backend deve rodar em: http://localhost:3000
```

#### 4.2. Reconectar

**Passos**:
1. ✅ Com o aplicativo desktop aberto (modo offline)
2. ✅ Certifique-se de que o backend está rodando
3. ✅ Conecte à internet (se desconectou)
4. ✅ **Aguarde ~5-10 segundos**

**Resultado Esperado**:
- ✅ Indicador muda para: 🟡 **Sincronizando...** (amarelo, ícone girando)
- ✅ Após alguns segundos: 🟢 **Online** (verde, wifi)
- ✅ Texto: "Online - Última sync: Agora mesmo"
- ✅ **"0 pendente(s)"** (todos os itens foram sincronizados)

**Console deve mostrar**:
```
🟢 Conexão restaurada
🔄 Forçando sincronização...
🔄 Sincronização iniciada
✅ Sincronização concluída
```

#### 4.3. Verificar no Backend

**Opção 1 - Via API** (se tiver Postman/Insomnia):
```bash
GET http://localhost:3000/api/v1/products
GET http://localhost:3000/api/v1/customers

# Deve retornar os dados criados offline
```

**Opção 2 - Via PostgreSQL**:
```sql
-- Conectar ao banco PostgreSQL
SELECT * FROM products WHERE name LIKE '%Teste Offline%';
SELECT * FROM customers WHERE name LIKE '%Teste Offline%';
```

---

### Teste 5: Sincronização Manual

**Objetivo**: Forçar sincronização com botão

**Passos**:
1. ✅ Sistema online (🟢)
2. ✅ Crie mais um produto:
   ```
   Nome: Produto Sync Manual
   SKU: SYNC-001
   ```
3. ✅ Clique no **botão de refresh** (🔄) no indicador de status
4. ✅ Observe o indicador

**Resultado Esperado**:
- ✅ Indicador muda para: 🟡 **Sincronizando...**
- ✅ Após ~1-2 segundos: 🟢 **Online**
- ✅ Texto: "Última sync: Agora mesmo"

---

### Teste 6: Perda de Conexão em Tempo Real

**Objetivo**: Detectar perda de conexão instantaneamente

**Passos**:
1. ✅ Sistema online (🟢)
2. ✅ **Pare o backend** (Ctrl+C no terminal do backend)
3. ✅ OU desconecte a internet
4. ✅ Aguarde ~5 segundos

**Resultado Esperado**:
- ✅ Indicador muda para: 🔴 **Offline**
- ✅ Console mostra: "🔴 Conexão perdida"

**Criar dados offline**:
1. ✅ Crie um novo cliente:
   ```
   Nome: Cliente Durante Queda
   Email: queda@teste.com
   ```
2. ✅ Observe o indicador: mostra **"1 pendente(s)"**

**Restaurar conexão**:
1. ✅ Reinicie o backend
2. ✅ Aguarde ~10 segundos
3. ✅ Indicador volta para: 🟢 **Online**
4. ✅ **"0 pendente(s)"**

---

### Teste 7: Multi-Usuário (2 PCs)

**Objetivo**: Verificar sincronização entre múltiplos PCs

**Pré-requisito**: Backend rodando

#### PC 1:
```bash
cd c:\BarManagerPro\apps\desktop
pnpm dev
```

1. ✅ Login: `user1@bar.com`
2. ✅ Criar produto: "Produto PC1"
3. ✅ Aguardar sincronização (🟢 Online)

#### PC 2 (outro computador na rede):
```bash
cd c:\BarManagerPro\apps\desktop
pnpm dev
```

1. ✅ Login: `user2@bar.com` (ou mesmo usuário)
2. ✅ Ir para **Produtos**
3. ✅ **Atualizar lista** (F5 ou recarregar)

**Resultado Esperado**:
- ✅ PC2 vê "Produto PC1" na lista
- ✅ Ambos sincronizam via backend
- ✅ Ambos mostram: 🟢 **Online**

#### Criar em ambos simultaneamente:

**PC 1**: Criar "Produto A"
**PC 2**: Criar "Produto B"

Após ~30 segundos (ciclo de sync):
- ✅ PC1 vê "Produto B"
- ✅ PC2 vê "Produto A"

---

### Teste 8: Último Login Persistido

**Objetivo**: Verificar que last_login é atualizado

**Passos**:
1. ✅ Fazer logout
2. ✅ Fazer login novamente
3. ✅ Ir para **Usuários**
4. ✅ Ver detalhes do usuário logado

**Resultado Esperado**:
- ✅ Campo "Último Login" mostra data/hora atual

**Verificar no SQLite**:
```sql
SELECT username, email, last_login 
FROM users 
WHERE email = 'itchuda@gmail.com';
```

---

### Teste 9: Erros e Recuperação

**Objetivo**: Sistema lida graciosamente com erros

#### Cenário A: Backend com erro 500

**Passos**:
1. ✅ Modificar backend para retornar erro 500
2. ✅ No desktop, criar um produto
3. ✅ Aguardar sincronização

**Resultado Esperado**:
- ✅ Indicador mostra: 🟠 **Erro na Sincronização**
- ✅ Item permanece na fila (não é descartado)
- ✅ Após 30s, tenta novamente

#### Cenário B: Token Expirado (401)

**Passos**:
1. ✅ Backend retorna 401
2. ✅ Tentar sincronizar

**Resultado Esperado**:
- ✅ Sincronização para imediatamente
- ✅ Usuário deve fazer login novamente

---

### Teste 10: Performance com Muitos Itens

**Objetivo**: Sistema lida bem com fila grande

**Passos**:
1. ✅ Modo offline
2. ✅ Criar 50 produtos rapidamente
3. ✅ Reconectar
4. ✅ Aguardar sincronização

**Resultado Esperado**:
- ✅ Indicador mostra: **"50 pendente(s)"**
- ✅ Sincronização leva ~5-10 segundos
- ✅ Todos os 50 produtos sincronizados
- ✅ **"0 pendente(s)"** ao final

---

## 🐛 Troubleshooting

### Problema: Indicador sempre offline

**Verificar**:
```bash
# 1. Backend está rodando?
curl http://localhost:3000/api/v1/health

# 2. URL do backend está correta?
# No código: apps/desktop/electron/main.ts
# Deve ser: http://localhost:3000/api/v1
```

### Problema: Itens não sincronizam

**Verificar fila**:
```sql
-- Abrir SQLite: %APPDATA%/barmanager-pro/barmanager.db
SELECT * FROM sync_queue WHERE status = 'failed';

-- Ver erros
SELECT error_message FROM sync_queue WHERE status = 'failed';
```

### Problema: Erro ao iniciar aplicativo

**Limpar cache**:
```bash
# Deletar banco de dados e recomeçar
rm %APPDATA%/barmanager-pro/barmanager.db

# Reinstalar dependências
cd apps/desktop
rm -rf node_modules
pnpm install
```

---

## 📊 Checklist de Validação Final

Marque cada item após testar:

- [ ] ✅ Login offline funciona
- [ ] ✅ Criar produto offline
- [ ] ✅ Criar cliente offline
- [ ] ✅ Indicador mostra offline (🔴)
- [ ] ✅ Indicador mostra itens pendentes
- [ ] ✅ Reconexão detectada automaticamente
- [ ] ✅ Sincronização automática funciona
- [ ] ✅ Indicador mostra online (🟢)
- [ ] ✅ Itens pendentes zerados após sync
- [ ] ✅ Botão de sync manual funciona
- [ ] ✅ Perda de conexão detectada
- [ ] ✅ Multi-usuário funciona (2 PCs)
- [ ] ✅ Dados persistem após reiniciar
- [ ] ✅ Last login atualizado
- [ ] ✅ Erros tratados graciosamente

---

## 🎉 Conclusão dos Testes

Se todos os testes passaram:
- ✅ Sistema está **100% funcional**
- ✅ Pronto para **produção**
- ✅ Pode ser usado em **ambiente real**

Próximos passos:
1. Deploy do backend em servidor
2. Configurar URL do backend em produção
3. Gerar build do Electron para distribuição
4. Treinar usuários

---

**Boa sorte com os testes! 🚀**

Se encontrar algum problema, consulte:
- `docs/SYNC_SYSTEM.md` - Documentação completa
- `ONLINE_OFFLINE_SUMMARY.md` - Resumo executivo
- Console do Electron - Logs detalhados
