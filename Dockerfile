# Dockerfile para Railway - BarManager Backend
# V8 - Não usar ENV DATABASE_URL, apenas ARG para build
FROM node:20-slim

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos do backend
COPY apps/backend/package.json ./
COPY apps/backend/prisma ./prisma

# ARG para build (não persiste em runtime)
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY apps/backend/src ./src
COPY apps/backend/tsconfig*.json ./
COPY apps/backend/nest-cli.json ./

# Gerar Prisma Client (precisa de DATABASE_URL apenas para validar schema)
# Usar shell para passar a variável
RUN DATABASE_URL="${DATABASE_URL}" npx prisma generate

# Compilar TypeScript
RUN npm run build:docker

# NÃO definir ENV DATABASE_URL - Railway vai injetar em runtime
ENV NODE_ENV=production

# Expor porta
EXPOSE 3000

# Inicialização - Railway injeta DATABASE_URL aqui
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
