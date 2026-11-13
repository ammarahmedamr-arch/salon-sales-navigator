#!/usr/bin/env bash
# ==============================================================================
# OJLinker CRM — Automated SQLite Online Backup Script
#
# Recommended Cron entry (runs daily at 00:00 UTC / 03:00 Asia/Riyadh):
# 0 0 * * * /var/www/ojlinker-crm/deploy/backup.sh >> /var/log/ojlinker-backup.log 2>&1
# ==============================================================================

set -euo pipefail

APP_DIR="/var/www/ojlinker-crm"
PB_DATA_DIR="${APP_DIR}/backend/pb_data"
BACKUP_DIR="/var/backups/ojlinker"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_DIR="/tmp/ojlinker_backup_${TIMESTAMP}"
ARCHIVE_NAME="ojlinker_backup_${TIMESTAMP}.tar.gz"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting OJLinker CRM backup..."

# Ensure target backup directory exists
mkdir -p "${BACKUP_DIR}"
mkdir -p "${TEMP_DIR}"

# Ensure data.db exists
if [ ! -f "${PB_DATA_DIR}/data.db" ]; then
    echo "ERROR: Database file ${PB_DATA_DIR}/data.db not found!" >&2
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# 1. Atomic safe SQLite online backup for data.db (no database locks)
echo "Backing up data.db via sqlite3 online backup..."
sqlite3 "${PB_DATA_DIR}/data.db" ".backup '${TEMP_DIR}/data.db'"

# 2. Backup auxiliary.db (logs) if present
if [ -f "${PB_DATA_DIR}/auxiliary.db" ]; then
    echo "Backing up auxiliary.db via sqlite3 online backup..."
    sqlite3 "${PB_DATA_DIR}/auxiliary.db" ".backup '${TEMP_DIR}/auxiliary.db'"
fi

# 3. Copy storage files if present (uploads/attachments)
if [ -d "${PB_DATA_DIR}/storage" ]; then
    echo "Copying uploaded storage files..."
    cp -r "${PB_DATA_DIR}/storage" "${TEMP_DIR}/"
fi

# 4. Compress to tar.gz
echo "Compressing backup archive to ${BACKUP_DIR}/${ARCHIVE_NAME}..."
tar -czf "${BACKUP_DIR}/${ARCHIVE_NAME}" -C "${TEMP_DIR}" .

# 5. Clean up temporary directory
rm -rf "${TEMP_DIR}"

# 6. Apply 14-day retention policy (keep last 14 days of backups)
echo "Pruning backups older than 14 days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -type f -name "ojlinker_backup_*.tar.gz" -mtime +14 -exec rm -f {} +

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed successfully: ${BACKUP_DIR}/${ARCHIVE_NAME}"
