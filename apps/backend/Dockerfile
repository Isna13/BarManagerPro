# Dockerfile para Railway - BarManager Backend
FROM node:20-alpine

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos do workspace root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Instalar dependências
RUN pnpm install --frozen-lockfile --filter=@barmanager/backend...

# Copiar código do backend
COPY apps/backend ./apps/backend

# Gerar Prisma Client
WORKDIR /app/apps/backend
RUN pnpm prisma:generate

# Build
RUN pnpm build

# Expor porta
EXPOSE 3000

# Comando de inicialização
CMD ["sh", "-c", "pnpm prisma db push --accept-data-loss && pnpm start:prod"]
