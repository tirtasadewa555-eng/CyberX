#!/bin/bash

# ==============================================================================
# CYBER-X GATEWAY - AUTO DEPLOYMENT SCRIPT (ULTRA-STABLE v3)
# Created by: Tirta Sadewa | Cyber Security Expert
# Team: Cyber Sentinel Secure Team
# ==============================================================================

# --- KONFIGURASI PENGGUNA ---
GITHUB_REPO="https://github.com/tirtasadewa555-eng/CyberX.git" 
APP_NAME="CyberX"
APP_DIR="/root/$APP_NAME" 
NODE_VERSION="20"
TARGET_PORT="3008" # Port utama yang diinginkan
# -----------------------------

# Warna Terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo -e "${CYAN}"
echo "==========================================================="
echo "   🛡️  CYBER-X GATEWAY - ENTERPRISE AUTO INSTALLER 🛡️   "
echo "   Developed by: Tirta Sadewa | Cyber Security Expert    "
echo "==========================================================="
echo -e "${NC}"

# 1. CEK ROOT
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Jalankan sebagai ROOT (sudo ./installer.sh)${NC}"
  exit 1
fi

# 2. UPDATE OS & DEPENDENSI PUPPETEER
echo -e "\n${YELLOW}[1/9] Menyiapkan Lingkungan OS & Library Browser...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl git unzip build-essential psmisc lsof ufw nmap clamav
apt-get install -y libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libnss3-dev libgdk-pixbuf2.0-0 libffi-dev libappindicator3-1 fonts-liberation xdg-utils

# 3. INSTALASI NODE.JS & PM2
echo -e "\n${YELLOW}[2/9] Instalasi Runtime Node.js v${NODE_VERSION}...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi
npm install -g pm2 && pm2 install pm2-logrotate

# 4. PORT PURGE (Mencegah Error EADDRINUSE)
echo -e "\n${YELLOW}[3/9] Membersihkan Port 3000 & 3008 dari Proses Zombie...${NC}"
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3008/tcp 2>/dev/null || true
sleep 2

# 5. DOWNLOAD SOURCE CODE
echo -e "\n${YELLOW}[4/9] Cloning Repository dari GitHub...${NC}"
if [ -d "$APP_DIR" ]; then
    mv "$APP_DIR" "${APP_DIR}_bak_$(date +%s)"
fi
git clone "$GITHUB_REPO" "$APP_DIR"
cd "$APP_DIR" || exit

# 6. SMART DIRECTORY LOCATOR
echo -e "\n${YELLOW}[5/9] Mencari Lokasi Source Code (Backend/Src/Root)...${NC}"
if [ -d "backend" ]; then
    WORKING_DIR="$APP_DIR/backend"
elif [ -d "src" ]; then
    WORKING_DIR="$APP_DIR/src"
else
    WORKING_DIR="$APP_DIR"
fi
cd "$WORKING_DIR" || exit
echo -e "${GREEN}Direktori kerja aktif: $WORKING_DIR${NC}"

# 7. CLEAN INSTALL MODULES
echo -e "\n${YELLOW}[6/9] Melakukan Clean Install Node Modules...${NC}"
rm -rf node_modules package-lock.json
npm install

# 8. KONFIGURASI KEAMANAN (Firebase & ENV)
echo -e "\n${YELLOW}[7/9] Menyuntikkan Konfigurasi Keamanan...${NC}"

# File Firebase
cat <<EOF > firebase-service-account.json
{
  "type": "service_account",
  "project_id": "GANTI_PROJECT_ID",
  "private_key": "GANTI_PRIVATE_KEY",
  "client_email": "GANTI_EMAIL"
}
EOF

# File .env (Pastikan PORT didefinisikan di sini agar tidak lari ke 3000)
cat <<EOF > .env
PORT=$TARGET_PORT
ADMIN_NUMBER=628xxxxxxxxx
SERVER_IP=127.0.0.1
PROTECTED_DIR=/var/www/html
BACKUP_DIR=/root/backup_vault
EOF
echo -e "${GREEN}Config .env & Firebase berhasil dibuat di $WORKING_DIR${NC}"

# 9. PM2 CLEANUP
echo -e "\n${YELLOW}[8/9] Reset Profil PM2...${NC}"
pm2 delete "$APP_NAME" 2>/dev/null || true

# 10. LAUNCH SYSTEM
echo -e "\n${YELLOW}[9/9] Menjalankan Cyber-X Gateway...${NC}"
if [ -f "index.js" ]; then
    pm2 start index.js --name "$APP_NAME" --update-env
else
    echo -e "${RED}[!] File index.js tidak ditemukan di $WORKING_DIR${NC}"
    exit 1
fi

pm2 save
pm2 startup | grep "sudo env PATH" | bash

echo -e "\n==========================================================="
echo -e "${GREEN}✅  INSTALASI SELESAI & SISTEM ONLINE!${NC}"
echo -e "==========================================================="
echo -e "🛡️  Developer : ${CYAN}Tirta Sadewa${NC}"
echo -e "📂 Lokasi    : ${CYAN}$WORKING_DIR${NC}"
echo -e "🌐 Port      : ${CYAN}$TARGET_PORT${NC}"
echo -e "==========================================================="
echo -e "${YELLOW}Ketik 'pm2 logs $APP_NAME' untuk scan QR Code.${NC}"
echo -e "==========================================================="
