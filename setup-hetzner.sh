#!/bin/bash
# ================================================
# M3 Media Newsroom — Full Hetzner Setup
# Run this on a fresh Ubuntu 22.04+ Hetzner VPS
# Usage: sudo bash setup-hetzner.sh YOUR_DOMAIN
# Example: sudo bash setup-hetzner.sh newsroom.m3media.com
# ================================================

set -e

DOMAIN=${1:-newsroom.m3media.com}
APP_DIR="/opt/m3-newsroom"
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   M3 MEDIA NEWSROOM — Server Setup        ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  Domain:    $DOMAIN"
echo "  Server IP: $SERVER_IP"
echo "  App Dir:   $APP_DIR"
echo ""

# ---- Step 1: System Update ----
echo "━━━ Step 1/6: Updating system packages ━━━"
apt update && apt upgrade -y

# ---- Step 2: Install Docker ----
echo "━━━ Step 2/6: Installing Docker ━━━"
if ! command -v docker &> /dev/null; then
    apt install -y docker.io docker-compose-v2 git curl
    systemctl enable docker
    systemctl start docker
    echo "  ✅ Docker installed"
else
    echo "  ✅ Docker already installed"
fi

# ---- Step 3: Setup Firewall ----
echo "━━━ Step 3/6: Configuring firewall ━━━"
apt install -y ufw
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  ✅ Firewall configured (SSH, HTTP, HTTPS)"

# ---- Step 4: Create App Directory ----
echo "━━━ Step 4/6: Setting up application ━━━"
if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
    echo "  ✅ Created $APP_DIR"
else
    echo "  ✅ $APP_DIR already exists"
fi

# ---- Step 5: Generate Secrets ----
echo "━━━ Step 5/6: Generating secrets ━━━"
NEXTAUTH_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
echo "  ✅ Secrets generated"

# ---- Step 6: Create .env file ----
echo "━━━ Step 6/6: Creating environment config ━━━"
if [ ! -f "$APP_DIR/.env" ]; then
    cat > "$APP_DIR/.env" << EOF
# ==========================================
# M3 MEDIA NEWSROOM - Production Config
# Generated: $(date)
# ==========================================

# Database
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://newsroom:$DB_PASSWORD@db:5432/m3newsroom?schema=public

# Auth
NEXTAUTH_URL=https://$DOMAIN
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Email (SMTP) — CONFIGURE THESE
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM="M3 Newsroom <your-email@gmail.com>"

# Google Drive — CONFIGURE THESE (optional, for image library)
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_DRIVE_FOLDER_ID=

# Domain
DOMAIN=$DOMAIN
NODE_ENV=production
EOF
    echo "  ✅ .env created at $APP_DIR/.env"
    echo ""
    echo "  ⚠️  IMPORTANT: Edit $APP_DIR/.env to add your SMTP and Google Drive settings"
else
    echo "  ✅ .env already exists (not overwriting)"
fi

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   ✅ SERVER SETUP COMPLETE                     ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "  Your server IP: $SERVER_IP"
echo ""
echo "  NEXT STEPS:"
echo ""
echo "  1. POINT YOUR DNS (do this now, it can take a few minutes)"
echo "     Go to your DNS provider and create an A record:"
echo "       $DOMAIN  →  $SERVER_IP"
echo ""
echo "  2. CLONE YOUR REPO:"
echo "     cd $APP_DIR"
echo "     git clone https://github.com/YOUR_USERNAME/m3-newsroom.git ."
echo ""
echo "  3. EDIT YOUR .ENV:"
echo "     nano $APP_DIR/.env"
echo "     (Add your SMTP credentials at minimum)"
echo ""
echo "  4. GET SSL CERTIFICATE (after DNS is pointing here):"
echo "     cd $APP_DIR"
echo "     cp nginx/nginx-init.conf nginx/nginx-active.conf"
echo "     docker compose up -d nginx"
echo "     docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN"
echo "     cp nginx/nginx.conf nginx/nginx-active.conf"
echo "     docker compose restart nginx"
echo ""
echo "  5. LAUNCH EVERYTHING:"
echo "     docker compose up -d"
echo ""
echo "  6. INITIALIZE DATABASE:"
echo "     docker compose exec app npx prisma migrate deploy"
echo "     docker compose exec app npx prisma db seed"
echo ""
echo "  7. LOGIN:"
echo "     https://$DOMAIN"
echo "     Email: admin@m3media.com"
echo "     Password: changeme123"
echo ""
echo "  ⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY AFTER LOGIN"
echo ""
