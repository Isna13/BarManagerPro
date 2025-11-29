# Dockerfile para Railway - BarManager Backend
# Updated: 2025-11-29 - Force complete rebuild v2
FROM node:20-alpine

# Instalar dependências de build para módulos nativos (bcrypt, etc)
RUN apk add --no-cache python3 make g++ && npm install -g pnpm@latest

WORKDIR /app

# Copiar arquivos do workspace root (Prisma 5.22.0)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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

# Instalar node-gyp globalmente e recompilar bcrypt do zero
RUN npm install -g node-gyp && \
    cd /app/node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt && \
    node-gyp rebuild

# Build usando script Docker que usa tsconfig.build.json standalone
RUN pnpm run build:docker

# Expor porta
EXPOSE 3000

# Comando de inicialização (migrate deploy é mais seguro que db push em produção)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/main.js"]
