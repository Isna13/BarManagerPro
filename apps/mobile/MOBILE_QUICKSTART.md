# 🚀 BarManager Mobile - Guia Rápido

## ✅ Status: COMPLETO E PRONTO PARA USO

### 📦 O que foi configurado?

- ✅ **93 dependências instaladas** (Flutter, Dio, SQLite, QR Scanner, etc)
- ✅ **Estrutura Android/iOS criada** (AndroidManifest.xml, build.gradle, etc)
- ✅ **Permissões configuradas** (Câmera, Internet, Rede)
- ✅ **Todos os erros corrigidos** (0 erros, apenas 7 avisos de estilo)
- ✅ **Providers implementados** (Auth, Sync)
- ✅ **Serviços completos** (API, Database, Sync)
- ✅ **7 Telas funcionais** (Splash, Login, Dashboard, POS, QR Scanner, Sales, Inventory)

---

## 🎯 Executar Agora (3 comandos)

### 1️⃣ Verificar Flutter
```bash
flutter doctor
```

### 2️⃣ Conectar dispositivo/emulador
```bash
# Ver dispositivos disponíveis
flutter devices
```

### 3️⃣ Executar app
```bash
cd C:\BarManagerPro\apps\mobile
flutter run
```

✨ **Pronto! O app vai abrir automaticamente no dispositivo conectado.**

---

## 📱 Opções de Execução

### Android Emulator
1. Abra Android Studio
2. Abra AVD Manager
3. Inicie um emulador
4. Execute: `flutter run`

### Dispositivo Físico (Android)
1. Habilite "Depuração USB" no celular
2. Conecte via USB
3. Execute: `flutter run`

### Chrome (Web - Desenvolvimento)
```bash
flutter run -d chrome
```

---

## 🔧 Configuração de API

**IMPORTANTE:** Antes de testar, configure o IP do backend.

Edite: `lib/services/api_service.dart` (linha 5)

```dart
// Opções:
static const String baseUrl = 'http://10.0.2.2:3000/api/v1';      // Android Emulator
static const String baseUrl = 'http://localhost:3000/api/v1';      // iOS Simulator
static const String baseUrl = 'http://192.168.1.10:3000/api/v1';  // Seu IP local
static const String baseUrl = 'https://sua-app.railway.app/api/v1'; // Produção
```

**Encontrar seu IP local (Windows):**
```bash
ipconfig
# Procure por "Endereço IPv4"
```

---

## 🔐 Credenciais de Teste

```
Email: admin@barmanager.com
Senha: admin123
```

---

## 📊 Funcionalidades Disponíveis

### ✅ Telas Implementadas
- **Splash Screen** → Verifica autenticação
- **Login** → Email + senha
- **Dashboard** → Estatísticas + menu
- **POS (Ponto de Venda)** → Carrinho de vendas
- **QR Scanner** → Lê códigos QR
- **Sales** → Histórico de vendas
- **Inventory** → Lista de produtos

### ✅ Funcionalidades Core
- **Modo Offline** → Funciona sem internet
- **Sincronização** → Envia dados quando online
- **SQLite Local** → Banco de dados no dispositivo
- **State Management** → Provider

---

## 🐛 Resolução de Problemas

### ❌ "No devices found"
```bash
# Android: Habilite depuração USB
# iOS: Confie no computador
flutter devices
```

### ❌ "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
flutter clean
flutter pub get
flutter run
```

### ❌ "Camera permission denied"
- Android: Permissões já configuradas no AndroidManifest.xml
- iOS: Adicione descrição em `Info.plist` (se testar iOS)

### ❌ Backend não conecta
1. Verifique se backend está rodando: `http://localhost:3000/api/v1/health`
2. Use IP correto no `api_service.dart`
3. Desabilite firewall/antivírus temporariamente

---

## 📦 Build para Produção

### Android (APK)
```bash
flutter build apk --release
# APK em: build/app/outputs/flutter-apk/app-release.apk
```

### Android (App Bundle - Google Play)
```bash
flutter build appbundle --release
# AAB em: build/app/outputs/bundle/release/app-release.aab
```

---

## 🎨 Personalização

### Alterar nome do app
- `pubspec.yaml` → `name: seu_nome`
- `AndroidManifest.xml` → `android:label="Seu Nome"`

### Alterar ícone
1. Instale: `flutter pub add flutter_launcher_icons`
2. Configure em `pubspec.yaml`
3. Execute: `flutter pub run flutter_launcher_icons`

### Alterar tema
Edite `lib/main.dart`:
```dart
theme: ThemeData(
  primarySwatch: Colors.purple, // Sua cor
  useMaterial3: true,
)
```

---

## 📚 Comandos Úteis

```bash
# Ver logs
flutter logs

# Hot reload (durante execução)
# Pressione: r

# Hot restart (durante execução)
# Pressione: R

# Limpar cache
flutter clean

# Atualizar dependências
flutter pub upgrade

# Verificar performance
flutter run --profile

# Build de depuração
flutter build apk --debug
```

---

## 🔄 Próximos Passos

1. ✅ **Execute o app** → `flutter run`
2. ✅ **Teste o login** → admin@barmanager.com / admin123
3. ✅ **Teste o POS** → Adicione produtos ao carrinho
4. ✅ **Teste QR Scanner** → Escaneie um QR code
5. ⬜ **Configure URL produção** → Quando fizer deploy backend
6. ⬜ **Build para produção** → `flutter build apk --release`
7. ⬜ **Publique na Play Store** → Siga guia do Google

---

## 📞 Suporte

**Problemas?** Verifique:
1. `flutter doctor` → Tudo OK?
2. Backend rodando? → `http://localhost:3000`
3. Dispositivo conectado? → `flutter devices`
4. Permissões habilitadas? → Câmera + Internet

---

**🎉 App Mobile 100% funcional e pronto para testes!**

*Desenvolvido com Flutter 💙*
