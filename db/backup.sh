#!/bin/bash
# Backup diario do banco protocolo_sepse com retencao de 14 dias.
set -euo pipefail

BACKUP_DIR="/var/backups/protocolo-sepse"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="${BACKUP_DIR}/protocolo_sepse-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump protocolo_sepse | gzip > "$FILE"

find "$BACKUP_DIR" -name "protocolo_sepse-*.sql.gz" -mtime +14 -delete
