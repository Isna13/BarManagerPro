# Guia de Importação de Dados SQLite → Railway PostgreSQL

## ✅ Status Atual

- **Dados Exportados**: 226 registros do SQLite desktop
  - 1 filial
  - 111 categorias
  - 6 produtos (Cristal mini, Preta 33cl, Sagres, Super Bock mini, XL, +1)
  - 3 clientes (Castro Tanha, William Brandão, Zolas Brandão)
  - 5 itens de estoque
  - 36 vendas (170,000 FCFA total)
  - 59 itens de venda
  - 3 caixas
  - 3 dívidas (8,800 FCFA total)

- **Script Criado**: `apps/backend/scripts/import-sqlite-data.js`
- **Dados Prontos**: `apps/backend/prisma/sqlite-data.json`
- **Código no GitHub**: ✅ Push concluído

## 🚀 Como Importar os Dados

### Opção 1: Via Railway CLI (Recomendado)

1. **Instalar Railway CLI** (se ainda não tiver):
   ```powershell
   npm install -g railway
   ```

2. **Fazer login**:
   ```powershell
   railway login
   ```

3. **Conectar ao projeto** (execute na pasta do projeto):
   ```powershell
   cd C:\BarManagerPro\apps\backend
   railway link
   ```
   - Selecione o projeto "barmanagerbackend-production"

4. **Executar a importação**:
   ```powershell
   railway run pnpm import:sqlite
   ```

### Opção 2: Via Railway Dashboard

1. Acesse: https://railway.app/
2. Entre no projeto "barmanagerbackend-production"
3. Vá em "Settings" → "Service"
4. Na aba "Deploy", clique em "Manual Deploy"
5. Após o deploy, vá em "Variables" e adicione uma "One-off Command":
   ```
   pnpm import:sqlite
   ```

### Opção 3: Via API (Quando o endpoint estiver funcionando)

Execute localmente:
```powershell
cd C:\BarManagerPro\apps\backend
npx tsx prisma/import-via-api.ts
```

## ✅ Verificação após Importação

Execute estes comandos para verificar se os dados foram importados:

```powershell
# Login
$token = (Invoke-RestMethod -Uri "https://barmanagerbackend-production.up.railway.app/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@barmanager.com","password":"Admin@123456"}').accessToken
$headers = @{ Authorization = "Bearer $token" }

# Verificar categorias (deve retornar 111)
(Invoke-RestMethod -Uri "https://barmanagerbackend-production.up.railway.app/api/v1/categories" -Headers $headers).length

# Verificar produtos (deve retornar 6)
(Invoke-RestMethod -Uri "https://barmanagerbackend-production.up.railway.app/api/v1/products" -Headers $headers).length

# Verificar vendas (deve retornar 36)
(Invoke-RestMethod -Uri "https://barmanagerbackend-production.up.railway.app/api/v1/sales" -Headers $headers).length

# Verificar clientes (deve retornar 3)
(Invoke-RestMethod -Uri "https://barmanagerbackend-production.up.railway.app/api/v1/customers" -Headers $headers).length
```

## 🎯 Resultado Esperado

Após a importação bem-sucedida, você verá:

```
📂 Lendo dados exportados...
✅ Dados carregados: {
  branches: 1,
  categories: 111,
  products: 6,
  customers: 3,
  inventory: 5,
  sales: 36,
  saleItems: 59,
  cashBoxes: 3,
  debts: 3
}

🚀 Iniciando importação...

🏢 Importando filiais...
   ✅ 1 filiais importadas
📁 Importando categorias...
   ✅ 111 categorias importadas
📦 Importando produtos...
   ✅ 6 produtos importados
👥 Importando clientes...
   ✅ 3 clientes importados
📊 Importando estoque...
   ✅ 5 itens de estoque importados
🛒 Importando vendas...
   ✅ 36 vendas importadas
📝 Importando itens de venda...
   ✅ 59 itens de venda importados
💰 Importando caixas...
   ✅ 3 caixas importadas
💳 Importando dívidas...
   ✅ 3 dívidas importadas

✅ Importação concluída com sucesso!
```

## 📱 Testar no App Mobile

Após a importação:

1. Abra o app no Samsung A24
2. Faça logout
3. Faça login novamente
4. Verifique:
   - Dashboard mostra 36 vendas
   - Produtos lista 6 itens
   - Clientes mostra 3 registros
   - Estoque mostra 5 itens

## ⚠️ Problemas Conhecidos

### Erro: "Can't reach database server"
- **Causa**: Tentando conectar ao Railway de fora da infraestrutura
- **Solução**: Use Railway CLI (Opção 1)

### Erro: "404 POST /api/v1/import/sqlite-data"
- **Causa**: Deploy não incluiu o módulo de importação
- **Solução**: Use o script direto via Railway CLI

### Erro: "Unique constraint failed on id"
- **Causa**: Dados já foram importados parcialmente
- **Solução**: O script usa `upsert`, então pode ser executado múltiplas vezes sem problema

## 📞 Suporte

Se encontrar algum erro durante a importação, envie:
1. A mensagem de erro completa
2. A saída do comando `railway logs`
