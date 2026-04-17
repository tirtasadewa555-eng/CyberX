#!/bin/bash

# ==============================================================================
# CYBER-X GATEWAY - AUTO DEPLOYMENT SCRIPT
# Created by: Tirta Sadewa | Cyber Security Expert
# Team: Cyber Sentinel Secure
# ==============================================================================

# --- KONFIGURASI PENGGUNA (EDIT BAGIAN INI) ---
GITHUB_REPO="https://github.com/username/wa-gateway-cyber.git" # Ganti dengan URL Repo Anda
APP_DIR="/root/wa-gateway-cyber"
APP_NAME="wa-gateway"
NODE_VERSION="20"
# ---------------------------------------------

# Warna untuk output Terminal
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}"
echo "==========================================================="
echo "   🛡️  CYBER-X GATEWAY - ENTERPRISE AUTO INSTALLER 🛡️   "
echo "   Developed by: Tirta Sadewa | Cyber Security Expert    "
echo "==========================================================="
echo -e "${NC}"

# 1. CEK ROOT PRIVILEGES
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[!] Script ini harus dijalankan sebagai ROOT. Silakan gunakan 'sudo ./installer.sh'${NC}"
  exit 1
fi

# 2. UPDATE & UPGRADE OS
echo -e "\n${YELLOW}[1/7] Memperbarui sistem Ubuntu & Daftar Paket...${NC}"
apt-get update && apt-get upgrade -y

# 3. INSTALASI DEPENDENSI SISTEM & PUPPETEER (WHATSAPP WEB)
echo -e "\n${YELLOW}[2/7] Menginstal Dependensi Sistem, Keamanan & Puppeteer...${NC}"
# Menginstal paket psmisc untuk fuser, lsof untuk port check, dan lib pendukung browser
apt-get install -y curl git unzip build-essential psmisc lsof ufw nmap clamav
apt-get install -y libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libnss3-dev libgdk-pixbuf2.0-0 libffi-dev libappindicator3-1 fonts-liberation xdg-utils

# 4. INSTALASI NODE.JS & PM2
echo -e "\n${YELLOW}[3/7] Menginstal Node.js v${NODE_VERSION} & PM2...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js sudah terinstal: $(node -v)${NC}"
fi

if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    pm2 install pm2-logrotate
else
    echo -e "${GREEN}PM2 sudah terinstal.${NC}"
fi

# 5. KLONING REPOSITORY GITHUB
echo -e "\n${YELLOW}[4/7] Mengambil Source Code dari GitHub...${NC}"
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}Direktori $APP_DIR sudah ada. Mem-backup direktori lama...${NC}"
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%s)"
fi

git clone "$GITHUB_REPO" "$APP_DIR"
cd "$APP_DIR" || exit

# 6. INSTALASI MODUL NODE.JS (NPM)
echo -e "\n${YELLOW}[5/7] Menginstal Node Modules...${NC}"
npm install

# Setup file .env jika belum ada
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}[6/7] Membuat file .env template...${NC}"
    cat <<EOF > .env
PORT=3008
ADMIN_NUMBER=628xxxxxxxxx
SERVER_IP=127.0.0.1
PROTECTED_DIR=/var/www/html
BACKUP_DIR=/root/backup_vault
# Konfigurasi Tambahan
EOF
    echo -e "${GREEN}File .env berhasil dibuat. Silakan lengkapi nanti.${NC}"
else
    echo -e "\n${GREEN}[6/7] File .env sudah ada.${NC}"
fi

# 7. MENJALANKAN BACKEND DENGAN PM2
echo -e "\n${YELLOW}[7/7] Menjalankan Gateway dengan PM2...${NC}"
# Pastikan port 3008 bersih
fuser -k 3008/tcp 2>/dev/null || true

# Jalankan aplikasi
pm2 start src/index.js --name "$APP_NAME" --update-env

# Simpan konfigurasi PM2 agar auto-start saat reboot
pm2 save
pm2 startup | grep "sudo env PATH" | bash

echo -e "\n==========================================================="
echo -e "${GREEN}✅  INSTALASI SELESAI DENGAN SUKSES!${NC}"
echo -e "==========================================================="
echo -e "🛡️  System developed by: ${CYAN}Tirta Sadewa${NC}"
echo -e "🚀 Status PM2         : ${CYAN}pm2 status${NC}"
echo -e "📋 Log Real-time      : ${CYAN}pm2 logs $APP_NAME${NC}"
echo -e "⚙️  Direktori         : ${CYAN}$APP_DIR${NC}"
echo -e "==========================================================="
echo -e "${YELLOW}Cyber Sentinel Secure Team © 2026${NC}"
echo -e "==========================================================="