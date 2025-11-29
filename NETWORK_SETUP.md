# 🌐 Guia de Configuração de Rede - BarManager Pro

## 📋 Visão Geral

Este guia explica como configurar o backend do BarManager Pro para funcionar corretamente quando computadores desktop se conectam via Wi-Fi na mesma rede local.

---

## ✅ Verificações Implementadas

### 1. **Servidor Backend**
- ✅ Escuta em `0.0.0.0` (todas as interfaces de rede)
- ✅ CORS configurado para aceitar requisições de qualquer origem em desenvolvimento
- ✅ Health check disponível em `/api/v1/health`
- ✅ Detecção automática de IPs da rede local no startup
- ✅ Logs detalhados mostrando como acessar o servidor

### 2. **Autenticação**
- ✅ JWT com expiração de 7 dias (configurável)
- ✅ Sessões salvas no banco de dados
- ✅ Suporte para login offline no desktop
- ✅ Reautenticação automática quando backend volta online

### 3. **Sincronização**
- ✅ Verificação periódica de conexão (30 segundos)
- ✅ Reconexão automática quando rede é restaurada
- ✅ Fila de itens pendentes quando offline
- ✅ Logs detalhados de status de sincronização

---

## 🚀 Como Iniciar o Backend

### **1. Desenvolvimento Local**

```powershell
cd apps/backend
pnpm install
pnpm dev
```

**Saída esperada:**
```
🚀 BarManager Pro API iniciado com sucesso!

📡 Servidor acessível em:
   - Local:      http://127.0.0.1:3000/api/v1
   - Localhost:  http://localhost:3000/api/v1
   - Rede Local: http://192.168.1.100:3000/api/v1

✅ Health Check: http://127.0.0.1:3000/api/v1/health
📊 Ambiente: development
🌐 CORS: *

💡 Para conectar dispositivos na mesma rede Wi-Fi, use o IP da Rede Local
```

### **2. Produção (Local)**

```powershell
cd apps/backend
pnpm build
pnpm start:prod
```

---

## 🔧 Configuração de Rede

### **Cenário 1: Computadores na Mesma Rede Wi-Fi**

#### **Passo 1: Identificar IP do Servidor**

No computador onde o backend está rodando:

**Windows:**
```powershell
ipconfig
```
Procure por "Endereço IPv4" na seção do adaptador Wi-Fi (ex: `192.168.1.100`)

**Linux/Mac:**
```bash
ifconfig
# ou
ip addr show
```

#### **Passo 2: Verificar Firewall**

**Windows:**
1. Abrir "Firewall do Windows Defender"
2. Permitir conexões na porta **3000** (ou porta configurada)
3. Ou desabilitar temporariamente para teste

**Comando rápido (PowerShell como Admin):**
```powershell
New-NetFirewallRule -DisplayName "BarManager Backend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

#### **Passo 3: Configurar Desktop**

No aplicativo desktop, ir em **Configurações** e atualizar URL da API:

```
De:  http://127.0.0.1:3000/api/v1
Para: http://192.168.1.100:3000/api/v1
```
*(Substituir `192.168.1.100` pelo IP real do servidor)*

#### **Passo 4: Testar Conexão**

No navegador de qualquer computador na rede:
```
http://192.168.1.100:3000/api/v1/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-29T...",
  "uptime": 1234.56,
  "database": "connected",
  "environment": "development"
}
```

---

### **Cenário 2: Servidor em Cloud (Railway/Heroku)**

Quando o backend está na nuvem:

1. **URL do backend**: `https://seu-app.up.railway.app/api/v1`
2. **Configurar no desktop**: Usar URL HTTPS completa
3. **Firewall**: Não necessário (já exposto publicamente)
4. **CORS**: Configurar domínios permitidos em produção

---

## 🧪 Testes de Conectividade

### **1. Health Check Básico**
```bash
curl http://IP_DO_SERVIDOR:3000/api/v1/health
```

### **2. Ping Rápido**
```bash
curl http://IP_DO_SERVIDOR:3000/api/v1/health/ping
```

### **3. Teste de Login**
```bash
curl -X POST http://IP_DO_SERVIDOR:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"senha123"}'
```

---

## 🐛 Problemas Comuns e Soluções

### ❌ "ECONNREFUSED ::1:3000"

**Causa:** Desktop tentando IPv6 ao invés de IPv4

**Solução:**
1. Ir em Configurações do desktop
2. Trocar `http://localhost:3000` por `http://127.0.0.1:3000`
3. Ou usar IP da rede: `http://192.168.1.100:3000`

---

### ❌ "Network Error" ao conectar via Wi-Fi

**Causas possíveis:**
1. Firewall bloqueando porta 3000
2. IP do servidor mudou
3. Servidor backend não está rodando

**Diagnóstico:**
```powershell
# Verificar se backend está rodando
netstat -an | findstr :3000

# Testar conectividade
ping 192.168.1.100

# Testar porta específica
Test-NetConnection -ComputerName 192.168.1.100 -Port 3000
```

**Soluções:**
1. Verificar logs do backend
2. Confirmar IP atual do servidor
3. Abrir porta no firewall
4. Reiniciar backend

---

### ❌ "CORS policy" no navegador

**Causa:** Backend não está permitindo origem da requisição

**Solução (Desenvolvimento):**
```env
# .env
CORS_ORIGIN=*
```

**Solução (Produção):**
```env
# .env
CORS_ORIGIN=http://192.168.1.100:5173,http://192.168.1.101:5173
```

---

### ❌ Backend mostra IP errado no startup

**Causa:** Múltiplas interfaces de rede (Wi-Fi + Ethernet)

**Solução:**
1. Desconectar interfaces não usadas
2. Verificar manualmente com `ipconfig`
3. Usar IP específico ao invés do detectado

---

## 📊 Monitoramento

### **Logs do Backend**

```typescript
// Logs importantes que aparecem no console
🚀 BarManager Pro API iniciado
📡 Servidor acessível em...
✅ Health Check disponível
🔐 Login bem-sucedido
🔄 Sincronização iniciada
❌ Erro de conexão
```

### **Logs do Desktop**

```typescript
// Console do Electron (F12)
🔐 Tentando login com...
✅ Login online bem-sucedido
📴 Login offline bem-sucedido
🟢 Conexão restaurada
🔴 Conexão perdida
🔄 Sincronização iniciada
```

---

## 🔐 Segurança

### **Desenvolvimento**
- ✅ CORS: `*` (aceita todas as origens)
- ✅ Helmet habilitado (headers de segurança)
- ✅ Validação de DTOs
- ✅ Rate limiting (configurável)

### **Produção**
- ⚠️ CORS: Definir origens específicas
- ⚠️ HTTPS obrigatório
- ⚠️ JWT_SECRET forte e único
- ⚠️ Variáveis de ambiente seguras
- ⚠️ Firewall configurado

---

## 📝 Checklist de Configuração

### **No Servidor (Backend)**
- [ ] Backend rodando (`pnpm dev`)
- [ ] Porta 3000 livre ou configurada
- [ ] Firewall permitindo conexões na porta
- [ ] IP da rede local identificado
- [ ] Health check acessível
- [ ] Variáveis de ambiente configuradas (`.env`)

### **No Desktop**
- [ ] URL da API configurada corretamente
- [ ] IP usando 127.0.0.1 ao invés de localhost
- [ ] Conexão de rede ativa
- [ ] Usuário criado no banco local
- [ ] Sincronização automática habilitada

### **Testes**
- [ ] Health check retorna "ok"
- [ ] Login funciona
- [ ] Sincronização funciona online
- [ ] Modo offline funciona
- [ ] Reconexão automática funciona
- [ ] Múltiplos desktops conseguem conectar

---

## 🎯 Melhores Práticas

### **IP Estático para Servidor**

Configurar IP estático no roteador evita que o IP mude:

1. Acessar interface do roteador (geralmente `192.168.1.1`)
2. Ir em DHCP → Reservas de IP
3. Adicionar MAC address do servidor com IP fixo
4. Reiniciar roteador

### **DNS Local (Avançado)**

Usar nome ao invés de IP:

1. Configurar hostname no servidor: `barmanager-server`
2. No desktop usar: `http://barmanager-server.local:3000/api/v1`
3. Funciona com Bonjour (Mac) ou mDNS (Linux/Windows)

### **VPN para Acesso Remoto**

Para acessar de fora da rede local:

1. Configurar VPN no roteador (OpenVPN, WireGuard)
2. Conectar via VPN
3. Usar IP local normalmente

---

## 📞 Suporte

**Documentação Relacionada:**
- `SYNC_TESTING_GUIDE.md` - Testes de sincronização
- `RAILWAY_DEPLOY.md` - Deploy em cloud
- `README.md` - Visão geral do projeto

**Logs Importantes:**
- Backend: Console onde `pnpm dev` está rodando
- Desktop: DevTools (F12) → Console
- Banco: `apps/backend/prisma/dev.db` (SQLite local)

---

**Última atualização:** 29 de novembro de 2025  
**Versão:** 1.0  
**Status:** ✅ Backend pronto para rede local
