# 🚀 Deploy BarManager Backend no Railway

## ✅ Pré-requisitos
- Conta no Railway (https://railway.app) - **GRÁTIS com GitHub**
- Git instalado

## 📋 Passo 1: Criar Projeto no Railway

1. **Acesse**: https://railway.app
2. **Login com GitHub** (ou criar conta)
3. **New Project** → **Deploy from GitHub repo**
4. **Selecione o repositório** `BarManagerPro` (ou faça fork primeiro)

## 📋 Passo 2: Adicionar PostgreSQL

1. No seu projeto Railway, clique em **"+ New"**
2. Selecione **"Database" → "PostgreSQL"**
3. Railway vai criar automaticamente:
   - ✅ Banco PostgreSQL
   - ✅ Variável `DATABASE_URL` (automática)

## 📋 Passo 3: Configurar Backend

### 3.1 - Configurar Root Directory
1. No serviço do backend, vá em **Settings**
2. Em **"Root Directory"**, configure:
   ```
   apps/backend
   ```

### 3.2 - Configurar Build Command
1. Em **"Build Command"**, configure:
   ```bash
   npm install && npx prisma generate && npm run build
   ```

### 3.3 - Configurar Start Command
1. Em **"Start Command"**, configure:
   ```bash
   npx prisma db push --accept-data-loss && npm run start:prod
   ```

### 3.4 - Configurar Variáveis de Ambiente
No Railway, vá em **Variables** e adicione:

```env
# Database (automático, já injetado pelo Railway)
# DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (opcional, pode omitir por enquanto)
REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=seu-super-secret-jwt-key-mude-em-producao-railway-2025
JWT_EXPIRES_IN=7d

# App
NODE_ENV=production
PORT=3000

# CORS (permitir mobile app)
CORS_ORIGIN=*
```

## 📋 Passo 4: Deploy

1. **Salve as configurações**
2. Railway vai fazer o **deploy automaticamente**
3. Aguarde ~3-5 minutos para compilar
4. ✅ Você verá: **"Deployment Successful"**

## 📋 Passo 5: Obter URL do Backend

1. No Railway, vá em **Settings → Networking**
2. Clique em **"Generate Domain"**
3. Você receberá uma URL tipo:
   ```
   https://barmanager-backend-production.up.railway.app
   ```
4. **Copie essa URL!**

## 📋 Passo 6: Testar o Backend

Abra o navegador ou use curl:
```bash
curl https://sua-url-railway.up.railway.app/api/v1/reports/dashboard
```

**Resposta esperada:**
```json
{
  "todaySales": 0,
  "todayProfit": 0,
  "todaySalesCount": 0,
  "weekRevenue": 0,
  "monthRevenue": 0,
  ...
}
```

## 📋 Passo 7: Configurar Mobile App

1. Abra: `apps/mobile/lib/config/api_config.dart`

2. Atualize a URL:
```dart
class ApiConfig {
  static String get baseUrl {
    if (Platform.isAndroid) {
      // Substitua pela sua URL do Railway
      return 'https://sua-url-railway.up.railway.app/api/v1';
    } else if (Platform.isIOS) {
      return 'https://sua-url-railway.up.railway.app/api/v1';
    }
    return 'https://sua-url-railway.up.railway.app/api/v1';
  }
  
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
```

3. **Recompile o app mobile:**
```bash
cd apps/mobile
flutter build apk
flutter install
```

## 📋 Passo 8: Criar Usuário de Teste

Use o endpoint de registro:
```bash
curl -X POST https://sua-url-railway.up.railway.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "isnatchuda1@gmail.com",
    "password": "sua-senha-segura",
    "fullName": "Isna Tchuda",
    "roleId": "admin"
  }'
```

## ✅ Pronto!

Agora você tem:
- ✅ Backend rodando na nuvem (Railway)
- ✅ PostgreSQL grátis
- ✅ URL pública acessível de qualquer lugar
- ✅ Mobile app conectando ao backend real
- ✅ Deploy automático a cada push no GitHub

## 🔧 Comandos Úteis

**Ver logs do Railway:**
```bash
railway logs
```

**Fazer redeploy:**
- Apenas faça `git push` no GitHub
- Railway detecta e faz deploy automaticamente

**Ver variáveis de ambiente:**
```bash
railway variables
```

## 📊 Monitoramento

No Railway você pode ver:
- 📈 Uso de CPU/RAM
- 📊 Tráfego de rede
- 📝 Logs em tempo real
- ⚡ Status de saúde do serviço

## 💰 Plano Gratuito Railway

- **$5.00 de crédito grátis/mês**
- ~500 horas de execução
- PostgreSQL incluído
- SSL automático
- Domínio grátis (.up.railway.app)

## 🚨 Troubleshooting

### Erro: "Failed to build"
- Verifique se `Root Directory` está em `apps/backend`
- Confirme que `package.json` está correto

### Erro: "Database connection failed"
- Railway injeta `DATABASE_URL` automaticamente
- Não precisa configurar manualmente

### Erro: "Port already in use"
- Railway usa `PORT` variável de ambiente
- Certifique-se que `main.ts` usa `process.env.PORT || 3000`

### Mobile não conecta
- Verifique se gerou o domínio Railway
- Confirme que URL no `api_config.dart` está correta (com `https://`)
- Teste a URL no navegador primeiro

---

**Dúvidas?** Consulte: https://docs.railway.app
