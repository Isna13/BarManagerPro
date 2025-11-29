# 📋 Guia de Teste - Sincronização Automática

## ✅ Correções Implementadas

### 1. **SyncManager - Reconexão Automática**
- ✅ Agora tenta **reautenticar automaticamente** quando detecta que o backend está disponível
- ✅ Verifica conexão a cada **30 segundos** mesmo em modo offline
- ✅ Converte automaticamente token offline para token válido quando reconecta

### 2. **Hook useOnlineStatus - Listeners Corrigidos**
- ✅ Removido problema de **dependências no useEffect** que causava re-criação desnecessária de listeners
- ✅ Separado lógica de notificação de fila em useEffect independente
- ✅ Atualiza status após reautenticação bem-sucedida

### 3. **Logs Detalhados**
- ✅ Adicionados logs claros em cada etapa do processo de sincronização
- ✅ Fácil identificação de problemas através do console

---

## 🧪 Como Testar

### **Cenário 1: Login Offline → Backend Volta Online**

1. **Desligar o backend** (ou desconectar internet)
2. **Abrir aplicativo desktop** e fazer login
   - ✅ Deve logar com sucesso no modo offline
   - ✅ Indicador deve mostrar "Offline" (círculo vermelho)
3. **Ligar o backend** (ou reconectar internet)
4. **Aguardar até 30 segundos**
   - ✅ Console deve mostrar: "🟢 Conexão restaurada"
   - ✅ Console deve mostrar: "✅ Backend disponível! Tentando reautenticação automática..."
   - ✅ Console deve mostrar: "✅ Reautenticação automática bem-sucedida!"
   - ✅ Indicador deve mudar para "Online" (círculo verde)
   - ✅ Sincronização deve iniciar automaticamente

**Logs esperados no console:**
```
ℹ️ Modo offline detectado, tentando reautenticar automaticamente...
✅ Backend disponível! Tentando reautenticação automática...
🔄 Tentando reautenticar com backend...
✅ Reautenticação bem-sucedida! Token offline convertido para token válido
🚀 Iniciando sincronização após reautenticação...
✅ Sincronização concluída
```

---

### **Cenário 2: Login Online → Perder Conexão → Recuperar**

1. **Com backend ligado**, fazer login no desktop
   - ✅ Login bem-sucedido com token válido
   - ✅ Indicador mostra "Online" (círculo verde)
   - ✅ Sincronização inicia automaticamente
2. **Desligar backend** ou desconectar internet
   - ✅ Indicador muda para "Offline" (círculo vermelho)
   - ✅ Console mostra: "🔴 Conexão perdida"
3. **Ligar backend** novamente
   - ✅ Após **até 30 segundos**, deve reconectar automaticamente
   - ✅ Console mostra: "🟢 Conexão restaurada"
   - ✅ Reautenticação automática acontece
   - ✅ Sincronização retoma

---

### **Cenário 3: Sincronização Manual**

1. Com aplicativo aberto (online ou offline)
2. **Clicar no botão de sincronização manual** (ícone de refresh no indicador)
   - ✅ Se **online**: força sincronização imediata
   - ✅ Se **offline**: tenta reconectar e reautenticar
   - ✅ Barra de progresso aparece durante sincronização
   - ✅ Ícone gira enquanto sincroniza

**Logs esperados:**
```
🔄 Forçando sincronização...
🔄 Sincronização iniciada
⏳ Progresso recebido: 60%
⏳ Progresso recebido: 90%
✅ Sincronização concluída
```

---

### **Cenário 4: Verificar Items Pendentes**

1. Com aplicativo offline, realizar operações (criar venda, adicionar produto, etc.)
2. **Observar indicador de status**
   - ✅ Deve mostrar "X pendente(s)" abaixo do status
3. **Reconectar** (ligar backend)
4. **Aguardar sincronização automática**
   - ✅ Items pendentes devem sincronizar
   - ✅ Contador deve zerar após conclusão

---

## 🔍 Verificações no Console do DevTools

### **Console do Electron** (F12 → Console)

#### Durante Login Offline:
```
🔐 Tentando login com: usuario@email.com
📦 Login result recebido: { "success": true, "data": { "accessToken": "offline-token" ... } }
⚠️ Formato online detectado MAS token é offline-token
📴 Login realizado em modo OFFLINE (backend indisponível)
Backend indisponível, tentando login offline...
✅ Login offline bem-sucedido: usuario@email.com
🔄 Sincronização iniciada
📊 Status do token: ❌ OFFLINE-TOKEN (tentará reconectar)
⏰ Intervalo de sincronização: 30 segundos
ℹ️ Modo offline detectado, tentando reautenticar automaticamente...
📡 Backend ainda indisponível, aguardando próxima verificação...
```

#### Quando Conexão é Perdida (Durante Uso):
```
🔴 ========================================
🔴 CONEXÃO PERDIDA - MODO OFFLINE ATIVADO
🔴 ========================================
📴 Aplicativo continuará funcionando localmente
💾 Todas as alterações serão salvas localmente
🔄 Sincronização automática tentará reconectar a cada 30 segundos
📊 Items pendentes de sincronização serão enviados quando reconectar
```

#### Quando Erro de Rede Durante Sincronização:
```
❌ Erro na sincronização: connect ECONNREFUSED 127.0.0.1:3000
🔴 Conexão com backend perdida durante sincronização
📴 Sistema entrará em modo offline
🔄 Tentativas de reconexão continuarão automaticamente a cada 30 segundos
```

#### Durante Reconexão (Evento de Rede):
```
🟢 Conexão de rede restaurada - Aguardando 2s antes de verificar backend...
🔍 Verificando se backend está acessível...
✅ Backend acessível! Iniciando processo de reautenticação...
🔍 tryReauthenticate chamado (tentativas restantes: 3)
✅ Reautenticação bem-sucedida! Token offline convertido para token válido
🚀 Iniciando sincronização após reautenticação...
🔄 Sincronização iniciada
⏳ Progresso recebido: 60%
✅ Sincronização concluída
```

#### Durante Reconexão (Verificação Periódica - 30s):
```
ℹ️ Modo offline detectado, tentando reautenticar automaticamente...
✅ Backend disponível! Tentando reautenticação automática...
🔄 Tentando reautenticar com backend...
✅ Reautenticação bem-sucedida! Token offline convertido para token válido
🚀 Iniciando sincronização após reautenticação...
✅ Sincronização concluída
```

#### Durante Sincronização Periódica:
```
ℹ️ Modo offline detectado, tentando reautenticar automaticamente...
✅ Backend disponível! Tentando reautenticação automática...
✅ Reautenticação automática bem-sucedida! Sincronização continuará...
```

---

## 🐛 Possíveis Problemas e Soluções

### ❌ "Reautenticação falhou após todas as tentativas"

**Causas possíveis:**
- Backend ainda está offline
- Credenciais inválidas no banco local
- Porta do backend mudou
- Sistema resolvendo `localhost` para IPv6 (::1) ao invés de IPv4

**Solução:**
1. Verificar se backend está realmente rodando: `http://127.0.0.1:3000/api/v1/health`
2. Verificar logs do backend para erros de autenticação
3. Trocar URL de `localhost` para `127.0.0.1` em Configurações
4. Tentar fazer logout e login novamente

### ❌ "connect ECONNREFUSED ::1:3000"

**Causa:**
- Sistema está tentando conectar via IPv6 (::1) ao invés de IPv4 (127.0.0.1)

**Solução:**
1. Ir em **Configurações** do aplicativo
2. Trocar URL da API de `http://localhost:3000/api/v1` para `http://127.0.0.1:3000/api/v1`
3. Fazer logout e login novamente
4. **Correção já aplicada**: Novo padrão é `127.0.0.1`

---

### ❌ "Backend indisponível, mantendo modo offline"

**Comportamento normal quando:**
- Backend está desligado
- Sem conexão com internet
- URL do backend incorreta

**Solução:**
- Ligar o backend
- Verificar URL em Configurações
- Aguardar até 30 segundos para próxima tentativa automática

---

### ❌ Sincronização não inicia após reconexão

**Verificar:**
1. Console do Electron mostra mensagem de reconexão?
2. Indicador mudou de vermelho para verde?
3. Aguardar até 30 segundos (intervalo de verificação)

**Solução temporária:**
- Clicar no botão de sincronização manual (ícone refresh)

---

## 📊 Indicadores Visuais

### **Círculo de Status**
- 🟢 **Verde pulsante**: Online e sincronizado
- 🟡 **Amarelo pulsante**: Sincronizando
- 🔴 **Vermelho**: Offline
- 🟠 **Laranja**: Erro na sincronização

### **Ícones**
- 📶 **Wifi**: Conexão online
- 🚫 **WifiOff**: Sem conexão
- 🔄 **RefreshCw (girando)**: Sincronizando
- ⚠️ **AlertCircle**: Erro

### **Barra de Progresso**
- Aparece na parte inferior do indicador durante sincronização
- Mostra progresso de 0% a 100%
- Gradiente azul → verde

### **⭐ NOVO: Alertas de Conexão**
#### **Alerta Vermelho (Conexão Perdida)**
- 🔴 Aparece abaixo do indicador quando perde conexão
- Mensagem: "Conexão perdida - Modo offline ativado"
- Duração: 5 segundos
- Cor: Vermelho escuro com borda vermelha

#### **Alerta Verde (Conexão Restaurada)**
- 🟢 Aparece abaixo do indicador quando reconecta
- Mensagem: "Conexão restaurada - Sincronizando..."
- Duração: 3 segundos
- Cor: Verde escuro com borda verde
- Aparece automaticamente ao reconectar

---

## ✅ Checklist Final

- [ ] Login offline funciona
- [ ] Login online funciona
- [ ] Reconexão automática funciona (aguardar 30s)
- [ ] Indicador visual muda de estado corretamente
- [ ] Sincronização manual funciona
- [ ] Items pendentes são sincronizados
- [ ] Logs aparecem corretamente no console
- [ ] Barra de progresso funciona durante sincronização

---

## 🎯 Próximos Passos Recomendados

1. ✅ **Testar com backend Railway** (quando disponível)
2. ✅ **Testar em ambiente de produção**
3. ✅ **Validar com múltiplos usuários**
4. ✅ **Testar reconexão em rede instável**

---

## 📝 Notas Técnicas

### **Intervalo de Sincronização**
- **Padrão**: 30 segundos
- **Pode ser ajustado** em `apps/desktop/electron/sync/manager.ts` (linha 156)
- Valor em milissegundos: `30000 = 30 segundos`

### **Tentativas de Reautenticação**
- **Automática no background**: 1 tentativa
- **Manual do usuário**: 3 tentativas com backoff exponencial (2s, 4s, 6s)

### **Arquivos Modificados**
1. `apps/desktop/electron/sync/manager.ts`
   - Adicionada lógica de reconexão automática no método `syncNow()`
   - Logs mais detalhados

2. `apps/desktop/src/hooks/useOnlineStatus.ts`
   - Corrigido problema de dependências no useEffect
   - Separado lógica de notificação
   - Adicionada atualização de status após reautenticação

---

**Data**: 29 de novembro de 2025  
**Versão**: 1.0  
**Status**: ✅ Implementado e pronto para teste
