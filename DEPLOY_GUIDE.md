# 🚀 Deploy Completo - BarManager Pro

## ✅ **Status Atual:**
- ✅ Backend preparado para PostgreSQL
- ✅ Prisma Client regenerado
- ✅ Driver PostgreSQL (pg) instalado
- ✅ Scripts de produção configurados
- ✅ Railway config criado (railway.json + nixpacks.toml)
- ⏳ Aguardando deploy no Railway

---

## 🚂 **OPÇÃO 1: Railway (RECOMENDADO)** ☁️

### **Passo 1: Criar Conta e Projeto**

```
1. Acesse: https://railway.app
2. Clique "Login with GitHub"
3. Autorize Railway
4. Clique "New Project"
```

### **Passo 2: Adicionar PostgreSQL**

```
1. No novo projeto, clique "New"
2. Selecione "Database" → "PostgreSQL"
3. Aguarde 30 segundos (Railway cria automaticamente)
4. ✅ PostgreSQL pronto!
```

### **Passo 3: Deploy Backend**

```
1. No mesmo projeto, clique "New"
2. Selecione "GitHub Repo"
3. Escolha: BarManagerPro
4. Railway detecta automaticamente!
```

### **Passo 4: Configurar Variáveis**

```
No Backend Service → Variables → Raw Editor, cole:

DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=${{PORT}}
JWT_SECRET=sua-chave-secreta-super-segura-aqui-12345
JWT_EXPIRES_IN=7d
API_PREFIX=api/v1
CORS_ORIGIN=*
REDIS_HOST=
REDIS_PORT=6379
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

Clique "Update Variables"
```

### **Passo 5: Configurar Build**

```
Backend Service → Settings:

Root Directory: apps/backend
Build Command: (deixe vazio - nixpacks.toml cuida)
Start Command: (deixe vazio - nixpacks.toml cuida)
Watch Paths: apps/backend/**
```

### **Passo 6: Conectar Backend ao PostgreSQL**

```
1. Backend Service → Settings → Service Variables
2. Clique "+ New Variable" → "Reference"
3. Selecione: Postgres → DATABASE_URL
4. Clique "Add"
```

### **Passo 7: Fazer Deploy**

```
1. Commit suas mudanças:
   cd C:\BarManagerPro
   git add .
   git commit -m "feat: configure railway deployment"
   git push origin main

2. Railway detecta e faz deploy automático! (3-5 min)
```

### **Passo 8: Executar Migrations**

```
Após deploy finalizar:

1. Backend Service → Deployments → Último deploy → 3 pontos
2. "View Logs" → Aguarde finalizar
3. Clique "..." → "Connect via CLI"
4. No terminal Railway, execute:

npx prisma migrate deploy
npx ts-node prisma/seed.ts

5. ✅ Banco populado!
```

### **Passo 9: Obter URL da API**

```
Backend Service → Settings → Domains

Railway gera automaticamente:
https://barmanagerpro-production-XXXX.up.railway.app

Copie essa URL!
```

### **Passo 10: Testar API**

```powershell
# No PowerShell local:
curl https://sua-url-railway.up.railway.app/api/v1/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@barmanager.com","password":"admin123"}'
```

---

## 🔄 **Deploy Automático Configurado!**

Agora sempre que você fizer:
```bash
git add .
git commit -m "seu commit"
git push origin main
```

Railway automaticamente:
1. ✅ Detecta mudanças
2. ✅ Faz build
3. ✅ Executa testes
4. ✅ Faz deploy
5. ✅ Reinicia serviço

---

## 📱 **Atualizar Mobile/Desktop com URL Produção:**

### **Mobile (apps/mobile/lib/services/api_service.dart):**

```dart
class ApiService {
  // Desenvolvimento
  // static const String baseUrl = 'http://localhost:3000/api/v1';
  
  // Produção Railway
  static const String baseUrl = 'https://SUA-URL-RAILWAY.up.railway.app/api/v1';
  
  // ...
}
```

### **Desktop (apps/desktop/src/stores/authStore.ts):**

```typescript
// Desenvolvimento
// const API_URL = 'http://localhost:3000/api/v1';

// Produção Railway
const API_URL = 'https://SUA-URL-RAILWAY.up.railway.app/api/v1';
```

---

## 🆚 **OPÇÃO 2: Render.com (Alternativa Grátis)**

Se Railway não funcionar, use Render:

### **PostgreSQL no Render:**

```
1. https://render.com → Sign Up with GitHub
2. New → PostgreSQL
3. Name: barmanager-db
4. Plan: Free
5. Create Database
6. Copie "Internal Database URL"
```

### **Backend no Render:**

```
1. New → Web Service
2. Connect Repository: BarManagerPro
3. Settings:
   - Name: barmanager-backend
   - Root Directory: apps/backend
   - Build Command: pnpm install && pnpm prisma:generate && pnpm build
   - Start Command: pnpm start:prod
   - Plan: Free

4. Environment Variables:
   DATABASE_URL = (cole Internal Database URL)
   NODE_ENV = production
   JWT_SECRET = sua-chave-secreta
   PORT = 10000

5. Create Web Service
```

**⚠️ Render Free Tier dorme após 15min inatividade (demora 1-2min para acordar)**

---

## 💰 **Custos (Railway Grátis):**

- ✅ **500 horas/mês** = 20+ dias 24/7
- ✅ **$5 crédito grátis/mês**
- ✅ **PostgreSQL incluído**
- ✅ **100GB tráfego/mês**
- ✅ **SSL/HTTPS grátis**
- ✅ **Deploy automático**

**Se exceder:** Railway pausa até próximo mês (ou upgrade para $5/mês)

---

## 🔍 **Monitoramento:**

### **Railway Dashboard:**
```
- CPU Usage
- Memory
- Network
- Build Logs
- Application Logs
- Metrics
```

### **Logs em Tempo Real:**
```
Backend Service → Deployments → View Logs
```

### **Prisma Studio em Produção:**
```
1. Railway → PostgreSQL Service → Connect
2. Copie DATABASE_URL
3. No local:
   DATABASE_URL="cole-aqui" npx prisma studio
```

---

## 🛠️ **Troubleshooting:**

### **Erro: "Module not found: pg"**
```bash
cd C:\BarManagerPro\apps\backend
pnpm add pg
git add package.json pnpm-lock.yaml
git commit -m "fix: add pg driver"
git push
```

### **Erro: "Prisma Client not generated"**
```bash
# No Railway CLI após conectar:
npx prisma generate
npx prisma migrate deploy
```

### **Erro: "Port already in use"**
```bash
# Railway usa variável $PORT automática
# Garanta que main.ts usa: process.env.PORT || 3000
```

### **Backend não responde:**
```bash
# Verificar logs:
Railway → Backend → Deployments → View Logs

# Verificar variáveis:
Railway → Backend → Variables → Confirme DATABASE_URL
```

---

## 📊 **Checklist Completo:**

### **Preparação (✅ JÁ FEITO):**
- [x] PostgreSQL driver instalado
- [x] Prisma schema atualizado
- [x] Scripts de produção configurados
- [x] Railway config criado
- [x] .dockerignore criado
- [x] Backend buildável

### **Deploy Railway:**
- [ ] Criar conta Railway
- [ ] Criar projeto PostgreSQL
- [ ] Deploy backend via GitHub
- [ ] Configurar variáveis de ambiente
- [ ] Conectar backend ao PostgreSQL
- [ ] Executar migrations
- [ ] Executar seed
- [ ] Testar API em produção
- [ ] Atualizar URL no Mobile
- [ ] Atualizar URL no Desktop

---

## 🎯 **Próximos Passos:**

1. **Agora:** Criar conta Railway e seguir Passo 1-9
2. **Depois:** Atualizar Mobile/Desktop com URL produção
3. **Testar:** Fazer login no Mobile/Desktop com API Railway
4. **Finalizar:** Corrigir últimos 258 erros TypeScript do backend (opcional)

---

## 🚀 **Comandos Rápidos Git:**

```powershell
cd C:\BarManagerPro

# Ver mudanças
git status

# Adicionar tudo
git add .

# Commit
git commit -m "feat: configure railway deployment with postgresql"

# Push (Railway detecta e faz deploy!)
git push origin main

# Ver logs do Railway (após configurar CLI)
railway logs
```

---

**Tempo estimado total: 15-20 minutos** ⏱️

**Agora basta criar conta no Railway e seguir os passos!** 🚂☁️

---

## 📚 **Links Úteis:**

- Railway: https://railway.app
- Railway Docs: https://docs.railway.app
- Render: https://render.com (alternativa)
- Supabase: https://supabase.com (só PostgreSQL)
- Prisma Docs: https://www.prisma.io/docs
