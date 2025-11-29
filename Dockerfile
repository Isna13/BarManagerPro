# Dockerfile para Railway - BarManager Backend
# Updated: 2025-11-29 - Force rebuild with Prisma 5.22.0
FROM node:20-alpine

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos do workspace root (Prisma 5.22.0)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/

# Copiar schema do Prisma ANTES de instalar dependências
COPY apps/backend/prisma ./apps/backend/prisma

# Instalar dependências (agora o prisma generate vai funcionar)
RUN pnpm install --no-frozen-lockfile --filter=@barmanager/backend...

# Copiar resto do código do backend
COPY apps/backend ./apps/backend

# Gerar Prisma Client
WORKDIR /app/apps/backend
RUN pnpm prisma:generate

# Build
RUN pnpm build

# Expor porta
EXPOSE 3000

# Comando de inicialização
CMD ["sh", "-c", "pnpm prisma db push --accept-data-loss && pnpm start:prod"]
