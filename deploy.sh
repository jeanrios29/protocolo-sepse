#!/bin/bash
# Script de deploy executado pelo GitHub Actions via SSH (usuario ubuntu).
# A chave SSH de CI so tem permissao de rodar este script (forced command
# no authorized_keys), entao seu escopo eh deliberadamente fixo e auditavel.
set -euo pipefail

cd /opt/protocolo-sepse

git fetch origin main
git reset --hard origin/main

cd backend
npm ci --omit=dev

cd ../frontend
npm ci
npm run build

sudo /usr/bin/systemctl restart protocolo-sepse-backend
sudo /usr/bin/systemctl reload nginx

echo "Deploy concluido: $(date -u +%FT%TZ)"
