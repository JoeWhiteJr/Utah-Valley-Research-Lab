#!/bin/bash
# Stats Lab Manager - Quick Start for EC2
# This script sets up the application after the repo is cloned

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Stats Lab Manager - Quick Start"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp deploy/.env.example .env

    # Generate secure values
    DB_PASS=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
    JWT_SEC=$(openssl rand -base64 32)

    # Update .env with generated values
    sed -i "s/CHANGE_THIS_TO_A_STRONG_PASSWORD/$DB_PASS/" .env
    sed -i "s/CHANGE_THIS_TO_A_RANDOM_STRING/$JWT_SEC/" .env

    echo ""
    echo "Generated secure credentials in .env"
    echo "DB_PASSWORD: $DB_PASS"
    echo "JWT_SECRET: (hidden for security)"
    echo ""
    echo "You may want to save the DB_PASSWORD somewhere safe."
    echo ""
fi

echo "Building and starting containers..."
docker-compose -f docker-compose.ec2.yml up -d --build

echo ""
echo "Waiting for database to be ready..."
sleep 10

echo "Running database migrations..."
./deploy/migrate.sh

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Your Stats Lab Manager is now running!"
echo ""
echo "Access it at: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP')"
echo ""
echo "Useful commands:"
echo "  ./deploy/control.sh status   - Check status"
echo "  ./deploy/control.sh logs     - View logs"
echo "  ./deploy/control.sh backup   - Backup database"
echo ""
