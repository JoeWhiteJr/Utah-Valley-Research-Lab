#!/bin/bash
# Database restore script for UVRL
# Usage: ./restore.sh <backup_file.dump>
#        ./restore.sh s3://uvrl-db-backups/2025-01-15/backup_20250115_020000.dump
#        ./restore.sh --list-s3

set -e

S3_BUCKET="${S3_BACKUP_BUCKET:-uvrl-db-backups}"
CONTAINER_NAME="statslab-db"
DB_USER="${DB_USER:-statslab}"
DB_NAME="${DB_NAME:-statslab}"

# List S3 backups
if [ "$1" = "--list-s3" ]; then
  echo "Available S3 backups in s3://${S3_BUCKET}/:"
  aws s3 ls "s3://${S3_BUCKET}/" --recursive | grep '\.dump$' | sort -r
  exit 0
fi

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file.dump>"
  echo "       $0 s3://<bucket>/<path>/backup.dump"
  echo "       $0 --list-s3"
  echo ""
  echo "Available local backups:"
  ls -lh /home/ubuntu/backups/backup_*.dump 2>/dev/null || echo "  No local backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Download from S3 if needed
if [[ "$BACKUP_FILE" == s3://* ]]; then
  LOCAL_FILE="/tmp/$(basename "$BACKUP_FILE")"
  echo "Downloading from S3: $BACKUP_FILE"
  aws s3 cp "$BACKUP_FILE" "$LOCAL_FILE"
  BACKUP_FILE="$LOCAL_FILE"
  echo "Downloaded to $LOCAL_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will overwrite the current database!"
echo "Backup: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo "[$(date)] Restoring from $BACKUP_FILE..."

# Drop and recreate database
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# Restore
cat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges

echo "[$(date)] Restore complete!"
