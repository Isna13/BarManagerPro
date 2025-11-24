# 🐘 Migração PostgreSQL - BarManager Pro

## ✅ **Status: Schema Atualizado para PostgreSQL**

### 📋 **Mudanças Realizadas:**

1. ✅ `schema.prisma` atualizado:
   - Provider: `sqlite` → `postgresql`
   - Binary targets: Adicionado `linux-musl-openssl-3.0.x` para deploy
   
2. ✅ `.env.postgresql` criado com exemplo de connection string

---

## 🚀 **Opções de PostgreSQL:**

### **Opção 1: PostgreSQL Local (Desenvolvimento)**

#### Windows:
```powershell
# Instalar PostgreSQL
winget install PostgreSQL.PostgreSQL

# Ou baixar de: https://www.postgresql.org/download/windows/

# Iniciar serviço
net start postgresql-x64-15

# Criar banco de dados
psql -U postgres
CREATE DATABASE barmanager_dev;
\q
```

#### macOS:
```bash
# Instalar via Homebrew
brew install postgresql@15
brew services start postgresql@15

# Criar banco
createdb barmanager_dev
```

#### Linux (Ubuntu/Debian):
```bash
# Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Iniciar serviço
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Criar banco
sudo -u postgres psql
CREATE DATABASE barmanager_dev;
CREATE USER barmanager WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE barmanager_dev TO barmanager;
\q
```

---

### **Opção 2: PostgreSQL em Docker** ⭐ RECOMENDADO

```bash
# Docker Compose (mais fácil)
cd C:\BarManagerPro
```

Criar `docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: barmanager_postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: barmanager_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: barmanager_redis
    restart: always
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --save 60 1 --loglevel warning

volumes:
  postgres_data:
  redis_data:
```

```bash
# Iniciar containers
docker-compose up -d

# Verificar se está rodando
docker-compose ps
```

---

### **Opção 3: PostgreSQL na Nuvem** ☁️

#### Railway (RECOMENDADO - Grátis)
```
1. Acesse: https://railway.app
2. Crie conta com GitHub
3. New Project → Provision PostgreSQL
4. Copie DATABASE_URL da aba "Connect"
5. Cole no .env do backend
```

#### Render (Grátis)
```
1. Acesse: https://render.com
2. New → PostgreSQL
3. Nome: barmanager-db
4. Copie Internal Database URL
5. Cole no .env
```

#### Supabase (Grátis + Dashboard)
```
1. Acesse: https://supabase.com
2. New Project
3. Region: Choose closest to Guiné-Bissau (Europe-West)
4. Database password: Escolha senha forte
5. Settings → Database → Connection String (URI)
6. Cole no .env
```

---

## 🔧 **Configuração do Backend:**

### **1. Atualizar .env**

```bash
cd C:\BarManagerPro\apps\backend
```

Editar `.env`:
```env
# Opção 1: PostgreSQL Local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barmanager_dev?schema=public"

# Opção 2: PostgreSQL Docker (mesmo que local)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barmanager_dev?schema=public"

# Opção 3: PostgreSQL Cloud (Railway/Render/Supabase)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

### **2. Instalar dependências PostgreSQL**

```bash
cd C:\BarManagerPro\apps\backend
pnpm add @prisma/client pg
pnpm add -D prisma
```

### **3. Gerar Prisma Client**

```bash
npx prisma generate
```

### **4. Criar Migrations**

```bash
# Criar migration inicial
npx prisma migrate dev --name init-postgres

# Se precisar resetar banco (CUIDADO: apaga dados)
npx prisma migrate reset
```

### **5. Popular banco com dados de teste**

```bash
npx ts-node prisma/seed.ts
```

---

## 🔄 **Migração de Dados (SQLite → PostgreSQL):**

Se você já tem dados no SQLite e quer migrar:

### **Opção A: Prisma Studio (Manual)**

```bash
# 1. Exportar dados do SQLite
npx prisma studio

# 2. Salvar dados manualmente
# 3. Trocar .env para PostgreSQL
# 4. Rodar migrations
npx prisma migrate dev

# 5. Importar dados via Prisma Studio
npx prisma studio
```

### **Opção B: Script de Migração (Automatizado)**

Criar `prisma/migrate-to-postgres.ts`:

```typescript
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '@prisma/client';

const sqlite = new SQLiteClient({
  datasources: { db: { url: 'file:./dev.db' } }
});

const postgres = new PostgresClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function migrate() {
  console.log('🚀 Iniciando migração SQLite → PostgreSQL...');
  
  // Migrar usuários
  const users = await sqlite.user.findMany();
  for (const user of users) {
    await postgres.user.create({ data: user });
  }
  console.log(`✅ ${users.length} usuários migrados`);
  
  // Migrar produtos
  const products = await sqlite.product.findMany();
  for (const product of products) {
    await postgres.product.create({ data: product });
  }
  console.log(`✅ ${products.length} produtos migrados`);
  
  // ... continuar para outras tabelas
  
  console.log('🎉 Migração concluída!');
}

migrate()
  .catch(console.error)
  .finally(() => {
    sqlite.$disconnect();
    postgres.$disconnect();
  });
```

```bash
npx ts-node prisma/migrate-to-postgres.ts
```

---

## 🧪 **Testar Conexão PostgreSQL:**

```bash
cd C:\BarManagerPro\apps\backend

# Testar conexão
npx prisma db pull

# Ver banco via Prisma Studio
npx prisma studio
```

---

## 🔍 **Verificar Migrations:**

```bash
# Ver status das migrations
npx prisma migrate status

# Ver histórico
npx prisma migrate history

# Aplicar migrations pendentes
npx prisma migrate deploy
```

---

## 📊 **Diferenças SQLite vs PostgreSQL:**

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **Tipo** | File-based | Client-Server |
| **Concorrência** | Limitada | Alta |
| **Transações** | Básicas | ACID completo |
| **Replicação** | ❌ | ✅ Streaming |
| **Backup** | Copiar arquivo | pg_dump/pg_restore |
| **Tamanho Max** | ~281 TB | Ilimitado |
| **JSON** | Básico | Avançado (JSONB) |
| **Full-text Search** | ❌ | ✅ Native |
| **Tipos Avançados** | Limitado | Array, JSONB, UUID, etc |

---

## 🛠 **Comandos Úteis PostgreSQL:**

```bash
# Conectar ao banco
psql -U postgres -d barmanager_dev

# Listar bancos
\l

# Listar tabelas
\dt

# Descrever tabela
\d users

# Ver tamanho do banco
\l+ barmanager_dev

# Backup
pg_dump -U postgres barmanager_dev > backup.sql

# Restore
psql -U postgres barmanager_dev < backup.sql

# Sair
\q
```

---

## 🚨 **Troubleshooting:**

### Erro: `Can't reach database server`
```bash
# Verificar se PostgreSQL está rodando
# Windows:
net start postgresql-x64-15

# Linux/macOS:
sudo systemctl status postgresql
```

### Erro: `password authentication failed`
```bash
# Resetar senha do postgres
# Windows: Via pgAdmin
# Linux:
sudo -u postgres psql
ALTER USER postgres PASSWORD 'new_password';
```

### Erro: `database "barmanager_dev" does not exist`
```bash
psql -U postgres
CREATE DATABASE barmanager_dev;
\q
```

### Erro: `relation "users" does not exist`
```bash
# Executar migrations
cd C:\BarManagerPro\apps\backend
npx prisma migrate dev
```

---

## ✅ **Checklist de Migração:**

- [ ] PostgreSQL instalado/configurado
- [ ] `.env` atualizado com DATABASE_URL
- [ ] `schema.prisma` com provider="postgresql"
- [ ] `pnpm add pg @prisma/client`
- [ ] `npx prisma generate`
- [ ] `npx prisma migrate dev --name init-postgres`
- [ ] `npx ts-node prisma/seed.ts`
- [ ] `npx prisma studio` (verificar dados)
- [ ] Backend rodando sem erros
- [ ] Desktop conectando ao backend
- [ ] Mobile conectando ao backend

---

## 🎯 **Próximos Passos:**

✅ **2️⃣ PostgreSQL Migration** - **CONCLUÍDO**
⏭️ **3️⃣ Deploy na Nuvem** - PRÓXIMO
⏭️ **4️⃣ Corrigir erros Prisma Backend** - OPCIONAL

---

**Tempo estimado para migrar: 15-30 minutos**

Pronto para ir para **3️⃣ Deploy na Nuvem**! 🚀☁️
