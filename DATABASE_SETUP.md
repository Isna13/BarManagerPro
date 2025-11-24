# ⚠️ Importante: Configuração do Banco de Dados

## Situação Atual

O projeto BarManager Pro foi originalmente projetado para usar **PostgreSQL** em produção, que suporta recursos avançados como:
- Campos JSON nativos
- Tipo Decimal preciso
- Arrays de primitivos
- Melhor performance para múltiplos usuários

No entanto, o **PostgreSQL não está instalado** no seu sistema.

## Opções Disponíveis

### ✅ OPÇÃO 1: Instalar PostgreSQL (RECOMENDADO)

**Instalação rápida com winget:**
```powershell
winget install PostgreSQL.PostgreSQL
```

**Após instalação:**
```powershell
# Criar database
psql -U postgres
CREATE DATABASE barmanager_prod;
CREATE USER barmanager WITH PASSWORD 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON DATABASE barmanager_prod TO barmanager;
\q

# Atualizar .env
# DATABASE_URL="postgresql://barmanager:SuaSenhaForte123!@localhost:5432/barmanager_prod"

# Restaurar schema original do PostgreSQL
cd C:\BarManagerPro\apps\backend\prisma
Copy-Item schema.prisma.postgresql.backup schema.prisma

# Executar migrations
cd ..
pnpm prisma:generate
pnpm prisma:migrate dev --name init
pnpm prisma:seed
pnpm dev
```

### ⚡ OPÇÃO 2: Usar SQLite Simplificado (DESENVOLVIMENTO APENAS)

SQLite tem limitações mas funciona para testes iniciais.

**Limitações do SQLite:**
- Sem suporte nativo a JSON (usar strings)
- Sem tipo Decimal (usar inteiros para centavos)
- Sem arrays (usar strings delimitadas)
- Performance inferior com múltiplos usuários

O schema foi simplificado para funcionar com SQLite, mas **não é recomendado para produção**.

## 🎯 Recomendação

Para aproveitar todos os recursos do BarManager Pro:

1. **Instale PostgreSQL** (5 minutos)
2. **Use o schema completo** (já criado)
3. **Aproveite performance e recursos avançados**

Para desenvolvimento rápido:
- SQLite funciona temporariamente
- Migre para PostgreSQL antes de produção

## 📥 Download PostgreSQL

- **Windows**: https://www.postgresql.org/download/windows/
- **Ou via winget**: `winget install PostgreSQL.PostgreSQL`

Durante instalação:
- Anote a senha do usuário `postgres`
- Porta padrão: 5432
- Locale: English, United States

## ℹ️ Ajuda

Se encontrar problemas, consulte:
- `QUICKSTART.md` - Guia de início rápido
- `docs/INSTALL.md` - Instalação detalhada
- `docs/ARCHITECTURE.md` - Arquitetura do sistema

---

**Equipe BarManager Pro**
