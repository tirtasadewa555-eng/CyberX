#!/bin/bash

# ==============================================================================
# CYBER-X GATEWAY - AUTO DEPLOYMENT SCRIPT (ANTI-ERROR EDITION v2)
# Created by: Tirta Sadewa | Cyber Security Expert
# Team: Cyber Sentinel Secure Team
# ==============================================================================

# --- KONFIGURASI PENGGUNA (EDIT BAGIAN INI) ---
GITHUB_REPO="https://github.com/tirtasadewa555-eng/CyberX.git" 
APP_NAME="CyberX"
APP_DIR="/root/$APP_NAME" 
NODE_VERSION="20"
APP_PORT="3008" # Port yang digunakan oleh Gateway
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
echo -e "\n${YELLOW}[1/9] Memperbarui sistem Ubuntu & Daftar Paket...${NC}"
apt-get update && apt-get upgrade -y

# 3. INSTALASI DEPENDENSI SISTEM & PUPPETEER
echo -e "\n${YELLOW}[2/9] Menginstal Dependensi Sistem, Keamanan & Puppeteer...${NC}"
apt-get install -y curl git unzip build-essential psmisc lsof ufw nmap clamav
apt-get install -y libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libnss3-dev libgdk-pixbuf2.0-0 libffi-dev libappindicator3-1 fonts-liberation xdg-utils

# 4. INSTALASI NODE.JS & PM2
echo -e "\n${YELLOW}[3/9] Menginstal Node.js v${NODE_VERSION} & PM2...${NC}"
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
echo -e "\n${YELLOW}[4/9] Mengambil Source Code dari GitHub...${NC}"
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}Direktori $APP_DIR sudah ada. Mem-backup direktori lama...${NC}"
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%s)"
fi

git clone "$GITHUB_REPO" "$APP_DIR"

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}[!] Gagal melakukan clone repository. Pastikan URL dan akses GitHub Anda benar.${NC}"
    exit 1
fi

cd "$APP_DIR" || exit

# 6. INSTALASI MODUL NODE.JS (CLEAN INSTALL)
echo -e "\n${YELLOW}[5/9] Membersihkan Cache & Menginstal Node Modules (Clean Install)...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${CYAN}Mendeteksi node_modules lama. Menghapus...${NC}"
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo -e "${CYAN}Mendeteksi package-lock.json lama. Menghapus...${NC}"
    rm -f package-lock.json
fi

echo -e "${GREEN}Menjalankan instalasi NPM bersih...${NC}"
npm install

# 7. SETUP FIREBASE SERVICE ACCOUNT
echo -e "\n${YELLOW}[6/9] Membuat file firebase-service-account.json...${NC}"
cat <<EOF > firebase-service-account.json
{
  "type": "service_account",
  "project_id": "GANTI_DENGAN_PROJECT_ID_ANDA",
  "private_key_id": "GANTI_DENGAN_PRIVATE_KEY_ID_ANDA",
  "private_key": "GANTI_DENGAN_PRIVATE_KEY_ANDA",
  "client_email": "GANTI_DENGAN_CLIENT_EMAIL_ANDA",
  "client_id": "GANTI_DENGAN_CLIENT_ID_ANDA",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "GANTI_DENGAN_CERT_URL_ANDA",
  "universe_domain": "googleapis.com"
}
EOF
echo -e "${GREEN}File firebase-service-account.json berhasil dibuat!${NC}"

# 8. SETUP FILE .ENV
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}[7/9] Membuat file .env template...${NC}"
    cat <<EOF > .env
PORT=${APP_PORT}
ADMIN_NUMBER=628xxxxxxxxx
SERVER_IP=127.0.0.1
PROTECTED_DIR=/var/www/html
BACKUP_DIR=/root/backup_vault
EOF
    echo -e "${GREEN}File .env berhasil dibuat.${NC}"
else
    echo -e "\n${GREEN}[7/9] File .env sudah ada.${NC}"
fi

# 9. PEMBERSIHAN PM2 & PORT (ANTI-ERROR LOGIC)
echo -e "\n${YELLOW}[8/9] Membersihkan Port & Proses PM2 yang bentrok...${NC}"

# Mematikan proses apa pun yang memakai port yang sama
if lsof -Pi :$APP_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}[!] Port $APP_PORT sedang digunakan. Melakukan Kill Process...${NC}"
    kill -9 $(lsof -t -i:$APP_PORT) 2>/dev/null || true
    fuser -k $APP_PORT/tcp 2>/dev/null || true
    sleep 2
else
    echo -e "${GREEN}Port $APP_PORT dalam keadaan bersih.${NC}"
fi

# Menghapus profil PM2 dengan nama yang sama jika ada
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    echo -e "${RED}[!] Menemukan proses PM2 lama bernama '$APP_NAME'. Menghapus profil lama...${NC}"
    pm2 delete "$APP_NAME"
    sleep 2
fi

# 10. MENJALANKAN BACKEND DENGAN PM2 (AUTO-DETECT)
echo -e "\n${YELLOW}[9/9] Mendeteksi Entry Point & Menjalankan Gateway PM2...${NC}"

# Cari file index.js di mana pun dia berada
if [ -f "src/index.js" ]; then
    echo -e "${CYAN}File utama ditemukan di src/index.js${NC}"
    pm2 start src/index.js --name "$APP_NAME" --update-env
elif [ -f "backend/index.js" ]; then
    echo -e "${CYAN}File utama ditemukan di backend/index.js${NC}"
    pm2 start backend/index.js --name "$APP_NAME" --update-env
elif [ -f "index.js" ]; then
    echo -e "${CYAN}File utama ditemukan di root direktori (index.js)${NC}"
    pm2 start index.js --name "$APP_NAME" --update-env
else
    echo -e "${RED}[!] ERROR FATAL: File index.js tidak ditemukan di dalam repositori! PM2 dibatalkan.${NC}"
    exit 1
fi

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
echo -e "${YELLOW}TINDAKAN WAJIB SETELAH INI:${NC}"
echo -e "1. Edit kredensial Firebase : ${CYAN}nano $APP_DIR/firebase-service-account.json${NC}"
echo -e "2. Edit pengaturan .env     : ${CYAN}nano $APP_DIR/.env${NC}"
echo -e "3. Terapkan perubahan       : ${CYAN}pm2 restart $APP_NAME${NC}"
echo -e "==========================================================="
echo -e "${YELLOW}Cyber Sentinel Secure Team © 2026${NC}"
echo -e "==========================================================="
