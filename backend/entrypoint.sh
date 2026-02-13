#!/bin/sh
# Ensure upload subdirectories exist and are writable by nodejs user
# (Docker volume may be mounted with root ownership on first run)
mkdir -p /app/uploads/chat /app/uploads/covers /app/uploads/files
chown -R 1001:1001 /app/uploads

# Drop to nodejs user and run the command
exec su-exec nodejs "$@"
