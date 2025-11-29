# 🚀 Guia de Deploy em Produção - BarManager Pro Backend

## 📋 Pré-requisitos

- ✅ Conta Railway/Heroku/DigitalOcean ou similar
- ✅ PostgreSQL database (fornecido pela plataforma)
- ✅ Repositório Git configurado
- ✅ Variáveis de ambiente prontas

---

## 🔧 Configurações de Produção

### **1. Variáveis de Ambiente Obrigatórias**

```env
# Database (fornecido automaticamente pela Railway)
DATABASE_URL=postgresql://user:password@host:port/database

# JWT - CRÍTICO: Gerar chave forte
JWT_SECRET=sua-chave-super-secreta-minimo-32-caracteres-aleatoria
JWT_EXPIRES_IN=7d

# App
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# CORS - Domínios permitidos (separar com vírgula)
CORS_ORIGIN=https://seu-app.vercel.app,https://seu-dominio.com

# Rate Limiting - Proteção contra abuso
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (opcional - para cache e filas)
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=sua-senha-redis

# Backup (opcional)
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=sua-access-key
S3_SECRET_KEY=sua-secret-key
S3_BUCKET=barmanager-backups
S3_REGION=us-east-1
```

### **2. Gerar JWT Secret Seguro**

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🌐 Deploy no Railway (Recomendado)

### **Passo 1: Criar Projeto no Railway**

1. Acesse [railway.app](https://railway.app)
2. Faça login com GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha o repositório `BarManagerPro`

### **Passo 2: Adicionar PostgreSQL**

1. No projeto Railway, clique em "+ New"
2. Selecione "Database" → "PostgreSQL"
3. Railway criará automaticamente e configurará `DATABASE_URL`

### **Passo 3: Configurar Variáveis de Ambiente**

No painel do serviço backend:
1. Ir em "Variables"
2. Adicionar variáveis uma por uma:
   - `NODE_ENV=production`
   - `JWT_SECRET=<sua-chave-gerada>`
   - `JWT_EXPIRES_IN=7d`
   - `CORS_ORIGIN=*` (inicialmente, depois restringir)
   - `RATE_LIMIT_MAX_REQUESTS=100`

### **Passo 4: Configurar Build**

Railway detecta automaticamente o `Dockerfile` e `railway.json`.

**Verificar configuração:**
- Build Method: **Dockerfile**
- Dockerfile Path: `Dockerfile`
- Start Command: (automático)

### **Passo 5: Deploy Automático**

1. Fazer commit e push no GitHub:
   ```bash
   git add .
   git commit -m "feat: preparar backend para produção"
   git push origin main
   ```

2. Railway fará deploy automático
3. Aguardar build (3-5 minutos)
4. Verificar logs para confirmar sucesso

### **Passo 6: Obter URL do Serviço**

1. No Railway, ir em "Settings" → "Networking"
2. Clicar em "Generate Domain"
3. Copiar URL gerada: `https://barmanagerpro-production.up.railway.app`

---

## ✅ Checklist de Verificação Pós-Deploy

### **1. Health Check**
```bash
curl https://SEU-DOMINIO.up.railway.app/api/v1/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-29T...",
  "uptime": 123.45,
  "database": "connected",
  "environment": "production"
}
```

### **2. Teste de Registro**
```bash
curl -X POST https://SEU-DOMINIO.up.railway.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@barmanager.com",
    "password": "SenhaForte123!",
    "fullName": "Administrador",
    "role": "admin"
  }'
```

### **3. Teste de Login**
```bash
curl -X POST https://SEU-DOMINIO.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@barmanager.com",
    "password": "SenhaForte123!"
  }'
```

**Resposta esperada:**
```json
{
  "user": { ... },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **4. Teste de Rate Limiting**
```bash
# Fazer 101 requisições rápidas (deve bloquear após 100)
for i in {1..101}; do 
  curl https://SEU-DOMINIO.up.railway.app/api/v1/health/ping
done
```

---

## 🔐 Segurança em Produção

### **✅ Implementado**
- ✅ Helmet (headers de segurança)
- ✅ Rate Limiting (100 req/min por IP)
- ✅ CORS configurável
- ✅ JWT com expiração
- ✅ Senhas hasheadas (bcrypt)
- ✅ Validação de inputs (class-validator)
- ✅ Guards de autenticação em rotas protegidas
- ✅ Compression de respostas
- ✅ Logs estruturados
- ✅ Graceful shutdown

### **🔧 Configurações Recomendadas**

#### **CORS Restrito (Após Testes)**
```env
# Permitir apenas domínios específicos
CORS_ORIGIN=https://app.barmanager.com,https://admin.barmanager.com
```

#### **Rate Limiting Ajustado**
```env
# Para APIs públicas
RATE_LIMIT_MAX_REQUESTS=100

# Para APIs internas
RATE_LIMIT_MAX_REQUESTS=500
```

#### **JWT Expiração**
```env
# Desenvolvimento: 7 dias
JWT_EXPIRES_IN=7d

# Produção conservadora: 1 dia
JWT_EXPIRES_IN=1d
```

---

## 📊 Monitoramento

### **Logs no Railway**

1. Ir em "Deployments" → Selecionar deployment ativo
2. Ver "Build Logs" e "Deploy Logs"
3. Logs em tempo real aparecem automaticamente

**Logs importantes:**
```
✅ Conexão com banco de dados estabelecida
🚀 BarManager Pro API - INICIADO COM SUCESSO!
📊 Ambiente: production
🔐 JWT Expira: 7d
```

### **Métricas**

Railway fornece automaticamente:
- CPU usage
- Memory usage
- Network I/O
- Request count

---

## 🔄 Atualizações e CI/CD

### **Deploy Automático**

Railway detecta automaticamente commits no branch `main`:

```bash
# Fazer mudanças
git add .
git commit -m "feat: adicionar nova funcionalidade"
git push origin main

# Railway fará deploy automaticamente
```

### **Rollback**

No Railway:
1. Ir em "Deployments"
2. Selecionar deployment anterior
3. Clicar em "Redeploy"

---

## 🐛 Troubleshooting

### **❌ Erro: "Database connection failed"**

**Causa:** DATABASE_URL inválida ou banco não disponível

**Solução:**
1. Verificar variável `DATABASE_URL` no Railway
2. Verificar se PostgreSQL está ativo
3. Testar conexão manualmente

### **❌ Erro: "JWT secret not configured"**

**Causa:** JWT_SECRET não definido

**Solução:**
```bash
# Gerar novo secret
openssl rand -base64 32

# Adicionar em Railway Variables
JWT_SECRET=<secret-gerado>
```

### **❌ Erro: "CORS policy blocked"**

**Causa:** Domínio não permitido em CORS_ORIGIN

**Solução:**
```env
# Adicionar domínio à lista
CORS_ORIGIN=https://existente.com,https://novo-dominio.com
```

### **❌ Rate Limit Muito Restritivo**

**Solução:**
```env
# Aumentar limite
RATE_LIMIT_MAX_REQUESTS=500
RATE_LIMIT_WINDOW_MS=60000
```

---

## 📱 Configurar Aplicativos

### **Desktop**

1. Ir em Configurações do app
2. Atualizar URL da API:
   ```
   https://barmanagerpro-production.up.railway.app/api/v1
   ```
3. Fazer logout e login

### **Mobile**

Atualizar `lib/config/api_config.dart`:
```dart
class ApiConfig {
  static const String baseUrl = 'https://barmanagerpro-production.up.railway.app/api/v1';
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
```

---

## 🎯 Melhores Práticas

### **✅ FAZER**
- ✅ Usar HTTPS em produção
- ✅ Configurar CORS restrito
- ✅ Monitorar logs regularmente
- ✅ Fazer backups do banco
- ✅ Testar endpoints após deploy
- ✅ Usar variáveis de ambiente
- ✅ Manter JWT_SECRET seguro

### **❌ NÃO FAZER**
- ❌ Commitar credenciais no Git
- ❌ Usar CORS=* em produção (após testes)
- ❌ Ignorar erros nos logs
- ❌ Expor endpoints sem autenticação
- ❌ Usar senhas fracas
- ❌ Desabilitar rate limiting

---

## 📚 Recursos Adicionais

**Documentação:**
- [Railway Docs](https://docs.railway.app)
- [NestJS Deployment](https://docs.nestjs.com/faq/deployment)
- [Prisma Production](https://www.prisma.io/docs/guides/deployment)

**Suporte:**
- `NETWORK_SETUP.md` - Configuração de rede local
- `SYNC_TESTING_GUIDE.md` - Testes de sincronização
- `README.md` - Visão geral do projeto

---

**Última atualização:** 29 de novembro de 2025  
**Versão:** 1.0  
**Status:** ✅ Backend pronto para produção
