# Protocolo Sepse

Sistema de registro e acompanhamento do protocolo de sepse do Hospital Cardio Pulmonar (Rede D'Or São Luiz).

## Stack

- **Frontend**: React + Vite (`frontend/`)
- **Backend**: Node.js + Express + PostgreSQL (`backend/`)
- **Banco**: schema normalizado em `db/schema.sql`, seeds em `db/seed.sql`

## Deploy

Push na branch `main` dispara `.github/workflows/deploy.yml`, que conecta via SSH ao servidor de produção
e executa `deploy.sh` (git pull, build, restart dos serviços). A chave SSH usada pelo Actions só tem
permissão de rodar esse script específico no servidor.
