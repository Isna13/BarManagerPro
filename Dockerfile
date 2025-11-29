# Dockerfile para Railway - BarManager Backend
# V6 - DATABASE_URL apenas para build, removida em runtime
FROM node:20-slim AS builder

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos do backend
COPY apps/backend/package.json ./
COPY apps/backend/prisma ./prisma

# DATABASE_URL temporária para build (Prisma precisa)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY apps/backend/src ./src
COPY apps/backend/tsconfig*.json ./
COPY apps/backend/nest-cli.json ./

# Gerar Prisma Client
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build:docker

# ===== STAGE 2: Runtime (sem DATABASE_URL hardcoded) =====
FROM node:20-slim

RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar apenas o necessário do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# NÃO definir DATABASE_URL aqui - Railway vai injetar automaticamente

# Expor porta
EXPOSE 3000

# Inicialização
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
