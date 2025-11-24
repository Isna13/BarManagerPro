# Guia de Instalação e Deploy - BarManager Pro

## 📋 Pré-requisitos

### Desenvolvimento
- **Node.js** 18+ ([download](https://nodejs.org/))
- **pnpm** 8+ (npm install -g pnpm)
- **PostgreSQL** 14+ ([download](https://www.postgresql.org/download/))
- **Redis** (opcional, mas recomendado) ([download](https://redis.io/download))
- **Git** ([download](https://git-scm.com/))

### Mobile (Android)
- **Flutter SDK** 3.16+ ([guia](https://docs.flutter.dev/get-started/install))
- **Android Studio** + SDK Tools
- **Java JDK** 11+

### Desktop (Build)
- **Windows**: Nenhum adicional
- **Linux**: `sudo apt-get install libgtk-3-dev libnotify-dev`

---

## 🚀 Instalação Passo a Passo

### 1. Clone o Repositório

```powershell
git clone https://github.com/your-org/barmanager-pro.git
cd barmanager-pro
```

### 2. Instalar Dependências

```powershell
# Instalar pnpm globalmente (se ainda não tiver)
npm install -g pnpm

# Instalar todas dependências do monorepo
pnpm install
```

### 3. Configurar PostgreSQL

```powershell
# Criar banco de dados
psql -U postgres
CREATE DATABASE barmanager_prod;
CREATE USER barmanager WITH PASSWORD 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON DATABASE barmanager_prod TO barmanager;
\q
```

### 4. Configurar Variáveis de Ambiente

```powershell
cd apps/backend
Copy-Item .env.example .env
```

Edite `apps/backend/.env`:

```env
DATABASE_URL="postgresql://barmanager:SuaSenhaForte123!@localhost:5432/barmanager_prod"
JWT_SECRET="mude-para-um-secret-seguro-com-32-caracteres-ou-mais"
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### 5. Executar Migrations e Seed

```powershell
cd apps/backend
pnpm prisma:migrate
pnpm prisma:seed
```

### 6. Iniciar Backend

```powershell
cd apps/backend
pnpm dev

# API estará em http://localhost:3000/api/v1
```

### 7. Iniciar Desktop (Electron)

Em outro terminal:

```powershell
cd apps/desktop
pnpm dev
```

### 8. Build Mobile (Android)

```powershell
cd apps/mobile
flutter pub get
flutter run  # Para testar no emulador/dispositivo

# Build release
flutter build apk --release
# APK estará em: build/app/outputs/flutter-apk/app-release.apk
```

---

## 🏭 Deploy em Produção

### Backend (VPS / Cloud)

#### Opção 1: PM2 (Node.js Process Manager)

```bash
# No servidor
cd apps/backend
pnpm install --prod
pnpm build

# Instalar PM2
npm install -g pm2

# Configurar .env de produção
cp .env.example .env
nano .env  # Configurar variáveis

# Executar migrations
pnpm prisma:migrate deploy

# Iniciar com PM2
pm2 start dist/main.js --name barmanager-api
pm2 save
pm2 startup

# Nginx Reverse Proxy (opcional)
# /etc/nginx/sites-available/barmanager
server {
    listen 80;
    server_name api.barmanager.gw;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/barmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Opção 2: Docker

```dockerfile
# apps/backend/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```bash
# Build e deploy
docker build -t barmanager-backend .
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  --name barmanager-api \
  barmanager-backend
```

#### Opção 3: Railway / Heroku / Render

1. Crie conta em [Railway.app](https://railway.app) ou similar
2. Conecte repositório GitHub
3. Configure variáveis de ambiente
4. Deploy automático

---

### Desktop (Distribuição)

#### Windows Installer (NSIS)

```powershell
cd apps/desktop
pnpm build:win

# Instalador estará em: release/BarManager-Pro-Setup-1.0.0.exe
```

**Distribuir:**
- Upload para servidor ou Google Drive
- Criar link de download no site
- Opcional: Assinar digitalmente (Code Signing Certificate)

#### Linux (AppImage / .deb)

```bash
cd apps/desktop
pnpm build:linux

# Arquivos em: release/
# - BarManager-Pro-1.0.0.AppImage
# - barmanager-pro_1.0.0_amd64.deb
```

**Distribuir:**
- AppImage: direto via download
- .deb: adicionar ao repositório APT ou download direto

---

### Mobile (Google Play)

#### 1. Preparar Keystore

```bash
keytool -genkey -v -keystore barmanager-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias barmanager
```

#### 2. Configurar Gradle

`apps/mobile/android/app/build.gradle`:

```gradle
signingConfigs {
    release {
        keyAlias 'barmanager'
        keyPassword 'sua_senha'
        storeFile file('../barmanager-key.jks')
        storePassword 'sua_senha'
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        shrinkResources true
    }
}
```

#### 3. Build AAB (Android App Bundle)

```bash
flutter build appbundle --release
# Arquivo: build/app/outputs/bundle/release/app-release.aab
```

#### 4. Upload Google Play Console

1. Acesse [Google Play Console](https://play.google.com/console)
2. Criar novo app
3. Upload AAB
4. Preencher listing (descrição, screenshots)
5. Revisar e publicar

---

## 🔒 Segurança em Produção

### Checklist

- [ ] Mudar `JWT_SECRET` para valor aleatório forte
- [ ] Usar HTTPS (Let's Encrypt / Cloudflare)
- [ ] Firewall: liberar apenas portas necessárias (80, 443, 22)
- [ ] PostgreSQL: não expor publicamente, usar localhost
- [ ] Backups automáticos diários do banco
- [ ] Rate limiting habilitado (já configurado no NestJS)
- [ ] Monitoramento (PM2, Sentry, DataDog)
- [ ] CORS: restringir para domínios específicos

### Exemplo .env Produção

```env
NODE_ENV=production
DATABASE_URL="postgresql://barmanager:senha@localhost:5432/barmanager_prod"
JWT_SECRET="gere-com-openssl-rand-base64-32"
CORS_ORIGIN="https://barmanager.gw,https://app.barmanager.gw"
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

---

## 🔄 Atualizações

### Backend

```bash
# No servidor
cd barmanager-pro/apps/backend
git pull
pnpm install
pnpm prisma:migrate deploy
pm2 restart barmanager-api
```

### Desktop

Redistribuir novo instalador ou implementar auto-update com Electron.

### Mobile

Publicar nova versão no Google Play.

---

## 🐛 Troubleshooting

### Backend não inicia

```bash
# Verificar logs
pm2 logs barmanager-api

# Verificar conexão PostgreSQL
psql -U barmanager -d barmanager_prod -h localhost
```

### Electron não compila

```bash
# Limpar cache
rm -rf node_modules dist dist-electron
pnpm install
```

### Flutter build falha

```bash
# Limpar build
flutter clean
flutter pub get
flutter build apk --release
```

---

## 📞 Suporte

- **Email**: suporte@barmanager.gw
- **Documentação**: [docs.barmanager.gw](https://docs.barmanager.gw)
- **Issues**: [GitHub Issues](https://github.com/your-org/barmanager-pro/issues)
