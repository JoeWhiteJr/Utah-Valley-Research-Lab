# AWS Deployment Guide - Stats Lab Manager

This guide walks you through deploying Stats Lab Manager to a single EC2 instance with the ability to stop/start to minimize costs.

## Cost Summary

| State | Monthly Cost |
|-------|-------------|
| Running (t3.small) | ~$15-20 |
| Stopped | ~$2 (EBS storage only) |

---

## Step 1: Create EC2 Instance

### Via AWS Console:

1. Go to **EC2 → Launch Instance**

2. **Name:** `stats-lab-manager`

3. **AMI:** Amazon Linux 2023 (or Ubuntu 22.04)

4. **Instance type:** `t3.small` (2 vCPU, 2GB RAM)

5. **Key pair:** Create new or select existing (you'll need this to SSH)

6. **Network settings:**
   - Create security group with these rules:

   | Type | Port | Source | Description |
   |------|------|--------|-------------|
   | SSH | 22 | My IP | SSH access |
   | HTTP | 80 | 0.0.0.0/0 | Web access |
   | HTTPS | 443 | 0.0.0.0/0 | Future SSL |

7. **Storage:** 20 GB gp3

8. Click **Launch Instance**

---

## Step 2: Allocate Elastic IP

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP address**

2. Click **Allocate**

3. Select the new IP → **Actions → Associate Elastic IP address**

4. Select your instance → **Associate**

**Note your Elastic IP:** `___.___.___.___ `

---

## Step 3: Connect and Setup

### SSH into your instance:

```bash
# Replace with your key file and Elastic IP
ssh -i your-key.pem ec2-user@YOUR_ELASTIC_IP

# For Ubuntu, use: ubuntu@YOUR_ELASTIC_IP
```

### Run the setup script:

```bash
# Download and run setup script (installs Docker, Docker Compose, Git)
curl -fsSL https://raw.githubusercontent.com/JoeWhiteJr/stats-lab-manager/main/deploy/setup-ec2.sh | bash

# Log out and back in for docker group to take effect
exit
```

Then SSH back in.

---

## Step 4: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/JoeWhiteJr/stats-lab-manager.git
cd stats-lab-manager

# Create your environment file
cp deploy/.env.example .env

# Edit the .env file
nano .env
```

### Required .env settings:

```bash
# Generate a strong password for DB
DB_PASSWORD=YourStrongPassword123!

# Generate a JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Set CORS origin (use your Elastic IP)
CORS_ORIGIN=http://YOUR_ELASTIC_IP
```

**Tip:** Generate secure values:
```bash
# Generate random password
openssl rand -base64 16

# Generate JWT secret
openssl rand -base64 32
```

---

## Step 5: Deploy

```bash
# Start all containers (first build takes 2-3 minutes)
docker-compose -f docker-compose.ec2.yml up -d --build

# Watch the build progress
docker-compose -f docker-compose.ec2.yml logs -f

# Once running, run database migrations
./deploy/migrate.sh
```

---

## Step 6: Verify

1. Open `http://YOUR_ELASTIC_IP` in your browser
2. You should see the Stats Lab Manager homepage
3. Click "Login" and register your first admin account

---

## Managing the Application

### Control commands:

```bash
cd ~/stats-lab-manager

# Check status
./deploy/control.sh status

# View logs
./deploy/control.sh logs

# Restart
./deploy/control.sh restart

# Backup database
./deploy/control.sh backup
```

---

## Stop/Start EC2 to Save Money

### Stop (when not using):

**Via AWS CLI:**
```bash
aws ec2 stop-instances --instance-ids i-xxxxx
```

**Via Console:**
EC2 → Instances → Select instance → Instance State → Stop

**Cost when stopped:** ~$2/month (EBS storage only)

### Start (when needed):

**Via AWS CLI:**
```bash
aws ec2 start-instances --instance-ids i-xxxxx
```

**Via Console:**
EC2 → Instances → Select instance → Instance State → Start

Docker containers auto-restart because of `restart: unless-stopped`.

---

## Updating the Application

```bash
cd ~/stats-lab-manager

# Pull latest code
git pull origin main

# Rebuild and restart
./deploy/control.sh rebuild

# Run any new migrations
./deploy/migrate.sh
```

---

## Troubleshooting

### Containers not starting:

```bash
# Check container status
docker ps -a

# Check logs for specific container
docker logs statslab-backend
docker logs statslab-db
docker logs statslab-nginx
```

### Database connection issues:

```bash
# Check if database is healthy
docker exec statslab-db pg_isready

# Connect to database directly
docker exec -it statslab-db psql -U statslab
```

### Can't access the website:

1. Check security group allows port 80
2. Check nginx is running: `docker ps | grep nginx`
3. Check nginx logs: `docker logs statslab-nginx`

### Out of disk space:

```bash
# Clean up old Docker images
docker system prune -a

# Check disk usage
df -h
```

---

## Optional: Add SSL (HTTPS)

For production use, add SSL with Let's Encrypt:

```bash
# Install certbot
sudo dnf install -y certbot  # Amazon Linux
# sudo apt install -y certbot  # Ubuntu

# Get certificate (requires domain, not just IP)
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

Then update `deploy/nginx.conf` to include SSL configuration.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│            EC2 Instance (t3.small)           │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Nginx   │──│ Frontend │  │ Backend  │   │
│  │  :80     │  │ (React)  │  │ (Node)   │   │
│  └────┬─────┘  └──────────┘  └────┬─────┘   │
│       │              │            │          │
│       │              │     ┌──────┴──────┐   │
│       │              │     │ PostgreSQL  │   │
│       │              │     │   (Docker)  │   │
│       │              │     └─────────────┘   │
│       └──────────────┴───────────────────    │
│                      │                       │
└──────────────────────┼───────────────────────┘
                       │
                 Elastic IP
                 (static)
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.ec2.yml` | Docker Compose for EC2 deployment |
| `deploy/nginx.conf` | Nginx reverse proxy configuration |
| `deploy/.env.example` | Environment variable template |
| `deploy/setup-ec2.sh` | Initial EC2 setup script |
| `deploy/migrate.sh` | Database migration script |
| `deploy/control.sh` | Application management script |
