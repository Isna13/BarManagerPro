# Scripts de Utilidade - BarManager Pro

## 🛠️ Scripts Disponíveis

### Backend

```powershell
# Desenvolvimento
pnpm --filter @barmanager/backend dev

# Build
pnpm --filter @barmanager/backend build

# Testes
pnpm --filter @barmanager/backend test
pnpm --filter @barmanager/backend test:e2e
pnpm --filter @barmanager/backend test:cov

# Prisma
pnpm --filter @barmanager/backend prisma:generate
pnpm --filter @barmanager/backend prisma:migrate
pnpm --filter @barmanager/backend prisma:studio
pnpm --filter @barmanager/backend prisma:seed

# Lint
pnpm --filter @barmanager/backend lint
```

### Desktop

```powershell
# Desenvolvimento
pnpm --filter @barmanager/desktop dev

# Build
pnpm --filter @barmanager/desktop build
pnpm --filter @barmanager/desktop build:win
pnpm --filter @barmanager/desktop build:linux

# Preview
pnpm --filter @barmanager/desktop preview
```

### Mobile

```bash
# Get dependencies
cd apps/mobile
flutter pub get

# Run (dev)
flutter run

# Build Android
flutter build apk --release
flutter build appbundle --release

# Build iOS
flutter build ios --release

# Tests
flutter test
```

### Global (Monorepo)

```powershell
# Instalar tudo
pnpm install

# Build all
pnpm build

# Lint all
pnpm lint

# Test all
pnpm test

# Clean
pnpm clean
```

---

## 📝 Scripts Customizados

### Seed Database

`apps/backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Criar roles padrão
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrador completo',
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      description: 'Gerente de filial',
      isSystem: true,
    },
  });

  // Criar permissões
  const permissions = [
    { resource: 'sales', action: 'create' },
    { resource: 'sales', action: 'read' },
    { resource: 'sales', action: 'update' },
    { resource: 'sales', action: 'delete' },
    { resource: 'inventory', action: 'create' },
    { resource: 'inventory', action: 'read' },
    { resource: 'inventory', action: 'update' },
    { resource: 'reports', action: 'read' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }

  // Criar filial principal
  const mainBranch = await prisma.branch.upsert({
    where: { code: 'HQ001' },
    update: {},
    create: {
      code: 'HQ001',
      name: 'Filial Principal',
      isHeadquarter: true,
      isActive: true,
    },
  });

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@barmanager.gw' },
    update: {},
    create: {
      email: 'admin@barmanager.gw',
      password: hashedPassword,
      fullName: 'Administrador',
      roleId: adminRole.id,
      branchId: mainBranch.id,
      language: 'pt',
    },
  });

  console.log('✅ Seeding completo!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Execute:
```powershell
cd apps/backend
pnpm prisma:seed
```

---

## 🔄 Backup e Restore

### Backup Manual

```powershell
# PostgreSQL
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
pg_dump -U barmanager barmanager_prod > "backup_$timestamp.sql"

# Compactar
Compress-Archive -Path "backup_$timestamp.sql" -DestinationPath "backup_$timestamp.zip"
```

### Restore

```powershell
# Descompactar
Expand-Archive -Path backup_2024-11-24.zip -DestinationPath ./restore

# Restaurar
psql -U barmanager barmanager_prod < ./restore/backup_2024-11-24.sql
```

### Script Automático (Windows Task Scheduler)

`scripts/backup.ps1`:

```powershell
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = "C:\BarManagerBackups"
$backupFile = "$backupDir\backup_$timestamp.sql"

# Criar diretório se não existir
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}

# Backup
pg_dump -U barmanager barmanager_prod > $backupFile

# Compactar
Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip"
Remove-Item $backupFile

# Limpar backups antigos (>30 dias)
Get-ChildItem -Path $backupDir -Filter "*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item
```

Agendar:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\scripts\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "BarManager-Backup" -Description "Backup diário BarManager Pro"
```

---

## 🧪 Scripts de Teste

### Teste de Carga (API)

`scripts/load-test.js`:

```javascript
// Usando Artillery
// npm install -g artillery

// artillery.yml
config:
  target: "http://localhost:3000/api/v1"
  phases:
    - duration: 60
      arrivalRate: 10
  http:
    timeout: 30
scenarios:
  - name: "Login e criar venda"
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "admin@barmanager.gw"
            password: "admin123"
          capture:
            - json: "$.accessToken"
              as: "token"
      - post:
          url: "/sales"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            branchId: "{{$randomUUID()}}"
            type: "counter"
```

Execute:
```bash
artillery run artillery.yml
```

---

## 📊 Monitoramento

### Health Check

`apps/backend/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  }
}
```

### Uptime Monitor (UptimeRobot)

Configure webhook:
```
https://api.barmanager.gw/health
```

---

**Scripts mantidos por**: Equipe BarManager Pro
