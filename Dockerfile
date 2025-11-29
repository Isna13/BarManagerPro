# Dockerfile para Railway - BarManager Backend
# Versão SIMPLIFICADA - Debian com instalação limpa
FROM node:20-slim

# Cache bust para forçar rebuild completo
ENV CACHE_BUST=2025-11-29-v3

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

# Instalar dependências (pnpm vai baixar a engine correta)
RUN pnpm install --no-frozen-lockfile --filter=@barmanager/backend

# Copiar código fonte
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/tsconfig*.json ./apps/backend/
COPY apps/backend/nest-cli.json ./apps/backend/

# Mudar para o diretório do backend
WORKDIR /app/apps/backend

# Gerar Prisma Client (vai usar a engine que acabou de ser instalada)
RUN npx prisma generate

# Compilar TypeScript
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# Comando de inicialização com migração
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
