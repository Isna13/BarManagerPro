# BarManager Pro — Guiné-Bissau

Sistema completo de gestão para bares/restaurantes **offline-first** com sincronização automática em **Desktop (Electron)** e **Mobile (Flutter Android)**.

> **🚀 NOVIDADE**: Backend agora pronto para **cloud hosting** com acesso remoto via WiFi/internet de qualquer lugar!

## 🌍 Características Principais

### Funcionalidades Core
- ✅ **PDV Balcão e Mesas** - Interface intuitiva para vendas rápidas
- ✅ **Sistema Muntu** - Vendas por caixa com economia por volume
- ✅ **Inventário Caixas ↔ Unidades** - Conversão automática e precisa
- ✅ **Caixa e Fechamento** - Gestão completa do fluxo de caixa
- ✅ **Dívidas/Fiados** - Controle de crédito com limites por cliente
- ✅ **Multi-filial** - Gestão centralizada de várias unidades
- ✅ **Backup Automático** - Segurança de dados com criptografia AES-256
- ✅ **🆕 Modo Online/Offline** - Funciona sem internet com sincronização automática
- ✅ **🆕 Multi-Usuário** - Múltiplos PCs acessando simultaneamente
- ✅ **🆕 App Mobile Android** - Gestão completa do celular com notificações push

### Sistema de Sincronização (v1.1.0) 🆕
- 🟢 **Indicador Visual** - Status online/offline em tempo real
- 🔄 **Sincronização Automática** - Ao reconectar, dados sincronizam automaticamente
- 📱 **Trabalho Offline** - Todas as operações funcionam sem internet
- 🗂️ **Fila de Sincronização** - Zero perda de dados garantida
- 👥 **Multi-Usuário** - Vários PCs podem acessar simultaneamente
- ⚡ **Sincronização Rápida** - Itens enviados a cada 30 segundos quando online
- 🔄 **Sincronização Manual** - Botão para forçar sincronização imediata

### Funcionalidades Avançadas
- 🔮 **Previsão de Demanda** - Forecasting com ML para reordenação automática
- 📱 **QR Menu Digital** - Cardápio multilíngue com pedidos diretos
- 👨‍🍳 **App Garçons** - Android/PWA para tomada de pedidos
- 🎁 **Programa de Fidelidade** - Pontos, cupons e campanhas segmentadas
- 📊 **Business Intelligence** - Dashboards interativos e análises avançadas
- 💰 **Mobile Money** - Integração Orange Money e TeleTaku
- 🖨️ **KDS (Kitchen Display)** - Roteamento inteligente para cozinha/bar
- 🔐 **Auditoria Avançada** - Logs imutáveis e 2FA opcional

### Localização Guiné-Bissau
- 🌐 **Multilíngue**: Português, Kriol, Francês
- 💵 **Moeda**: FCFA (XOF) - sem decimais por padrão
- 📅 **Formato**: DD/MM/YYYY, Timezone GMT+0
- 📞 **Validação**: Telefone +245, NIF local
- 📄 **Documentos**: Templates fiscais customizáveis

---

## 🏗️ Arquitetura

```
BarManagerPro/
├── apps/
│   ├── backend/          # NestJS + PostgreSQL + Prisma
│   ├── desktop/          # Electron + React + SQLite
│   ├── mobile/           # Flutter (Android/iOS)
│   └── pwa/              # Progressive Web App
├── packages/
│   ├── shared/           # Tipos e utils compartilhados
│   └── types/            # TypeScript definitions
└── docs/                 # Documentação completa
```

### Stack Tecnológico

**Backend**
- Node.js 18+ + NestJS (modular, escalável)
- PostgreSQL (dados centrais) + Redis (filas)
- Prisma ORM (migrations, tipos)
- WebSocket + REST API
- JWT + bcrypt + TLS

**Desktop (Electron)**
- Electron 28+
- React 18 + TypeScript
- SQLite local (WAL mode)
- Sincronização offline-first
- Impressão térmica (ESC/POS)

**Mobile (Flutter)**
- Flutter 3.16+
- SQLite (sqflite)
- Provider/Riverpod para estado
- FCM para notificações push

**PWA**
- React/Vue + Service Workers
- IndexedDB para cache offline
- Responsivo e leve

---

## 🔄 Sistema de Sincronização Online/Offline (v1.1.0)

### Visão Geral

O BarManager Pro agora possui um sistema completo de sincronização que garante:

- ✅ **Funcionamento offline completo** quando não há internet
- ✅ **Sincronização automática** ao reconectar à internet
- ✅ **Múltiplos usuários** podem acessar simultaneamente de PCs diferentes
- ✅ **Zero perda de dados** - todas as operações são enfileiradas
- ✅ **Indicador visual** de status online/offline em tempo real

### Indicador de Status

**Localização**: Canto superior esquerdo da sidebar, logo abaixo do nome do usuário

| Visual | Status | Descrição |
|--------|--------|-----------|
| 🟢 Verde (pulsante) | **Online** | Sistema conectado e sincronizado |
| 🔴 Vermelho | **Offline** | Sem conexão - modo offline ativo |
| 🟡 Amarelo (pulsante) | **Sincronizando** | Sincronização em andamento |
| 🟠 Laranja | **Erro** | Erro na última sincronização |

**Informações Exibidas**:
- Status textual ("Online", "Offline", "Sincronizando...")
- Última sincronização realizada ("Agora mesmo", "5m atrás", etc.)
- Número de itens pendentes para sincronização
- Botão para forçar sincronização manual (quando online)

### Como Funciona

#### Modo Offline
1. Sistema detecta perda de conexão automaticamente
2. Todas as operações continuam funcionando normalmente
3. Dados são salvos no SQLite local
4. Operações são adicionadas à **fila de sincronização**
5. Indicador mostra status "Offline" e número de itens pendentes

#### Reconexão Automática
1. Sistema detecta restauração da conexão
2. Sincronização inicia automaticamente
3. Indicador mostra "Sincronizando..." (amarelo)
4. Todos os itens da fila são enviados ao backend
5. Indicador volta para "Online" (verde)
6. Itens pendentes zerados

#### Multi-Usuário
- Cada PC mantém seu banco SQLite local
- Sincronização com backend PostgreSQL central
- Suporte a múltiplas filiais (branch_id)
- Resolução de conflitos por timestamp

### Documentação Completa

Para mais detalhes sobre o sistema de sincronização, consulte:

- **[SYNC_SYSTEM.md](docs/SYNC_SYSTEM.md)** - Documentação técnica completa (500+ linhas)
- **[ONLINE_OFFLINE_SUMMARY.md](ONLINE_OFFLINE_SUMMARY.md)** - Resumo executivo da implementação
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Guia completo de testes
- **[CHANGELOG.md](CHANGELOG.md)** - Histórico de mudanças
- **🆕 [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md)** - Deploy em produção (Railway/Cloud)
- **🆕 [NETWORK_SETUP.md](NETWORK_SETUP.md)** - Configuração de rede local/remota

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Redis (opcional)
- Flutter SDK 3.16+ (para mobile)

### 1. Instalar Dependências

```powershell
# Clone o repositório
git clone https://github.com/your-org/barmanager-pro.git
cd barmanager-pro

# Instalar dependências do monorepo
pnpm install
```

### 2. Configurar Backend

```powershell
cd apps/backend

# Copiar .env.example para .env
Copy-Item .env.example .env

# Editar .env com suas configurações
# DATABASE_URL, JWT_SECRET, etc.

# Executar migrations
pnpm prisma:migrate

# Seed inicial (roles, permissions, filiais)
pnpm prisma:seed
```

### 3. Iniciar Backend

```powershell
cd apps/backend
pnpm dev

# API estará em http://localhost:3000/api/v1
# Health check: http://localhost:3000/api/v1/health
```

### ☁️ Deploy em Produção (Cloud)

Para hospedar o backend na nuvem e permitir acesso remoto:

```powershell
# 1. Consultar guia completo
# Ver: PRODUCTION_DEPLOY.md

# 2. Testar funcionalidades localmente
./apps/backend/test-production-features.ps1

# 3. Deploy no Railway (recomendado)
# - Criar projeto no railway.app
# - Adicionar PostgreSQL
# - Configurar variáveis de ambiente
# - Deploy automático via GitHub
```

**Recursos de Produção:**
- ✅ Rate limiting (100 req/min)
- ✅ HTTP request logging
- ✅ Health checks (/health, /health/ping)
- ✅ Graceful shutdown
- ✅ Security headers (Helmet)
- ✅ CORS configurável
- ✅ Database connection pooling

### 4. Iniciar Desktop (Electron)

```powershell
cd apps/desktop
pnpm dev

# Abrirá app Electron conectado ao backend
```

### 5. Build Mobile (Flutter)

```powershell
cd apps/mobile

# Android
flutter build apk --release

# iOS (necessita MacOS + Xcode)
flutter build ios --release
```

---

## 📦 Estrutura do Backend

### Módulos Principais

```
src/
├── auth/              # Autenticação JWT
├── users/             # Gestão de usuários
├── branches/          # Multi-filial
├── products/          # Catálogo de produtos
├── inventory/         # Estoque e movimentos
├── sales/             # Vendas e PDV
├── cash-box/          # Caixa
├── customers/         # Clientes
├── debts/             # Dívidas/fiados
├── suppliers/         # Fornecedores
├── purchases/         # Compras
├── forecast/          # Previsão de demanda
├── loyalty/           # Fidelidade
├── campaigns/         # Marketing
├── feedback/          # Satisfação
├── qr-menu/           # Menu digital
├── sync/              # Sincronização
├── notifications/     # Push/Email/WhatsApp
├── reports/           # Relatórios e BI
├── backup/            # Backups
├── audit/             # Auditoria
└── websocket/         # Real-time events
```

### Database Schema (Prisma)

Principais entidades:
- `User`, `Role`, `Permission`, `Session`
- `Branch`, `Product`, `Category`, `InventoryItem`
- `Sale`, `SaleItem`, `Payment`
- `CashBox`, `Customer`, `Debt`
- `Supplier`, `Purchase`
- `ForecastItem`, `LoyaltyTransaction`, `Campaign`
- `SyncQueue`, `AuditLog`, `Backup`

---

## 🔄 Sincronização Offline-First

### Como Funciona

1. **Operações Locais**: Todas operações críticas (vendas, pagamentos) são salvas primeiro no SQLite local
2. **Fila de Sincronização**: Cada operação é enfileirada com prioridade (1=alta, 10=baixa)
3. **Upload Automático**: A cada 30s (configurável), itens pendentes são enviados ao servidor
4. **Resolução de Conflitos**:
   - Por timestamp (last-write-wins)
   - Regras manuais para casos críticos (UI para resolver)
5. **Download de Mudanças**: Puxa mudanças do servidor desde última sincronização

### Prioridades de Sincronização

| Prioridade | Tipo de Operação |
|------------|------------------|
| 1 (Alta)   | Vendas, Pagamentos, Fechamento de Caixa |
| 2          | Compras, Movimentos de Estoque |
| 3          | Cadastros (Clientes, Produtos) |
| 5 (Normal) | Relatórios, Logs |
| 10 (Baixa) | Anexos, Imagens |

---

## 📱 Mobile App (Flutter)

### Recursos

- **Dashboard Dono/Gerente**: KPIs em tempo real, alertas, vendas do dia
- **App Garçons**: Tomar pedidos, dividir conta, transferir mesas
- **Inventário**: Contagem física, ajustes, transferências
- **Notificações Push**: Alertas de estoque, vendas, dívidas

### Instalação APK

1. Build: `flutter build apk --release`
2. APK estará em `build/app/outputs/flutter-apk/app-release.apk`
3. Distribuir via: Google Play, Firebase App Distribution ou download direto

---

## 🖨️ Impressão Térmica

### Configuração

1. Adicionar impressora nas **Configurações → Impressoras**
2. Configurar IP e porta (ex: `192.168.1.100:9100`)
3. Definir roteamento (recibo, cozinha, bar)

### Tipos de Impressão

- **Recibo**: Cliente (80mm)
- **Cozinha**: Pedidos para preparo
- **Bar**: Bebidas
- **KDS**: Display em tela

---

## 📊 Relatórios e BI

### Dashboards Disponíveis

- Vendas por período/filial/produto
- Margem de lucro por categoria
- Top 10 produtos mais vendidos
- Clientes com maior dívida
- Heatmap de vendas por hora/dia
- Projeção de fluxo de caixa (7/30/90 dias)

### Exportação

- PDF (relatórios formatados)
- Excel (dados brutos)
- CSV (importação contábil)

---

## 🔐 Segurança

- **Autenticação**: JWT com expiração configurável
- **Senhas**: bcrypt (10 rounds)
- **TLS**: Comunicação criptografada
- **2FA**: Opcional para admins
- **Auditoria**: Logs imutáveis de todas operações críticas
- **Backup**: AES-256 para backups remotos
- **Roles & Permissions**: Controle granular

### Roles Padrão

- `admin`: Acesso total
- `manager`: Gestão operacional
- `cashier`: PDV e vendas
- `waiter`: Pedidos e mesas
- `owner`: Visualização e relatórios

---

## 🌐 API REST

### Base URL
```
http://localhost:3000/api/v1
```

### Endpoints Principais

```
POST   /auth/login
POST   /auth/logout
GET    /auth/validate

GET    /products
POST   /products
GET    /products/:id

GET    /sales
POST   /sales
POST   /sales/:id/items
POST   /sales/:id/payments
POST   /sales/:id/close

GET    /inventory
PUT    /inventory/:id

GET    /customers
POST   /customers
GET    /customers/:id/debts

GET    /reports/sales?startDate=&endDate=
GET    /reports/inventory
```

### Autenticação

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barmanager.gw","password":"password123"}'

# Usar token
curl -X GET http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🧪 Testes

```powershell
# Backend
cd apps/backend
pnpm test              # Unit tests
pnpm test:e2e          # End-to-end
pnpm test:cov          # Coverage

# Desktop
cd apps/desktop
pnpm test

# Mobile
cd apps/mobile
flutter test
```

---

## 🚢 Deploy

### Backend (Produção)

```powershell
# Build
cd apps/backend
pnpm build

# Deploy (exemplo com PM2)
pm2 start dist/main.js --name barmanager-api

# Ou Docker
docker build -t barmanager-backend .
docker run -p 3000:3000 barmanager-backend
```

### Desktop (Distribuição)

```powershell
cd apps/desktop

# Windows
pnpm build:win  # Gera instalador NSIS em /release

# Linux
pnpm build:linux  # Gera AppImage e .deb
```

### Mobile (Google Play)

1. Assinar APK/AAB
2. Upload para Google Play Console
3. Configurar releases (beta/produção)

---

## 📚 Documentação Adicional

- [Guia de Contribuição](docs/CONTRIBUTING.md)
- [Roadmap e Releases](docs/ROADMAP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

## 🙋 Suporte

- **Email**: suporte@barmanager.gw
- **WhatsApp**: +245 XXX XXX XXX
- **Documentação**: https://docs.barmanager.gw

---

## 🎯 Roadmap

### MVP (8-12 semanas) ✅
- [x] Backend NestJS + Prisma
- [x] Desktop Electron + SQLite
- [x] Vendas balcão e mesas
- [x] Sistema Muntu
- [x] Inventário caixas↔unidades
- [x] Sincronização offline-first
- [x] Impressão térmica

### Fase 2 (12-20 semanas) 🚧
- [ ] Mobile Flutter (Android)
- [ ] App Garçons
- [ ] QR Menu
- [ ] Mobile Money (Orange/TeleTaku)
- [ ] KDS
- [ ] Notificações push
- [ ] BI básico

### Fase 3 (Contínuo) 📋
- [ ] Forecasting + ML
- [ ] Fidelidade e campanhas
- [ ] Multi-unidade completo
- [ ] PWA
- [ ] Integração contábil
- [ ] iOS
- [ ] Escalabilidade cloud

---

**Desenvolvido com ❤️ para bares e restaurantes da Guiné-Bissau**
