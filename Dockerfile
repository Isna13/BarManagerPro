# Dockerfile para Railway - BarManager Backend
FROM node:20-alpine

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos do workspace root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Copiar schema do Prisma ANTES de instalar dependências
COPY apps/backend/prisma ./apps/backend/prisma

# Instalar dependências (agora o prisma generate vai funcionar)
RUN pnpm install --frozen-lockfile --filter=@barmanager/backend...

# Copiar resto do código do backend
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
