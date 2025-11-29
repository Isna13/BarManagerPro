# Dockerfile para Railway - BarManager Backend
# Updated: 2025-11-29 - Fix bcrypt rebuild command
FROM node:20-alpine

# Instalar dependências de build para módulos nativos (bcrypt, etc)
RUN apk add --no-cache python3 make g++

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos do workspace root (Prisma 5.22.0)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Copiar schema do Prisma ANTES de instalar dependências
COPY apps/backend/prisma ./apps/backend/prisma

# Instalar dependências (agora o prisma generate vai funcionar)
RUN pnpm install --no-frozen-lockfile --filter=@barmanager/backend...

# Rebuild módulos nativos para Alpine Linux
RUN cd apps/backend && pnpm rebuild bcrypt

# Copiar resto do código do backend
COPY apps/backend ./apps/backend

# Gerar Prisma Client
WORKDIR /app/apps/backend
RUN pnpm prisma:generate

# Build usando script Docker que usa tsconfig.build.json standalone
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# Comando de inicialização (migrate deploy é mais seguro que db push em produção)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
