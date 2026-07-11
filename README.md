# Protocolo Sepse

Sistema de registro e acompanhamento do protocolo de sepse do Hospital Cardio Pulmonar (Rede D'Or São Luiz).
O objetivo central é monitorar o **tempo porta-antibiótico** (meta institucional: antibiótico em até 1 hora
da abertura da ficha) e acompanhar cada caso até o desfecho.

## Stack

- **Frontend**: React + Vite (`frontend/`)
- **Backend**: Node.js + Express + PostgreSQL (`backend/`)
- **Banco**: schema normalizado em `db/schema.sql`, migrações em `db/migrations/`, seeds em `db/seed.sql`

## Rodando localmente

Pré-requisitos: Node.js 20+ e PostgreSQL 14+.

### 1. Banco de dados

```bash
createdb protocolo_sepse
psql -d protocolo_sepse -f db/schema.sql -f db/seed.sql
# aplique as migrações em ordem:
psql -d protocolo_sepse -f db/migrations/001_kpi_porta_antibiotico.sql
psql -d protocolo_sepse -f db/migrations/002_ciclo_do_caso.sql
# opcional: dados fictícios para demonstração
psql -d protocolo_sepse -f db/demo_seed.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # ajuste DATABASE_URL e JWT_SECRET
npm ci
npm start                 # API em http://127.0.0.1:4000
```

As variáveis obrigatórias (`DATABASE_URL`, `JWT_SECRET`) são validadas no boot — o servidor não sobe sem elas.
Veja `backend/.env.example` para a lista completa.

No primeiro acesso (banco sem médicos), o app abre a tela de **bootstrap** para definir a senha do usuário
master. O CRM/nome do master vêm de `MASTER_CRM`/`MASTER_NAME` no `.env`.

### 3. Frontend

```bash
cd frontend
npm ci
npm run dev               # http://localhost:5173 (proxy /api -> 127.0.0.1:4000)
```

## Qualidade

```bash
# backend
cd backend && npm run lint && npm test
# frontend
cd frontend && npm run lint && npm run build
```

O workflow `.github/workflows/ci.yml` roda lint + test (backend) e lint + build (frontend) em cada push/PR.
O deploy (`deploy.yml`) só executa **após** o CI passar (`needs: verify`).

## Endpoints úteis

- `GET /api/health` — verificação de saúde (para monitoramento/ops).

## Deploy

Push na branch `main` dispara `.github/workflows/deploy.yml`. Ele primeiro roda o CI e, se passar, conecta
via SSH ao servidor de produção e executa `deploy.sh` (git pull, build, restart dos serviços). A chave SSH
usada pelo Actions só tem permissão de rodar esse script específico no servidor.
