# Dockerfile para Railway - BarManager Backend
# V5 RADICAL - Usar NPM para evitar cache do pnpm
FROM node:20-slim

# Cache bust V5 - MUDAR para NPM
ENV CACHE_BUST=2025-11-29-v5

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates procps && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos do backend
COPY apps/backend/package.json ./
COPY apps/backend/prisma ./prisma

# Definir plataforma alvo do Prisma ANTES da instalação
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"

# DATABASE_URL temporária para o build (Prisma generate precisa dela)
# Em runtime, Railway injeta a DATABASE_URL real automaticamente
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Instalar dependências com NPM (evita cache problemático do pnpm)
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY apps/backend/src ./src
COPY apps/backend/tsconfig*.json ./
COPY apps/backend/nest-cli.json ./

# Gerar Prisma Client (engine Debian será baixado)
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build:docker

# Expor porta
EXPOSE 3000

# Inicialização (migrations + start)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
