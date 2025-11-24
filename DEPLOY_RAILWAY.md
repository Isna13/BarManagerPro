# 🚂 Deploy no Railway - BarManager Pro

## ⚡ **Por que Railway?**
- ✅ **Grátis** (500 horas/mês)
- ✅ **PostgreSQL incluído** (connection string automática)
- ✅ **Deploy automático** via GitHub
- ✅ **Zero configuração** de servidor
- ✅ **SSL/HTTPS** grátis

---

## 🚀 **Passo a Passo:**

### **1️⃣ Criar Conta Railway**
```
1. Acesse: https://railway.app
2. Clique "Login with GitHub"
3. Autorize Railway no seu GitHub
```

### **2️⃣ Deploy PostgreSQL**
```
1. New Project
2. Provision PostgreSQL
3. Aguarde 1 minuto
4. ✅ PostgreSQL criado automaticamente!
```

### **3️⃣ Deploy Backend**
```
1. No mesmo projeto, clique "+ New"
2. GitHub Repo
3. Selecione: BarManagerPro
4. Settings:
   - Root Directory: apps/backend
   - Build Command: pnpm install && pnpm prisma:generate && pnpm build
   - Start Command: pnpm start
   - Watch Paths: apps/backend/**
```

### **4️⃣ Configurar Variáveis de Ambiente**
```
No painel do Backend Service, vá em "Variables" e adicione:

DATABASE_URL = ${{Postgres.DATABASE_URL}}  (Railway injeta automático!)
NODE_ENV = production
PORT = ${{PORT}}  (Railway injeta automático!)
JWT_SECRET = <seu-jwt-secret-aqui>
CORS_ORIGIN = *

Clique "Add" para cada variável.
```

### **5️⃣ Conectar Backend ao PostgreSQL**
```
1. No Backend Service, clique "Settings"
2. "Service Variables"
3. "+ Reference" → Selecione "Postgres"
4. Isso injeta automaticamente DATABASE_URL no backend!
```

### **6️⃣ Executar Migrations**
```
1. No Backend Service, clique "Deployments"
2. Aguarde deploy finalizar
3. Clique nos 3 pontinhos → "View Logs"
4. Clique "Connect to Service" (SSH)
5. Execute:
   npx prisma migrate deploy
   npx ts-node prisma/seed.ts
```

---

## 🌍 **URLs Geradas:**

Após deploy bem-sucedido:
```
Backend API: https://barmanagerpro-production-XXXX.up.railway.app
PostgreSQL: internal.railway.app:5432 (privado)
```

---

## 📱 **Atualizar Mobile/Desktop:**

### **Mobile (lib/services/api_service.dart):**
```dart
class ApiService {
  static const String baseUrl = 'https://barmanagerpro-production-XXXX.up.railway.app/api/v1';
  // ...
}
```

### **Desktop (src/stores/authStore.ts):**
```typescript
const API_URL = 'https://barmanagerpro-production-XXXX.up.railway.app/api/v1';
```

---

## 🔍 **Testar Deploy:**

```powershell
# Testar API
curl https://barmanagerpro-production-XXXX.up.railway.app/api/v1/health

# Testar login
curl -X POST https://barmanagerpro-production-XXXX.up.railway.app/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@barmanager.com","password":"admin123"}'
```

---

## 🔄 **Deploy Automático:**

Após configurar:
```bash
git add .
git commit -m "feat: configure railway deploy"
git push origin main
```

Railway detecta automaticamente e faz deploy! 🚀

---

## 💰 **Custos (Plano Grátis):**

- ✅ 500 horas/mês (20+ dias rodando 24/7)
- ✅ PostgreSQL ilimitado (dentro do plano)
- ✅ 100GB tráfego/mês
- ✅ SSL/HTTPS grátis
- ✅ Custom domain (opcional)

Se exceder: Railway "dorme" e acorda ao receber request.

---

## 🛠️ **Alternativas:**

### **Render.com (Grátis):**
```
+ PostgreSQL grátis (90 dias)
+ Deploy automático
- "Dorme" após 15min inatividade
- Demora 1-2min para "acordar"
```

### **DigitalOcean (Pago):**
```
+ Controle total (VPS)
+ PostgreSQL gerenciado
- US$ 6/mês (droplet) + US$ 15/mês (DB)
- Requer mais configuração
```

---

## 🎯 **Status da Infraestrutura:**

- ✅ Backend NestJS pronto para produção
- ✅ PostgreSQL schema configurado
- ✅ Migrations prontas
- ✅ Seed data script
- ✅ CORS configurado
- ✅ JWT authentication
- ✅ Rate limiting
- ⏳ Aguardando Railway deploy

---

**Tempo estimado: 10-15 minutos** ⏱️

**Próximo passo:** Criar conta Railway e configurar projeto! 🚂☁️
