#!/bin/bash

# ==============================================================================
# CYBER-X GATEWAY - AUTO DEPLOYMENT SCRIPT
# ==============================================================================

GITHUB_REPO="https://github.com/tirtasadewa555-eng/CyberX.git"
APP_NAME="CyberX"
APP_DIR="/root/$APP_NAME"
NODE_VERSION="20"
TARGET_PORT="3008"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Jalankan sebagai ROOT (sudo ./installer.sh)${NC}"
  exit 1
fi

read -r -p "Lanjutkan update OS dan deployment CyberX? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Deployment dibatalkan."
  exit 0
fi

apt-get update && apt-get upgrade -y
apt-get install -y curl git unzip build-essential psmisc lsof ufw nmap clamav
apt-get install -y libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libnss3-dev libgdk-pixbuf2.0-0 libffi-dev libappindicator3-1 fonts-liberation xdg-utils

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi
npm install -g pm2 && pm2 install pm2-logrotate

fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3008/tcp 2>/dev/null || true
sleep 2

if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch --all --prune
    git -C "$APP_DIR" pull --ff-only
else
    if [ -d "$APP_DIR" ]; then
        mv "$APP_DIR" "${APP_DIR}_bak_$(date +%s)"
    fi
    git clone "$GITHUB_REPO" "$APP_DIR"
fi

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}[!] Gagal menyiapkan repository.${NC}"
    exit 1
fi
cd "$APP_DIR" || exit 1

if [ -f "backend/package.json" ]; then
    WORKING_DIR="$APP_DIR/backend"
elif [ -f "src/package.json" ]; then
    WORKING_DIR="$APP_DIR/src"
elif [ -f "package.json" ]; then
    WORKING_DIR="$APP_DIR"
else
    echo -e "${RED}[!] package.json tidak ditemukan.${NC}"
    exit 1
fi
cd "$WORKING_DIR" || exit 1

if [ -f "package-lock.json" ]; then
    npm ci
else
    echo -e "${YELLOW}[!] package-lock.json tidak ditemukan. Menjalankan npm install sekali untuk membuat lockfile.${NC}"
    npm install
fi

if [ ! -f "firebase-service-account.json" ]; then
cat <<'EOF' > firebase-service-account.json
{
  "type": "service_account",
  "project_id": "GANTI_PROJECT_ID",
  "private_key": "GANTI_PRIVATE_KEY",
  "client_email": "GANTI_EMAIL"
}
EOF
chmod 600 firebase-service-account.json
fi

if [ ! -f ".env" ]; then
cat <<EOF > .env
PORT=$TARGET_PORT
ADMIN_NUMBER=628xxxxxxxxx
SERVER_IP=127.0.0.1
PROTECTED_DIR=/var/www/html
BACKUP_DIR=/root/backup_vault
API_AUTH_TOKEN=GANTI_DENGAN_TOKEN_ACAK_PANJANG
ALLOWED_ORIGINS=https://domain-anda.example
TRUST_PROXY=false
EOF
chmod 600 .env
fi

pm2 delete "$APP_NAME" 2>/dev/null || true
if [ -f "src/index.js" ]; then
    pm2 start src/index.js --name "$APP_NAME" --update-env
elif [ -f "index.js" ]; then
    pm2 start index.js --name "$APP_NAME" --update-env
else
    echo -e "${RED}[!] index.js tidak ditemukan.${NC}"
    exit 1
fi

pm2 save
pm2 startup | grep "sudo env PATH" | bash

echo -e "${GREEN}Instalasi selesai.${NC}"
echo -e "${YELLOW}Sebelum memakai API, isi ADMIN_NUMBER, API_AUTH_TOKEN, dan ALLOWED_ORIGINS pada $WORKING_DIR/.env lalu restart PM2.${NC}"
