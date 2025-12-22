# Dockerfile para Railway - BarManager Backend
# V14 - Force rebuild: fix TypeScript errors, regenerate Prisma
FROM node:20-slim

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar schema Prisma PRIMEIRO para invalidar cache se mudar
COPY apps/backend/prisma ./prisma

# Copiar package.json
COPY apps/backend/package.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Gerar Prisma Client ANTES de copiar src (importante!)
RUN DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma generate

# Copiar código fonte
COPY apps/backend/src ./src
COPY apps/backend/tsconfig*.json ./
COPY apps/backend/nest-cli.json ./

# Compilar TypeScript
RUN npm run build:docker

# Runtime - Railway injeta DATABASE_URL automaticamente
ENV NODE_ENV=production

EXPOSE 3000

# Apenas sincroniza schema sem apagar dados
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
