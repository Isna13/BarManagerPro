# Dockerfile para Railway - BarManager Backend
# Updated: 2025-11-29 - Usar Debian Slim para melhor compatibilidade com Prisma
FROM node:20-slim

# Instalar OpenSSL e outras dependências necessárias para Prisma
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@latest

WORKDIR /app

# Copiar arquivos do workspace root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Copiar schema do Prisma
COPY apps/backend/prisma ./apps/backend/prisma

# Instalar dependências (pnpm vai baixar engine Debian do Prisma)
RUN pnpm install --frozen-lockfile=false --filter=@barmanager/backend...

# Copiar código fonte do backend
COPY apps/backend ./apps/backend

# Gerar Prisma Client com engine Debian
WORKDIR /app/apps/backend
RUN npx prisma generate

# Build da aplicação
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# Comando de inicialização (migrate deploy é mais seguro que db push em produção)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
