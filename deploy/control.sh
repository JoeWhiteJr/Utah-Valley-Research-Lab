#!/bin/bash
# Stats Lab Manager - Control Script
# Manage the application containers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.ec2.yml"

usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|rebuild|backup}"
    echo ""
    echo "Commands:"
    echo "  start    - Start all containers"
    echo "  stop     - Stop all containers"
    echo "  restart  - Restart all containers"
    echo "  status   - Show container status"
    echo "  logs     - Show container logs (follow mode)"
    echo "  rebuild  - Rebuild and restart containers"
    echo "  backup   - Backup the PostgreSQL database"
    exit 1
}

start() {
    echo "Starting Stats Lab Manager..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" up -d
    echo "Started. Access at http://YOUR_IP"
}

stop() {
    echo "Stopping Stats Lab Manager..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    echo "Stopped."
}

restart() {
    stop
    start
}

status() {
    echo "Container Status:"
    docker ps -a --filter "name=statslab"
    echo ""
    echo "Docker Compose Status:"
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" ps
}

logs() {
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" logs -f
}

rebuild() {
    echo "Rebuilding Stats Lab Manager..."
    cd "$PROJECT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" up -d --build
    echo "Rebuilt and started."
}

backup() {
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/statslab_backup_$TIMESTAMP.sql"

    echo "Backing up database to $BACKUP_FILE..."
    docker exec statslab-db pg_dump -U statslab statslab > "$BACKUP_FILE"

    # Compress the backup
    gzip "$BACKUP_FILE"
    echo "Backup complete: ${BACKUP_FILE}.gz"

    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/statslab_backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
    echo "Old backups cleaned up (keeping last 7)"
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    rebuild)
        rebuild
        ;;
    backup)
        backup
        ;;
    *)
        usage
        ;;
esac
