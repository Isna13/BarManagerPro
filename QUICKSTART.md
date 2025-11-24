# 🚀 Guia Rápido de Início - BarManager Pro

## Status Atual

✅ **Projeto criado e estruturado**
✅ **Dependências instaladas (pnpm)**
❌ **PostgreSQL não instalado**

## Opções para Começar

### Opção 1: Usar SQLite (Mais Rápido - Recomendado para Testes)

SQLite não requer instalação de servidor, perfeito para desenvolvimento inicial.

**Vantagens:**
- Sem configuração adicional
- Funciona imediatamente
- Ideal para desenvolvimento local

**Desvantagens:**
- Menos recursos que PostgreSQL
- Não recomendado para produção multi-usuário

### Opção 2: Instalar PostgreSQL (Recomendado para Produção)

**Baixar PostgreSQL:**
- https://www.postgresql.org/download/windows/
- Ou usar: `winget install PostgreSQL.PostgreSQL`

---

## 🎯 Início Rápido com SQLite

### 1. Configurar SQLite

```powershell
cd C:\BarManagerPro\apps\backend
```

Edite o arquivo `.env` e altere a linha `DATABASE_URL`:

**De:**
```
DATABASE_URL="postgresql://barmanager:password@localhost:5432/barmanager_prod?schema=public"
```

**Para:**
```
DATABASE_URL="file:./dev.db"
```

### 2. Atualizar Prisma Schema

Edite `apps/backend/prisma/schema.prisma` e altere:

**De:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Para:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 3. Executar Migrations e Seed

```powershell
cd C:\BarManagerPro\apps\backend

# Gerar Prisma Client
pnpm prisma:generate

# Criar database e tabelas
pnpm prisma:migrate dev --name init

# Popular com dados iniciais
pnpm prisma:seed
```

### 4. Iniciar Backend

```powershell
pnpm dev
```

O backend estará disponível em: **http://localhost:3000/api/v1**

### 5. Testar Login

Abra outro PowerShell e teste:

```powershell
$body = @{
    email = "admin@barmanager.gw"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

### 6. Iniciar Desktop App

Em outro terminal:

```powershell
cd C:\BarManagerPro\apps\desktop
pnpm dev
```

---

## 🐘 Configuração com PostgreSQL (Opcional)

Se preferir usar PostgreSQL desde o início:

### 1. Instalar PostgreSQL

**Usando winget:**
```powershell
winget install PostgreSQL.PostgreSQL
```

**Ou baixe manualmente:**
https://www.postgresql.org/download/windows/

Durante a instalação:
- Senha do superusuário (postgres): anote esta senha!
- Porta: 5432 (padrão)

### 2. Criar Database

```powershell
# Abrir psql
psql -U postgres

# Dentro do psql:
CREATE DATABASE barmanager_prod;
CREATE USER barmanager WITH PASSWORD 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON DATABASE barmanager_prod TO barmanager;
\q
```

### 3. Configurar .env

Edite `apps/backend/.env`:

```env
DATABASE_URL="postgresql://barmanager:SuaSenhaForte123!@localhost:5432/barmanager_prod?schema=public"
```

### 4. Executar Migrations

```powershell
cd C:\BarManagerPro\apps\backend
pnpm prisma:generate
pnpm prisma:migrate dev --name init
pnpm prisma:seed
```

---

## 📱 Mobile (Flutter)

### Pré-requisitos

1. **Instalar Flutter:**
   - https://docs.flutter.dev/get-started/install/windows

2. **Instalar Android Studio:**
   - https://developer.android.com/studio

### Executar Mobile

```powershell
cd C:\BarManagerPro\apps\mobile

# Obter dependências
flutter pub get

# Conectar dispositivo/emulador Android e executar
flutter run
```

---

## 🔧 Troubleshooting

### Erro: "pnpm not found"
```powershell
npm install -g pnpm
```

### Erro: Prisma Client não gerado
```powershell
cd apps\backend
pnpm prisma:generate
```

### Erro: Port 3000 em uso
```powershell
# Encontrar processo
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Parar processo
Stop-Process -Id <PID>
```

### Desktop não inicia
```powershell
cd apps\desktop
rm -r node_modules
pnpm install
pnpm dev
```

---

## 📊 Credenciais Padrão

Após executar o seed:

**Email:** `admin@barmanager.gw`  
**Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere estas credenciais em produção!

---

## 🎯 Próximos Passos

1. ✅ Escolher SQLite ou PostgreSQL
2. ✅ Executar migrations e seed
3. ✅ Iniciar backend
4. ✅ Testar login via API
5. ✅ Iniciar desktop app
6. ✅ Fazer login no desktop
7. 🚧 Implementar módulos restantes
8. 🚧 Completar UI desktop
9. 🚧 Desenvolver mobile app

---

## 📚 Documentação Completa

- **README.md** - Visão geral do projeto
- **docs/INSTALL.md** - Instalação e deploy
- **docs/ARCHITECTURE.md** - Arquitetura do sistema
- **docs/SCRIPTS.md** - Scripts úteis

---

**Criado em:** 24 de novembro de 2024  
**Equipe:** BarManager Pro
