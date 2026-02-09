#!/bin/bash
# setup-ssl.sh — One-time Let's Encrypt SSL setup for utahvalleyresearchlab.com
# Run on EC2 host as root: sudo bash ~/uvrl/deploy/setup-ssl.sh
set -euo pipefail

DOMAIN="utahvalleyresearchlab.com"
WEBROOT="/var/www/certbot"
NGINX_CONF_DIR="/etc/nginx/conf.d"
EMAIL="${CERTBOT_EMAIL:-}"

echo "=== Let's Encrypt SSL Setup for ${DOMAIN} ==="

# 1. Install certbot via snap (if not already installed)
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    snap install --classic certbot 2>/dev/null || {
        apt-get update && apt-get install -y certbot
    }
    ln -sf /snap/bin/certbot /usr/bin/certbot 2>/dev/null || true
else
    echo "certbot already installed."
fi

# 2. Create webroot directory for ACME challenges
echo "Creating webroot directory..."
mkdir -p "${WEBROOT}"

# 3. Obtain certificate
echo "Requesting certificate for ${DOMAIN}..."
CERTBOT_ARGS=(
    certonly
    --webroot
    -w "${WEBROOT}"
    -d "${DOMAIN}"
    -d "www.${DOMAIN}"
    --agree-tos
    --non-interactive
)

if [ -n "${EMAIL}" ]; then
    CERTBOT_ARGS+=(--email "${EMAIL}")
else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

certbot "${CERTBOT_ARGS[@]}"

# 4. Create ssl.conf snippet that nginx will include
echo "Creating SSL nginx config..."
mkdir -p "${NGINX_CONF_DIR}"
cat > "${NGINX_CONF_DIR}/ssl.conf" <<'SSLCONF'
server {
    listen 443 ssl;
    server_name utahvalleyresearchlab.com www.utahvalleyresearchlab.com;

    # Let's Encrypt certificates
    ssl_certificate /etc/letsencrypt/live/utahvalleyresearchlab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/utahvalleyresearchlab.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Max upload size
    client_max_body_size 50M;

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        set $frontend_upstream http://frontend:80;
        proxy_pass $frontend_upstream;
    }

    # Auth rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        set $backend_upstream http://backend:3001;
        proxy_pass $backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API requests
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        add_header Cache-Control "no-store";
        set $backend_upstream http://backend:3001;
        proxy_pass $backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        set $backend_upstream http://backend:3001;
        proxy_pass $backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep WebSocket connections alive (must exceed socket.io pingInterval)
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 60s;

        # Disable buffering for real-time data
        proxy_buffering off;
        proxy_cache off;
    }

    # Uploaded files
    location /uploads/ {
        set $backend_upstream http://backend:3001;
        proxy_pass $backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend (catch-all)
    location / {
        set $frontend_upstream http://frontend:80;
        proxy_pass $frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
SSLCONF

# 5. Set up auto-renewal cron (twice daily with nginx reload)
echo "Setting up auto-renewal cron..."
CRON_CMD="0 0,12 * * * certbot renew --quiet --post-hook 'docker exec statslab-nginx nginx -s reload'"
(crontab -l 2>/dev/null | grep -v 'certbot renew' || true; echo "${CRON_CMD}") | crontab -

echo ""
echo "=== SSL setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Restart nginx to load SSL config:"
echo "     cd ~/uvrl && docker compose -f docker-compose.ec2.yml restart nginx"
echo "  2. Test: curl -I https://${DOMAIN}"
echo "  3. Update .env: CORS_ORIGIN=https://${DOMAIN}"
echo "  4. Rebuild: docker compose -f docker-compose.ec2.yml up -d --build backend"
