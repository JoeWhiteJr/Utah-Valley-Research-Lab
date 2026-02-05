#!/bin/bash
# Stats Lab Manager - Database Migration Script
# Run this after starting the containers to set up the database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running database migrations..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Run each migration file in order
for migration in "$PROJECT_DIR"/database/migrations/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        echo "Running migration: $filename"
        docker exec -i statslab-db psql -U statslab -d statslab < "$migration" 2>/dev/null || true
    fi
done

echo ""
echo "Migrations complete!"
echo ""
echo "You can now:"
echo "1. Access the app at http://YOUR_ELASTIC_IP"
echo "2. Create your first admin user by registering"
echo ""
