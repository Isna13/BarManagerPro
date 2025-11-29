# 🔄 Configuração de Sincronização - BarManager Desktop

## 📋 Visão Geral

O BarManager Desktop foi configurado para funcionar em modo **offline-first** com sincronização automática com o servidor Railway quando há conexão disponível.

## ✅ Funcionalidades Implementadas

### 1. Login Offline/Online
- **Com internet**: Login via API Railway (obtém token JWT válido)
- **Sem internet**: Login local usando credenciais armazenadas no SQLite

### 2. Sincronização Automática
- ⏰ **Intervalo**: A cada 30 segundos
- 📤 **Push**: Envia operações locais pendentes para o servidor
- 📥 **Pull**: Baixa atualizações do servidor para o banco local

### 3. Reconexão Automática
- Quando o sistema está offline e detecta conexão disponível
- Tenta reautenticar automaticamente
- Se o usuário não existir no servidor, cria automaticamente

### 4. Resolução de Conflitos
- **Estratégia**: Servidor tem prioridade
- Dados locais não sincronizados são preservados na fila de sync

## 🌐 URLs Configuradas

| Ambiente | URL |
|----------|-----|
| **Produção (Railway)** | `https://barmanagerbackend-production.up.railway.app/api/v1` |
| **Local (dev)** | `http://127.0.0.1:3000/api/v1` |

## 📊 Entidades Sincronizadas

| Entidade | Push ✅ | Pull ✅ |
|----------|---------|---------|
| Branches (Filiais) | ✅ | ✅ |
| Users (Usuários) | ✅ | ✅ (sem senha) |
| Categories | ✅ | ✅ |
| Products | ✅ | ✅ |
| Customers | ✅ | ✅ |
| Suppliers | ✅ | ✅ |
| Sales | ✅ | 🔜 (em breve) |
| Inventory | ✅ | 🔜 (em breve) |

## 🔧 Como Funciona

### Fluxo de Login
```
1. Usuário insere credenciais
2. Sistema tenta login no Railway
   ├── ✅ Sucesso: Obtém token JWT válido
   └── ❌ Falha (sem internet): Valida localmente no SQLite
3. Após login, sincronização automática inicia
4. A cada 30 segundos, verifica e sincroniza
```

### Fluxo de Sincronização
```
1. PUSH: Enviar operações locais pendentes
   └── Para cada item na sync_queue:
       └── POST/PUT/DELETE no endpoint correspondente
       └── Marcar como sincronizado

2. PULL: Baixar dados do servidor
   └── GET /branches, /users, /categories, /products, /customers, /suppliers
   └── Mesclar com dados locais (servidor tem prioridade)
   └── Atualizar last_sync_date
```

### Fluxo de Reconexão
```
1. Sistema em modo offline (token = 'offline-token')
2. A cada 30 segundos, verifica conexão
3. Se conexão disponível:
   └── Tenta reautenticar com credenciais salvas
   └── Se sucesso: converte para token válido
   └── Se usuário não existe: cria no servidor
4. Continua sincronização normal
```

## 📱 Eventos de Sync (para UI)

O frontend pode escutar estes eventos:

```typescript
window.electronAPI.sync.onSyncStart(() => {
  // Sincronização iniciada
});

window.electronAPI.sync.onSyncProgress((data) => {
  // data.progress: 0-100
});

window.electronAPI.sync.onSyncComplete((data) => {
  // data.success: boolean
  // data.lastSync: Date
  // data.pendingItems: number
});

window.electronAPI.sync.onSyncError((error) => {
  // error: string
});

window.electronAPI.sync.onReauthenticated((data) => {
  // data.success: boolean
  // data.error?: string
});
```

## 🛠️ Comandos Manuais

```typescript
// Iniciar sincronização
await window.electronAPI.sync.start();

// Parar sincronização
await window.electronAPI.sync.stop();

// Status da sincronização
const status = await window.electronAPI.sync.status();
// { isRunning, pendingItems, lastSync, isOnline }

// Verificar conexão
const connected = await window.electronAPI.sync.checkConnection();

// Forçar push de dados locais
await window.electronAPI.sync.forcePush();

// Tentar reautenticar
const success = await window.electronAPI.sync.tryReauthenticate();
```

## 🔐 Credenciais de Teste

Para testar a sincronização, use as credenciais cadastradas no Railway:

- **Email**: `isnatchuda1@gmail.com`
- **Senha**: `isna123`

## 📝 Notas Importantes

1. **Primeira execução**: O banco local será criado com dados de seed
2. **Dados do servidor**: Se houver dados no Railway, serão baixados na primeira sincronização
3. **Conflitos**: Se existir o mesmo ID local e no servidor, servidor prevalece
4. **Senhas**: Senhas de usuários NÃO são sincronizadas do servidor por segurança
5. **Token offline**: Funciona apenas localmente, não acessa API do servidor

## 🐛 Troubleshooting

### "Login offline falhou"
- Verifique se o usuário existe no banco local
- O usuário precisa ter feito login online pelo menos uma vez

### "Sincronização não inicia"
- Verifique se está logado
- Verifique logs no console (F12 > Console)

### "Dados não aparecem após sync"
- Aguarde até 30 segundos para próximo ciclo
- Verifique se os endpoints estão disponíveis no servidor
- Verifique permissões do usuário

### "Erro 401 ao sincronizar"
- Token expirou ou é inválido
- Faça logout e login novamente
