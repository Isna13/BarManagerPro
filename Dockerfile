# Dockerfile para Railway - BarManager Backend
# Updated: 2025-11-29 - Forçar rebuild completo sem cache Alpine
FROM node:20-slim

# FORÇAR INVALIDAÇÃO DE CACHE - Mudar este número força rebuild completo
ENV CACHE_BUST=2025-11-29-v2

# Instalar OpenSSL e outras dependências necessárias para Prisma
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@latest

WORKDIR /app

# Copiar arquivos do workspace root (SEM lockfile para forçar reinstalação)
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Copiar schema do Prisma
COPY apps/backend/prisma ./apps/backend/prisma

# FORÇAR Prisma a usar engine Debian através de variável de ambiente
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Limpar COMPLETAMENTE qualquer cache anterior do pnpm
RUN pnpm store prune || true

# Instalar dependências SEM lockfile (forçará download da engine Debian)
RUN pnpm install --no-frozen-lockfile --filter=@barmanager/backend...

# Copiar código fonte do backend
COPY apps/backend ./apps/backend

# Gerar Prisma Client FORÇANDO engine Debian (limpar cache primeiro)
WORKDIR /app/apps/backend
RUN rm -rf node_modules/.prisma node_modules/@prisma || true
RUN npx prisma generate --force

# Build da aplicação
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# Comando de inicialização (migrate deploy é mais seguro que db push em produção)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
