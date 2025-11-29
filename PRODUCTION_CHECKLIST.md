# ✅ Checklist de Preparação para Produção

Este documento lista todas as verificações necessárias antes de fazer deploy em produção.

---

## 🔍 Verificações Locais (Antes do Deploy)

### 1. Backend - Funcionalidades ✅

- [ ] **Servidor inicia sem erros**
  ```powershell
  cd apps/backend
  pnpm dev
  ```
  - Deve exibir logs estruturados com seções detalhadas
  - Deve mostrar "🚀 BarManager Pro API - INICIADO COM SUCESSO!"

- [ ] **Health checks funcionando**
  ```powershell
  curl http://127.0.0.1:3000/api/v1/health
  curl http://127.0.0.1:3000/api/v1/health/ping
  ```
  - Status: "ok"
  - Database: "connected"

- [ ] **Rate limiting ativo**
  - Executar: `./apps/backend/test-production-features.ps1`
  - Deve bloquear após ~100 requisições em 1 minuto

- [ ] **Logging HTTP funcionando**
  - Verificar console do backend
  - Cada requisição deve gerar log: `[método] rota - status (tempo)`

- [ ] **Graceful shutdown**
  ```powershell
  # Iniciar backend
  cd apps/backend && pnpm dev
  
  # Parar com Ctrl+C
  # Deve exibir: "🔌 Conexão com banco de dados fechada"
  ```

- [ ] **Autenticação JWT**
  ```powershell
  # Testar login
  curl -X POST http://127.0.0.1:3000/api/v1/auth/login `
    -H "Content-Type: application/json" `
    -d '{"email":"admin@barmanager.com","password":"admin123"}'
  ```
  - Deve retornar accessToken

### 2. Banco de Dados ✅

- [ ] **Migrations executadas**
  ```powershell
  cd apps/backend
  pnpm prisma:migrate:dev
  ```

- [ ] **Seed executado**
  ```powershell
  pnpm prisma:seed
  ```
  - Deve criar usuário admin padrão
  - Deve criar roles e permissions

- [ ] **Conexão PostgreSQL funcionando**
  - Verificar `DATABASE_URL` no `.env`
  - Backend deve conectar automaticamente ao iniciar

### 3. Desktop App ✅

- [ ] **App inicia sem erros**
  ```powershell
  cd apps/desktop
  pnpm dev
  ```

- [ ] **Indicador online/offline visível**
  - Deve mostrar círculo verde quando online
  - Deve mostrar círculo vermelho quando offline

- [ ] **Sincronização automática**
  - Desconectar internet → alerta vermelho aparece
  - Reconectar internet → alerta verde aparece
  - Console deve mostrar logs de reconexão

- [ ] **Login funciona offline**
  - Desconectar internet
  - Fazer login com credenciais válidas
  - Deve entrar em modo offline (token: "offline-token")

- [ ] **Login funciona online**
  - Conectar internet
  - Fazer login
  - Deve obter JWT real do backend

---

## ☁️ Preparação para Cloud Deploy

### 4. Variáveis de Ambiente 🔑

- [ ] **JWT_SECRET gerado**
  ```powershell
  # Windows PowerShell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  ```
  - Copiar resultado
  - Salvar em gerenciador de senhas

- [ ] **DATABASE_URL preparada**
  - Railway/Heroku fornecem automaticamente
  - Não precisa gerar manualmente

- [ ] **Variáveis obrigatórias documentadas**
  - `NODE_ENV=production`
  - `JWT_SECRET=<seu-secret-forte>`
  - `JWT_EXPIRES_IN=7d`
  - `CORS_ORIGIN=*` (inicialmente, depois restringir)
  - `RATE_LIMIT_MAX_REQUESTS=100`

### 5. Código Pronto para Produção ✅

- [ ] **Dockerfile presente**
  - `Dockerfile` na raiz do projeto
  - Multi-stage build configurado

- [ ] **railway.json presente**
  - Configurado para usar Dockerfile

- [ ] **.dockerignore presente**
  - node_modules excluído
  - .env excluído

- [ ] **package.json com scripts corretos**
  ```json
  {
    "scripts": {
      "build": "nest build",
      "start:prod": "node dist/main"
    }
  }
  ```

### 6. Segurança 🔒

- [ ] **CORS configurado**
  - Desenvolvimento: `*` (permitir tudo)
  - Produção: listar domínios específicos

- [ ] **Helmet ativo**
  - Headers de segurança configurados
  - CSP em modo production

- [ ] **Rate limiting configurado**
  - 100 req/min (ajustar conforme necessidade)

- [ ] **Senhas fortes**
  - JWT_SECRET: 32+ caracteres
  - Database password: forte e aleatória

- [ ] **Endpoints protegidos**
  - Rotas críticas com `@UseGuards(JwtAuthGuard)`
  - Health checks públicos (sem auth)

### 7. Monitoramento 📊

- [ ] **Logs estruturados**
  - LoggerMiddleware aplicado em todas rotas
  - Logs incluem: método, URL, status, tempo

- [ ] **Health checks configurados**
  - `/api/v1/health` - status completo
  - `/api/v1/health/ping` - lightweight

- [ ] **Startup logs detalhados**
  - Mostra ambiente (dev/production)
  - Lista IPs de acesso
  - Exibe configuração CORS
  - Mostra endpoints disponíveis

---

## 🚀 Deploy no Railway

### 8. Criar Conta e Projeto

- [ ] **Conta Railway criada**
  - Acesso: https://railway.app
  - Login com GitHub

- [ ] **Projeto criado**
  - "New Project" → "Deploy from GitHub repo"
  - Repositório selecionado

- [ ] **PostgreSQL adicionado**
  - "+ New" → "Database" → "PostgreSQL"
  - DATABASE_URL gerada automaticamente

### 9. Configurar Variáveis

- [ ] **Variáveis adicionadas no Railway**
  - Ir em "Variables"
  - Adicionar cada variável:
    - `NODE_ENV=production`
    - `JWT_SECRET=<gerado>`
    - `JWT_EXPIRES_IN=7d`
    - `CORS_ORIGIN=*`
    - `RATE_LIMIT_MAX_REQUESTS=100`

### 10. Build e Deploy

- [ ] **Build method: Dockerfile**
  - Railway deve detectar automaticamente
  - Verificar em "Settings" → "Build"

- [ ] **Deploy iniciado**
  - Fazer commit e push no GitHub
  - Railway inicia deploy automaticamente

- [ ] **Build bem-sucedido**
  - Verificar logs de build
  - Deve finalizar sem erros

- [ ] **Deploy bem-sucedido**
  - Verificar logs de deploy
  - Deve mostrar "Listening on port XXXX"

### 11. Obter URL do Serviço

- [ ] **Gerar domínio público**
  - Ir em "Settings" → "Networking"
  - Clicar em "Generate Domain"
  - Copiar URL: `https://barmanager-production.up.railway.app`

---

## ✅ Testes Pós-Deploy

### 12. Verificações Remotas

- [ ] **Health check remoto**
  ```powershell
  curl https://SEU-DOMINIO.up.railway.app/api/v1/health
  ```
  - Status: "ok"
  - Database: "connected"
  - Environment: "production"

- [ ] **Ping remoto**
  ```powershell
  curl https://SEU-DOMINIO.up.railway.app/api/v1/health/ping
  ```
  - Response: `{"message": "pong"}`

- [ ] **Criar usuário remoto**
  ```powershell
  curl -X POST https://SEU-DOMINIO.up.railway.app/api/v1/auth/register `
    -H "Content-Type: application/json" `
    -d '{"email":"test@example.com","password":"Test123!","fullName":"Test User","role":"cashier"}'
  ```

- [ ] **Login remoto**
  ```powershell
  curl -X POST https://SEU-DOMINIO.up.railway.app/api/v1/auth/login `
    -H "Content-Type: application/json" `
    -d '{"email":"admin@barmanager.com","password":"admin123"}'
  ```
  - Deve retornar accessToken

- [ ] **Rate limiting remoto**
  ```powershell
  # Fazer 101 requisições rápidas
  for ($i=1; $i -le 101; $i++) {
    curl https://SEU-DOMINIO.up.railway.app/api/v1/health/ping
  }
  ```
  - Deve bloquear após ~100

### 13. Logs e Monitoramento

- [ ] **Verificar logs no Railway**
  - Ir em "Deployments" → Deployment ativo
  - Verificar "Deploy Logs"
  - Deve mostrar startup logs detalhados

- [ ] **Métricas no Railway**
  - Verificar CPU usage
  - Verificar Memory usage
  - Verificar Request count

---

## 📱 Configurar Clientes

### 14. Desktop App

- [ ] **Atualizar URL da API**
  - Abrir Settings no app
  - Alterar API URL: `https://SEU-DOMINIO.up.railway.app/api/v1`
  - Salvar

- [ ] **Testar login**
  - Fazer logout
  - Fazer login novamente
  - Deve conectar ao backend na cloud

- [ ] **Testar sincronização**
  - Criar venda no desktop
  - Verificar se aparece no backend (Railway logs)

### 15. Mobile App (se aplicável)

- [ ] **Atualizar baseUrl**
  ```dart
  // lib/config/api_config.dart
  static const String baseUrl = 'https://SEU-DOMINIO.up.railway.app/api/v1';
  ```

- [ ] **Rebuild app**
  ```powershell
  cd apps/mobile
  flutter build apk --release
  ```

- [ ] **Testar login e sync**

---

## 🔒 Endurecimento de Segurança (Pós-Testes)

### 16. Produção Final

- [ ] **Restringir CORS**
  ```env
  # De:
  CORS_ORIGIN=*
  
  # Para:
  CORS_ORIGIN=https://app.barmanager.com,https://admin.barmanager.com
  ```

- [ ] **Ajustar rate limiting**
  - Se muitos usuários: aumentar para 500
  - Se poucos usuários: manter 100

- [ ] **Configurar backup do PostgreSQL**
  - Railway oferece backups automáticos
  - Verificar configuração

- [ ] **Configurar alertas**
  - Railway pode enviar notificações
  - Configurar para erros críticos

- [ ] **Revisar endpoints públicos**
  - Garantir que apenas `/health` seja público
  - Todas outras rotas devem exigir JWT

---

## 📝 Documentação Final

### 17. Documentar Deploy

- [ ] **Atualizar README.md**
  - Adicionar URL de produção
  - Documentar como conectar desktop/mobile

- [ ] **Criar arquivo PRODUCTION_URLS.md**
  ```markdown
  # URLs de Produção
  
  - Backend: https://barmanager-production.up.railway.app
  - API: https://barmanager-production.up.railway.app/api/v1
  - Health: https://barmanager-production.up.railway.app/api/v1/health
  ```

- [ ] **Compartilhar com equipe**
  - URL do backend
  - Credenciais de admin
  - Instruções de configuração

---

## ✅ Checklist Completo

Quando TODAS as caixas acima estiverem marcadas ✅, seu sistema estará:

- ✅ Funcionando localmente sem erros
- ✅ Com todas funcionalidades testadas
- ✅ Deployado na cloud com sucesso
- ✅ Acessível remotamente via WiFi/internet
- ✅ Seguro com rate limiting e autenticação
- ✅ Monitorado com logs e health checks
- ✅ Documentado e pronto para uso

---

**Última atualização:** 29 de novembro de 2025  
**Status:** ✅ Sistema pronto para produção
