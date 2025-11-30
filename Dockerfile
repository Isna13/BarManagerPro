# Dockerfile para Railway - BarManager Backend
# V9 - DATABASE_URL hardcoded no RUN, não em ENV
FROM node:20-slim

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos do backend
COPY apps/backend/package.json ./
COPY apps/backend/prisma ./prisma

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY apps/backend/src ./src
COPY apps/backend/tsconfig*.json ./
COPY apps/backend/nest-cli.json ./

# Gerar Prisma Client com DATABASE_URL fake (só precisa do schema, não conecta)
RUN DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma generate

# Compilar TypeScript
RUN npm run build:docker

# Runtime - Railway injeta DATABASE_URL automaticamente
ENV NODE_ENV=production

EXPOSE 3000

# IMPORTANTE: --force-reset vai APAGAR TODOS OS DADOS e recriar o banco do zero
# Remover --force-reset após a primeira execução bem-sucedida
CMD ["sh", "-c", "npx prisma db push --force-reset --accept-data-loss && node dist/main.js"]
