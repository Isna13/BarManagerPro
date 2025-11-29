# Dockerfile para Railway - BarManager Backend
# Updated: 2025-11-29 - Usar Debian Slim para melhor compatibilidade com Prisma
FROM node:20-slim

# Instalar OpenSSL e outras dependências necessárias para Prisma
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@latest

WORKDIR /app

# Copiar arquivos do workspace root (Prisma 5.22.0)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Copiar schema do Prisma ANTES de instalar dependências
COPY apps/backend/prisma ./apps/backend/prisma

# Instalar dependências
RUN pnpm install --no-frozen-lockfile --filter=@barmanager/backend...

# Copiar resto do código do backend
COPY apps/backend ./apps/backend

# Gerar Prisma Client (FORÇAR regeneração para Linux Debian, não Alpine)
WORKDIR /app/apps/backend
RUN rm -rf node_modules/.prisma node_modules/@prisma/client
RUN pnpm prisma:generate

# Build usando script Docker que usa tsconfig.build.json standalone
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# Comando de inicialização (migrate deploy é mais seguro que db push em produção)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
