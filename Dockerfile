# Dockerfile para Railway - BarManager Backend
# VERSÃO FINAL - Forçar limpeza total do store pnpm
FROM node:20-slim

# Cache bust V4 - FORÇA rebuild SEM qualquer cache
ENV CACHE_BUST=2025-11-29-v4

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates procps && \
    rm -rf /var/lib/apt/lists/*

# Instalar pnpm globalmente
RUN npm install -g pnpm@latest

WORKDIR /app

# Copiar APENAS os arquivos de configuração (SEM lockfile)
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma

# Definir plataforma alvo do Prisma ANTES da instalação
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"

# LIMPAR store do pnpm para evitar cache Alpine
RUN rm -rf ~/.local/share/pnpm/store /root/.local/share/pnpm/store || true

# Instalar dependências FORÇANDO reinstalação completa
RUN pnpm install --no-frozen-lockfile --force --filter=@barmanager/backend

# Copiar código fonte
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/nest-cli.json ./apps/backend/

# Mudar para o diretório do backend
WORKDIR /app/apps/backend

# DELETAR qualquer engine Prisma antiga que possa existir
RUN rm -rf node_modules/.prisma node_modules/@prisma/engines || true

# Gerar Prisma Client LIMPO (forçar download do engine Debian)
RUN npx prisma generate --force

# Compilar TypeScript
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# REGENERAR Prisma Client em RUNTIME para garantir engine Debian
CMD ["sh", "-c", "rm -rf node_modules/.prisma && npx prisma generate && (npx prisma migrate deploy || npx prisma db push --accept-data-loss) && node dist/main.js"]
