# Configuração de Rede para Teste no Dispositivo Físico

## ⚠️ IMPORTANTE: Dados Reais vs Dados Simulados

O aplicativo está configurado para buscar dados REAIS do backend. Se você vê dados como na imagem (XOF 125,000, 248 produtos, etc), isso significa que:

### 1. **O Backend está retornando dados reais do banco**
   - Esses não são dados mockados/simulados
   - São dados reais existentes no banco de dados
   - Foram cadastrados via sistema desktop ou backend

### 2. **Para ver SEUS dados no mobile**

Você precisa conectar o app mobile ao backend que está rodando no seu computador:

#### Passo 1: Descobrir o IP da sua máquina

```powershell
# No Windows PowerShell:
ipconfig

# Procure por "Endereço IPv4" na seção da sua rede ativa
# Exemplo: 192.168.1.100
```

#### Passo 2: Atualizar a configuração do app

Edite o arquivo: `apps/mobile/lib/config/api_config.dart`

**Opção A - Usando comentário (RECOMENDADO):**

```dart
// Descomente e modifique as linhas 23-28:
static String get baseUrl {
  // Substitua pelo IP da sua máquina na rede local
  const localIP = '192.168.1.100'; // COLOQUE SEU IP AQUI
  return 'http://$localIP:3000/api/v1';
}
```

**Opção B - Modificação direta (linha 12):**

```dart
// Linha 12 - Modifique de:
return 'http://10.0.2.2:3000/api/v1';

// Para (substitua pelo SEU IP):
return 'http://192.168.1.100:3000/api/v1';
```

#### Passo 3: Iniciar o backend

```powershell
cd C:\BarManagerPro\apps\backend
npm run start:dev
```

O backend deve estar rodando em: `http://localhost:3000`

#### Passo 4: Aplicar mudanças no app

No terminal onde o app está rodando, pressione:
- **`r`** - Hot reload (recarrega código)
- **`R`** - Hot restart (reinicia completamente)

#### Passo 5: Verificar conectividade

No app mobile:
1. Toque no ícone de sincronização (nuvem) no topo
2. Aguarde a sincronização
3. Os dados devem ser atualizados

## 🔍 Verificação de Conectividade

### Teste de Ping (Opcional)

```powershell
# No seu computador, verifique se o backend responde:
curl http://localhost:3000/api/v1/auth/health

# Se funcionar, teste do celular (via navegador):
# Abra: http://SEU_IP:3000/api/v1/auth/health
```

### Firewall

Se não conectar, libere a porta 3000 no Windows Firewall:

```powershell
# Execute como Administrador:
New-NetFirewallRule -DisplayName "BarManager Backend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 📊 Sincronização Automática

O app agora sincroniza automaticamente a cada 5 minutos.

### Sincronização Manual:
- Toque no ícone de nuvem no topo do Dashboard
- Puxe para baixo (pull-to-refresh) nas telas

## ❌ Problemas Comuns

### 1. "Erro de conexão com servidor"
- ✅ Backend está rodando?
- ✅ IP está correto?
- ✅ Celular está na mesma rede WiFi?
- ✅ Firewall permite porta 3000?

### 2. "Timeout"
- Aumente o timeout em `api_config.dart` (linha 19-20)
- De 15 para 30 segundos

### 3. Dados vazios/zero
- Backend está vazio (sem vendas, produtos, etc)
- Cadastre dados via sistema desktop primeiro

## 🎯 IP Configurado Atualmente

**Android (Emulador):** `10.0.2.2:3000`
**iOS (Simulator):** `localhost:3000`
**Dispositivo Físico:** Precisa configurar manualmente

## 📱 Para Produção

Quando for distribuir o app:
1. Configure URL de produção em `api_config.dart`
2. Use HTTPS com certificado válido
3. Configure domínio real (ex: `https://api.barmanager.com`)
