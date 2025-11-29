# 🎯 Guia Rápido - Indicador Online/Offline

## 📍 Onde Encontrar

O indicador de status fica localizado na **sidebar esquerda**, logo **abaixo do nome do usuário**, no canto superior esquerdo da tela.

```
┌─────────────────────────────────┐
│ BarManager Pro                  │
│ João Silva ← Seu nome           │
│                                 │
│ 🟢 📶 Online          🔄        │ ← INDICADOR AQUI
│    Última sync: Agora mesmo     │
└─────────────────────────────────┘
```

---

## 🎨 Estados do Indicador

### 🟢 ONLINE (Verde)
```
🟢 📶  Online                    🔄
      Última sync: Agora mesmo
```

**Significado**: 
- ✅ Sistema conectado à internet
- ✅ Backend disponível
- ✅ Dados sincronizados

**O que você pode fazer**:
- Todas as operações funcionam normalmente
- Clicar no botão 🔄 para sincronizar manualmente

---

### 🔴 OFFLINE (Vermelho)
```
🔴 📵  Offline
      Dados serão sincronizados ao reconectar
      5 pendente(s)
```

**Significado**:
- ⚠️ Sem conexão com internet ou backend indisponível
- ⚠️ 5 operações aguardando sincronização

**O que você pode fazer**:
- ✅ Continuar trabalhando normalmente
- ✅ Criar vendas, produtos, clientes, etc.
- ✅ Todas as operações serão sincronizadas quando reconectar

**Não se preocupe**: 
- 🛡️ **Zero perda de dados** - tudo fica salvo localmente
- 🔄 Sincronização automática ao reconectar

---

### 🟡 SINCRONIZANDO (Amarelo)
```
🟡 🔄  Sincronizando...
      3 pendente(s)
```

**Significado**:
- 🔄 Enviando dados para o servidor
- 🔄 3 operações ainda na fila

**O que fazer**:
- ⏳ Aguarde alguns segundos
- ✅ Pode continuar trabalhando
- ✅ Não feche o aplicativo durante sincronização

---

### 🟠 ERRO (Laranja)
```
🟠 ⚠️  Erro na Sincronização
      Última sync: 5m atrás
      2 pendente(s)
```

**Significado**:
- ❌ Erro ao enviar dados ao servidor
- 🔄 Sistema tentará novamente automaticamente

**O que fazer**:
1. ✅ Continuar trabalhando (dados estão salvos localmente)
2. ⏳ Aguardar nova tentativa automática (em ~30 segundos)
3. 🔄 Ou clicar no botão de sincronização manual
4. 🆘 Se persistir, verificar:
   - Backend está rodando?
   - Conexão com internet OK?
   - Fazer logout e login novamente

---

## 🔄 Botão de Sincronização Manual

Quando o indicador mostra **🟢 Online**, você verá um botão 🔄 no lado direito:

```
🟢 📶  Online          🔄 ← Clique aqui
```

**Quando usar**:
- ✅ Para forçar sincronização imediata
- ✅ Após criar muitos itens offline
- ✅ Antes de fechar o aplicativo
- ✅ Para garantir que tudo está sincronizado

**Como usar**:
1. Clique no ícone 🔄
2. Indicador muda para 🟡 "Sincronizando..."
3. Após alguns segundos, volta para 🟢 "Online"
4. Verificar "0 pendente(s)"

---

## 📊 Informações Exibidas

### Última Sincronização

Mostra quando foi a última vez que os dados foram sincronizados:

| Texto | Significado |
|-------|-------------|
| "Agora mesmo" | Sincronizado há menos de 1 minuto |
| "5m atrás" | Sincronizado há 5 minutos |
| "2h atrás" | Sincronizado há 2 horas |
| "Ontem" | Sincronizado ontem ou antes |
| "Nunca" | Ainda não sincronizou (primeira vez) |

### Itens Pendentes

Mostra quantas operações estão aguardando sincronização:

| Texto | Significado |
|-------|-------------|
| (nada) | Nenhum item pendente |
| "1 pendente(s)" | 1 operação aguardando |
| "5 pendente(s)" | 5 operações aguardando |
| "50 pendente(s)" | 50 operações aguardando (muitas!) |

**⚠️ Atenção**: Se tiver muitos itens pendentes (50+), considere:
- Clicar no botão de sincronização manual
- Aguardar a sincronização completar antes de fechar o app
- Verificar se a internet está boa

---

## 🎬 Cenários Comuns

### Cenário 1: Trabalhando Normalmente
```
Estado: 🟢 Online
Ação: Nenhuma - continue trabalhando
```

### Cenário 2: Internet Caiu
```
Estado: 🔴 Offline
Ação: Continue trabalhando, dados serão sincronizados depois
```

### Cenário 3: Internet Voltou
```
Estado: 🟡 Sincronizando... → 🟢 Online
Ação: Aguarde a sincronização completar
```

### Cenário 4: Muitos Itens Pendentes
```
Estado: 🟢 Online, 50 pendente(s)
Ação: Clique no botão 🔄 para sincronizar
```

### Cenário 5: Erro de Sincronização
```
Estado: 🟠 Erro
Ação: 
  1. Aguarde retry automático (30s)
  2. Ou clique em 🔄
  3. Se persistir, fazer logout/login
```

### Cenário 6: Antes de Fechar o App
```
Estado: Qualquer
Ação: 
  1. Verificar se está 🟢 Online
  2. Verificar "0 pendente(s)"
  3. Se tiver itens pendentes, clicar em 🔄
  4. Aguardar sincronização
  5. Agora pode fechar!
```

---

## ⚡ Dicas Rápidas

### ✅ Boas Práticas

1. **Sempre verifique o indicador antes de fechar**
   - Se houver itens pendentes, sincronize
   - Aguarde "0 pendente(s)"

2. **Trabalhe sem medo no modo offline**
   - Todos os dados ficam salvos
   - Sincronização é automática

3. **Force sincronização após criar muitos itens**
   - Clique no botão 🔄
   - Evita fila grande

4. **Se o indicador fica laranja (erro)**
   - Aguarde 30 segundos (retry automático)
   - Ou clique no botão 🔄
   - Faça logout/login se persistir

### ❌ Evite

1. **Não feche o app com itens pendentes**
   - Aguarde sincronização completar
   - Riscos de perda de dados

2. **Não ignore erros persistentes**
   - Se ficar vermelho por muito tempo
   - Verifique conexão/backend
   - Contate suporte se necessário

3. **Não trabalhe offline por dias**
   - Sincronize pelo menos uma vez por dia
   - Evita acúmulo excessivo de itens

---

## 🆘 Resolução de Problemas

### Problema: Indicador sempre vermelho (offline)

**Causas**:
- Backend não está rodando
- Sem conexão com internet
- URL do backend incorreta

**Solução**:
```
1. Verificar internet: Abrir navegador
2. Verificar backend: http://localhost:3000/api/v1/health
3. Se backend OK mas indicador vermelho: Fazer logout/login
```

### Problema: Itens pendentes não diminuem

**Causas**:
- Backend rejeitando operações
- Erros nas requisições

**Solução**:
```
1. Verificar console (F12) por erros
2. Fazer logout e login novamente
3. Contatar suporte com screenshots
```

### Problema: Sincronização muito lenta

**Causas**:
- Muitos itens na fila (100+)
- Conexão lenta
- Backend sobrecarregado

**Solução**:
```
1. Aguardar sincronização completar
2. Evitar criar muitos itens offline
3. Sincronizar mais frequentemente
```

---

## 📞 Suporte

Se tiver problemas com o indicador ou sincronização:

1. **Documentação Completa**: [SYNC_SYSTEM.md](docs/SYNC_SYSTEM.md)
2. **Guia de Testes**: [TESTING_GUIDE.md](TESTING_GUIDE.md)
3. **FAQ**: [ONLINE_OFFLINE_SUMMARY.md](ONLINE_OFFLINE_SUMMARY.md)
4. **Suporte Técnico**: suporte@barmanager.com

---

**Última atualização**: 27 de Novembro de 2025
**Versão**: 1.1.0
