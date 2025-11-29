# 🚀 BarManager Pro Mobile - Comandos Rápidos

## ⚡ Execução Rápida

### **Executar no Dispositivo Android Conectado**
```powershell
cd apps\mobile
flutter run
```

### **Executar em Dispositivo Específico**
```powershell
# Listar dispositivos
flutter devices

# Executar no dispositivo específico
flutter run -d DEVICE_ID
```

### **Hot Reload (Durante Execução)**
Pressione `r` no terminal para recarregar as alterações sem reiniciar o app.

### **Hot Restart (Durante Execução)**
Pressione `R` no terminal para reiniciar o app completamente.

---

## 📦 Build e Instalação

### **Gerar APK Debug**
```powershell
cd apps\mobile
flutter build apk --debug
```

### **Gerar APK Release (Produção)**
```powershell
cd apps\mobile
flutter build apk --release
```

**APK será gerado em:**
```
apps\mobile\build\app\outputs\flutter-apk\app-release.apk
```

### **Instalar APK no Dispositivo**
```powershell
# Via ADB
adb install apps\mobile\build\app\outputs\flutter-apk\app-release.apk

# Ou copiar o APK para o dispositivo e instalar manualmente
```

---

## 🧹 Limpeza e Manutenção

### **Limpar Cache e Build**
```powershell
cd apps\mobile
flutter clean
flutter pub get
```

### **Atualizar Dependências**
```powershell
flutter pub get
# Ou forçar atualização
flutter pub upgrade
```

---

## 🔍 Diagnóstico

### **Verificar Configuração Flutter**
```powershell
flutter doctor -v
```

### **Listar Dispositivos Conectados**
```powershell
flutter devices
```

### **Ver Logs em Tempo Real**
```powershell
flutter logs
# Ou logs do Android
adb logcat
```

---

## 🐛 Resolução de Problemas

### **Erro: "No connected devices"**
```powershell
# 1. Verificar se o dispositivo está conectado
adb devices

# 2. Se não aparecer, reiniciar ADB
adb kill-server
adb start-server

# 3. Habilitar "Depuração USB" no celular
# Android: Configurações > Sobre o telefone > Toque 7x em "Número da compilação"
# Depois: Configurações > Opções do desenvolvedor > Depuração USB
```

### **Erro: "Could not resolve all files for configuration"**
```powershell
cd apps\mobile
flutter clean
flutter pub get
flutter pub upgrade
```

### **Erro ao compilar após mudanças**
```powershell
# Limpar completamente
flutter clean
cd android
./gradlew clean
cd ..
flutter pub get
```

### **App não conecta ao backend**
1. Editar `lib/services/api_service.dart`
2. Alterar `baseUrl` para:
   - Emulador Android: `http://10.0.2.2:3000/api/v1`
   - Dispositivo Real: `http://SEU_IP:3000/api/v1`
3. Dispositivo e PC devem estar na mesma rede Wi-Fi

---

## 🔥 Firebase (Notificações)

### **Configurar Firebase**
1. Criar projeto no [Firebase Console](https://console.firebase.google.com/)
2. Adicionar app Android
3. Baixar `google-services.json`
4. Colocar em `apps/mobile/android/app/google-services.json`

### **Verificar Configuração Firebase**
```powershell
# Deve aparecer sem erros
flutter run
# Verificar logs para: "✅ Firebase initialized"
```

---

## 📱 Comandos Úteis Durante Desenvolvimento

| Ação | Comando |
|------|---------|
| Hot Reload | `r` (no terminal) |
| Hot Restart | `R` (no terminal) |
| Abrir DevTools | `d` |
| Ver Logs | `l` |
| Tirar Screenshot | `s` |
| Parar App | `q` |

---

## 🎯 Workflow Recomendado

### **Desenvolvimento Diário**
```powershell
# 1. Iniciar app
cd apps\mobile
flutter run

# 2. Fazer alterações no código
# 3. Pressionar 'r' para hot reload
# 4. Testar no dispositivo
# 5. Repetir 2-4
```

### **Preparar para Produção**
```powershell
# 1. Testar completamente
cd apps\mobile
flutter run --release

# 2. Corrigir erros se houver

# 3. Gerar APK final
flutter clean
flutter pub get
flutter build apk --release

# 4. Testar APK no dispositivo
adb install build/app/outputs/flutter-apk/app-release.apk

# 5. Distribuir APK
# Copiar de: build/app/outputs/flutter-apk/app-release.apk
```

---

## 📊 Tamanho do APK

### **Ver Tamanho do APK**
```powershell
cd apps\mobile\build\app\outputs\flutter-apk
dir
```

### **Reduzir Tamanho do APK**
```powershell
# Gerar APKs separados por arquitetura
flutter build apk --split-per-abi

# Isso gera 3 APKs:
# - app-armeabi-v7a-release.apk (32-bit ARM)
# - app-arm64-v8a-release.apk (64-bit ARM) - MAIS COMUM
# - app-x86_64-release.apk (Intel 64-bit)
```

---

## 🔐 Assinatura de APK (Play Store)

### **Gerar Keystore**
```powershell
keytool -genkey -v -keystore upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

### **Configurar Assinatura**
1. Criar arquivo `android/key.properties`:
```properties
storePassword=sua_senha
keyPassword=sua_senha
keyAlias=upload
storeFile=C:/caminho/para/upload-keystore.jks
```

2. Build com assinatura:
```powershell
flutter build apk --release
# ou
flutter build appbundle --release  # Para Play Store
```

---

## 📱 Testar em Múltiplos Dispositivos

```powershell
# Listar todos os dispositivos
flutter devices

# Executar em todos simultaneamente
flutter run -d all

# Executar em dispositivo específico
flutter run -d DEVICE_ID
```

---

## 🎨 Alterar Ícone e Nome do App

### **Ícone**
1. Colocar ícone em `assets/icon/app_icon.png` (1024x1024)
2. Adicionar ao `pubspec.yaml`:
```yaml
dev_dependencies:
  flutter_launcher_icons: ^0.13.1

flutter_icons:
  android: true
  image_path: "assets/icon/app_icon.png"
```
3. Gerar ícones:
```powershell
flutter pub run flutter_launcher_icons
```

### **Nome do App**
Editar `android/app/src/main/AndroidManifest.xml`:
```xml
<application
    android:label="BarManager Pro"
    ...>
```

---

## ✅ Checklist Antes de Distribuir

- [ ] Testar todas as funcionalidades
- [ ] Testar modo offline
- [ ] Testar notificações
- [ ] Testar em diferentes tamanhos de tela
- [ ] Verificar performance
- [ ] Build release funciona
- [ ] APK instala corretamente
- [ ] Firebase configurado (se usando notificações)
- [ ] Ícone e nome corretos
- [ ] Backend acessível (URL correta)

---

**Sucesso! 🎉** O app está pronto para ser distribuído aos gerentes e proprietários!
