#!/bin/bash
# Deploy executado pelo GitHub Actions via SSH (usuario ubuntu).
# A chave SSH de CI so tem permissao de rodar este script (forced command no
# authorized_keys), entao seu escopo eh deliberadamente fixo e auditavel.
#
# Garantias deste deploy:
#   - lock: nunca roda dois deploys concorrentes.
#   - migracoes de banco aplicadas automaticamente e uma unica vez (db/migrate.sh).
#   - health check pos-restart: o deploy so eh "verde" se /api/health responder.
#   - rollback automatico para o commit anterior se build/migracao/health falhar.
set -euo pipefail

APP_DIR=/opt/protocolo-sepse
HEALTH_URL=http://127.0.0.1:4000/api/health
LOCK=/tmp/protocolo-sepse-deploy.lock

# --- lock: serializa deploys (defesa alem do concurrency do GitHub Actions) ---
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Outro deploy em andamento. Abortando."
  exit 1
fi

cd "$APP_DIR"

build() {
  ( cd backend  && npm ci --omit=dev )
  ( cd frontend && npm ci && npm run build )
}

health_ok() {
  for _ in $(seq 1 15); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

PREV="$(git rev-parse HEAD)"

rollback() {
  echo "!! Falha no deploy. Rollback para $PREV"
  git reset --hard "$PREV"
  build
  sudo /usr/bin/systemctl restart protocolo-sepse-backend
  sudo /usr/bin/systemctl reload nginx
  if health_ok; then
    echo "Rollback concluido e saudavel ($PREV)."
  else
    echo "ALERTA: rollback aplicado mas /api/health NAO respondeu. Intervencao manual necessaria."
  fi
}

git fetch origin main
git reset --hard origin/main
NEW="$(git rev-parse HEAD)"
echo "Deploy $PREV -> $NEW"

# --- build (backend deps + frontend) ---
if ! build; then
  rollback
  exit 1
fi

# --- migracoes de banco (forward-only, idempotentes, rastreadas) ---
# Migrations devem ser aditivas/compativeis com o codigo anterior, para que um
# eventual rollback de codigo continue funcionando sobre o schema ja migrado.
# O runner e um wrapper root-owned e imutavel (ubuntu so pode EXECUTA-LO via
# sudo, nao rodar psql arbitrario). Fonte versionada em db/migrate.sh.
MIGRATE_BIN=/usr/local/sbin/protocolo-sepse-migrate
if [ -x "$MIGRATE_BIN" ]; then
  echo "Aplicando migracoes..."
  if ! sudo "$MIGRATE_BIN"; then
    echo "!! Migracao falhou."
    rollback
    exit 1
  fi
fi

# --- restart + health check ---
sudo /usr/bin/systemctl restart protocolo-sepse-backend
if ! health_ok; then
  echo "!! Health check falhou apos restart ($NEW)."
  rollback
  exit 1
fi

sudo /usr/bin/systemctl reload nginx
echo "Deploy concluido e saudavel ($NEW): $(date -u +%FT%TZ)"
