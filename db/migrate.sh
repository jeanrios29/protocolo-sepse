#!/usr/bin/env bash
# Runner de migracoes do protocolo_sepse — FONTE versionada.
#
# Em producao este arquivo e instalado por root como o wrapper imutavel
#   /usr/local/sbin/protocolo-sepse-migrate
# e o deploy.sh o executa via `sudo` (regra sudoers restrita a ESSE comando).
# Assim o usuario de deploy (ubuntu) nao ganha acesso livre ao banco: so
# consegue disparar o fluxo de migracoes versionadas.
#
# Roda como root e aplica cada migration como o role `postgres` (via runuser,
# peer auth). Cada db/migrations/NNN_*.sql roda UMA vez, em transacao unica
# (migration + registro juntos). Ordem = ordem lexicografica dos nomes.
set -euo pipefail

DB=protocolo_sepse
MIG_DIR=/opt/protocolo-sepse/db/migrations

pg() { runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qtA -d "$DB" "$@"; }

pg -c "CREATE TABLE IF NOT EXISTS schema_migrations (
         version    text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       );" >/dev/null

shopt -s nullglob
applied=0
for f in $(ls -1 "$MIG_DIR"/*.sql 2>/dev/null | sort); do
  v="$(basename "$f")"
  already="$(pg -c "SELECT 1 FROM schema_migrations WHERE version = '$v' LIMIT 1;")"
  if [ "$already" = "1" ]; then
    continue
  fi
  echo "  -> aplicando migration: $v"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 --single-transaction -q -d "$DB" \
    -f "$f" \
    -c "INSERT INTO schema_migrations (version) VALUES ('$v');"
  applied=$((applied + 1))
done

echo "  migrations aplicadas nesta execucao: $applied"
