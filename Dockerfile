# Dockerfile para Railway - BarManager Backend
# V7 - Single stage com DATABASE_URL placeholder, Railway sobrescreve em runtime
FROM node:20-slim

# Instalar dependências do sistema necessárias
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos do backend
COPY apps/backend/package.json ./
COPY apps/backend/prisma ./prisma

# DATABASE_URL placeholder para build (Prisma precisa para gerar client)
# Railway vai SOBRESCREVER esta variável em runtime automaticamente
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DATABASE_URL=${DATABASE_URL}
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY apps/backend/src ./src
COPY apps/backend/tsconfig*.json ./
COPY apps/backend/nest-cli.json ./

# Gerar Prisma Client (usa DATABASE_URL placeholder, só precisa do schema)
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build:docker

# Expor porta
EXPOSE 3000

# Inicialização - Railway injeta o DATABASE_URL real aqui
# db push é mais tolerante que migrate deploy para schemas novos
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]
