# 📱 BarManager Pro - Mobile App (Flutter)

## 🚀 Instalação e Execução

### Pré-requisitos
- Flutter SDK 3.0+
- Android Studio / Xcode
- Dispositivo Android/iOS ou Emulador

### 1. Instalar Dependências

```bash
cd apps/mobile
flutter pub get
```

### 2. Verificar Configuração Flutter

```bash
flutter doctor
```

### 3. Executar no Emulador/Dispositivo

**Android:**
```bash
flutter run
```

**iOS (macOS apenas):**
```bash
flutter run
```

**Web (desenvolvimento):**
```bash
flutter run -d chrome
```

---

## 📂 Estrutura do Projeto

```
lib/
├── main.dart                 # Entry point
├── providers/                # State Management
│   ├── auth_provider.dart   # Autenticação
│   └── sync_provider.dart   # Sincronização
├── services/                 # Serviços
│   ├── api_service.dart     # Chamadas HTTP
│   ├── database_service.dart # SQLite local
│   └── sync_service.dart    # Lógica de sincronização
├── screens/                  # Telas
│   ├── splash_screen.dart   # Splash inicial
│   ├── login_screen.dart    # Login
│   ├── dashboard_screen.dart # Dashboard principal
│   ├── pos_screen.dart      # Ponto de Venda
│   ├── qr_scanner_screen.dart # Scanner QR
│   ├── sales_screen.dart    # Lista de vendas
│   └── inventory_screen.dart # Inventário
└── models/                   # Modelos de dados
    ├── user.dart
    ├── product.dart
    └── sale.dart
```

---

## 🎯 Funcionalidades Implementadas

### ✅ Core
- [x] Splash Screen com verificação de autenticação
- [x] Login com validação de formulário
- [x] Dashboard com estatísticas em tempo real
- [x] Sistema de sincronização offline-first
- [x] Banco de dados SQLite local

### ✅ Vendas (POS)
- [x] Interface PDV com carrinho
- [x] Busca de produtos
- [x] **Muntu Pricing** (preço caixa com economia)
- [x] Cálculo automático de subtotais e totais
- [x] Finalização de vendas
- [x] Integração com scanner QR

### ✅ Scanner QR
- [x] Scanner de códigos QR
- [x] Leitura de menu (menu-{branchId})
- [x] Flash e troca de câmera
- [x] Feedback visual de leitura

### ✅ Sincronização
- [x] Modo offline-first
- [x] Fila de sincronização
- [x] Pull/Push automático
- [x] Indicador de status (pendente/sincronizado)

---

## 🔌 Integração com Backend

### Configurar URL da API

Edite `lib/services/api_service.dart`:

```dart
static const String baseUrl = 'http://SEU_IP:3000/api/v1';
```

**Desenvolvimento Local:**
- Android Emulator: `http://10.0.2.2:3000/api/v1`
- iOS Simulator: `http://localhost:3000/api/v1`
- Dispositivo Físico: `http://192.168.X.X:3000/api/v1` (IP da sua máquina)

---

## 📦 Dependências Principais

```yaml
dependencies:
  flutter: sdk
  provider: ^6.1.1          # State management
  dio: ^5.4.0               # HTTP client
  sqflite: ^2.3.0           # SQLite database
  qr_code_scanner: ^1.0.1   # QR Scanner
  connectivity_plus: ^5.0.2 # Network status
  shared_preferences: ^2.2.2 # Storage
  intl: ^0.18.1             # Formatação
```

---

## 🧪 Testes

```bash
# Unit tests
flutter test

# Integration tests
flutter test integration_test/
```

---

## 📱 Build para Produção

### Android (APK)
```bash
flutter build apk --release
```

### Android (App Bundle - Google Play)
```bash
flutter build appbundle --release
```

### iOS (App Store)
```bash
flutter build ios --release
```

---

## 🛠 Comandos Úteis

```bash
# Limpar cache
flutter clean

# Atualizar dependências
flutter pub upgrade

# Verificar erros
flutter analyze

# Formatar código
flutter format lib/

# Ver devices conectados
flutter devices
```

---

## 🔐 Credenciais de Teste

```
Email: admin@barmanager.com
Senha: admin123
```

---

## 📊 Screenshots

| Login | Dashboard | POS | QR Scanner |
|-------|-----------|-----|------------|
| ![Login](assets/screenshots/login.png) | ![Dashboard](assets/screenshots/dashboard.png) | ![POS](assets/screenshots/pos.png) | ![QR](assets/screenshots/qr.png) |

---

## 🐛 Troubleshooting

### Erro de permissões (Android)

Adicione em `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

### Erro no iOS (permissão de câmera)

Adicione em `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Necessário para scanner QR</string>
```

---

## 📝 Próximos Passos

- [ ] Implementar Firebase Cloud Messaging (notificações push)
- [ ] Adicionar modo escuro
- [ ] Implementar geração de relatórios PDF
- [ ] Adicionar gráficos com charts_flutter
- [ ] Implementar gestão de clientes
- [ ] Adicionar suporte para impressoras térmicas

---

## 📞 Suporte

Para dúvidas ou problemas, entre em contato:
- Email: suporte@barmanager.com
- GitHub Issues: [BarManagerPro/issues](https://github.com/seu-usuario/BarManagerPro/issues)

---

**BarManager Pro** - Sistema de Gestão para Bares e Restaurantes 🍺
Guiné-Bissau © 2025
