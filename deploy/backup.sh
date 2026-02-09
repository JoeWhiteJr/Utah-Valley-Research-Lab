#!/bin/bash
# Database backup script for UVRL
# Run inside the EC2 instance where docker compose is running

set -e

BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_PREFIX=$(date +%Y-%m-%d)
CONTAINER_NAME="statslab-db"
DB_USER="${DB_USER:-statslab}"
DB_NAME="${DB_NAME:-statslab}"
RETENTION_DAYS=7
S3_BUCKET="${S3_BACKUP_BUCKET:-uvrl-db-backups}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Dump database
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom \
  > "$BACKUP_DIR/backup_${TIMESTAMP}.dump"

# Also create a plain SQL backup for easy inspection
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=plain \
  > "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

# Compress the SQL backup
gzip "$BACKUP_DIR/backup_${TIMESTAMP}.sql"

echo "[$(date)] Backup created: backup_${TIMESTAMP}.dump"

# Upload to S3
if command -v aws &>/dev/null; then
  echo "[$(date)] Uploading to s3://${S3_BUCKET}/${DATE_PREFIX}/..."
  aws s3 cp "$BACKUP_DIR/backup_${TIMESTAMP}.dump" "s3://${S3_BUCKET}/${DATE_PREFIX}/backup_${TIMESTAMP}.dump" 2>&1 \
    && aws s3 cp "$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz" "s3://${S3_BUCKET}/${DATE_PREFIX}/backup_${TIMESTAMP}.sql.gz" 2>&1 \
    && echo "[$(date)] S3 upload complete." \
    || echo "[$(date)] WARNING: S3 upload failed. Local backup is still valid."
else
  echo "[$(date)] WARNING: AWS CLI not found. Skipping S3 upload."
fi

# Cleanup old local backups (keep last N days)
find "$BACKUP_DIR" -name "backup_*.dump" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.dump 2>/dev/null | wc -l)
echo "[$(date)] Backup complete. $BACKUP_COUNT local backups retained."
