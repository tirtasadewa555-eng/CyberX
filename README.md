# 🛡️ Cyber-X Gateway (Enterprise Edition)
**Developed by Tirta Sadewa | Cyber Sentinel Secure Team**

> ⚠️ **DISCLAIMER / PERINGATAN EDUKASI:**
> Sistem ini dikembangkan **HANYA UNTUK TUJUAN EDUKASI**, penelitian keamanan siber (*Cyber Security Research*), dan manajemen jaringan pribadi. Segala bentuk penyalahgunaan sistem ini untuk tindakan ilegal, *spamming*, atau merugikan pihak ketiga adalah di luar tanggung jawab pengembang. Gunakan dengan bijak.

Cyber-X Gateway adalah sistem bot WhatsApp terintegrasi yang dirancang untuk memonitor, mengelola, dan mengotomatisasi perintah server (VPS/Mini PC) dengan arsitektur yang aman, stabil, dan didukung oleh kecerdasan buatan (AI).

---

## 📋 Persyaratan Sistem (Prerequisites)
Sebelum melakukan instalasi, pastikan Anda telah menyiapkan:
1. Server berbasis Linux (Ubuntu/Debian) dengan akses **ROOT**.
2. Akun GitHub.
3. Akun Google Firebase (untuk *database/auth*).
4. Akun Google AI Studio (untuk Gemini API Key).
5. Nomor WhatsApp aktif (disarankan menggunakan nomor khusus bot).

---

## ⚙️ Tahap 1: Setup Kredensial Firebase
Aplikasi ini menggunakan Firebase sebagai fondasi *database*. Anda wajib mendapatkan file `firebase-service-account.json` dari Google.

**Langkah-langkah mendapatkan Service Account JSON:**
1. Kunjungi [Firebase Console](https://console.firebase.google.com/).
2. Klik **"Add Project"** (Buat Proyek Baru) dan ikuti langkah pembuatannya hingga selesai.
3. Di *dashboard* utama Firebase, klik ikon ⚙️ **Gear (Settings)** di menu kiri atas, lalu pilih **"Project settings"**.
4. Pindah ke tab **"Service accounts"**.
5. Pastikan "Node.js" terpilih, lalu klik tombol biru **"Generate new private key"**.
6. Sebuah file berekstensi `.json` akan terunduh ke komputer Anda. 
7. Anda akan menyalin isi teks dari file JSON ini nanti untuk menimpanya secara manual di direktori server Anda (biasanya di `/root/CyberX/backend/firebase-service-account.json`).

---

## 🧠 Tahap 2: Setup Gemini API Key
Sistem ini terintegrasi dengan AI untuk memproses bahasa natural. Anda memerlukan API Key yang sah.

**Langkah-langkah mendapatkan API Key:**
1. Kunjungi [Google AI Studio](https://aistudio.google.com/).
2. Login menggunakan akun Google Anda.
3. Di menu sebelah kiri, klik **"Get API key"**.
4. Klik tombol **"Create API key"**.
5. Salin kode API Key yang muncul (biasanya berawalan `AIza...`) dan simpan untuk dimasukkan ke file `.env` di tahap selanjutnya.

---

## 🔑 Tahap 3: Setup Environment Variables (.env)
Sistem membutuhkan file konfigurasi rahasia untuk bisa berjalan. File `.env` mengatur port, nomor *admin*, direktori, dan kunci API Anda.

Bentuk struktur konfigurasi `.env` adalah sebagai berikut:

```env
PORT=3008
ADMIN_NUMBER=6281234567890         # Ganti dengan nomor WhatsApp Anda (tanpa tanda +)
SERVER_IP=127.0.0.1                # IP Server/VPS Anda
PROTECTED_DIR=/var/www/html        # Direktori yang ingin dipantau/dilindungi
BACKUP_DIR=/root/backup_vault      # Direktori penyimpanan cadangan
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxx # Masukkan API Key Gemini Anda di sini
```

*(Catatan: Anda wajib mengedit nilai-nilai di atas sesuai dengan kondisi jaringan dan kredensial Anda setelah proses instalasi selesai).*

---

## 🚀 Tahap 4: Instalasi Otomatis (Auto-Installer)
Untuk mempermudah *deployment*, kami telah menyediakan *script* instalasi otomatis tingkat korporat (`installer.sh`). *Script* ini akan menginstal Node.js, membersihkan port, memasang PM2, dan mengatur struktur folder secara mandiri.

**Jalankan perintah berikut di Terminal SSH Anda secara berurutan:**

**1. Kloning Repositori:**
```bash
git clone [https://github.com/tirtasadewa555-eng/CyberX.git](https://github.com/tirtasadewa555-eng/CyberX.git)
cd CyberX
```

**2. Berikan Izin Eksekusi pada Installer:**
```bash
chmod +x installer.sh
```

**3. Jalankan Installer sebagai ROOT:**
```bash
sudo ./installer.sh
```

*Sistem akan berjalan secara otomatis. Jika di tengah proses sistem tidak mendeteksi file konfigurasi (Firebase atau .env), script akan membuatkan file template sementara yang wajib Anda edit (sesuai Tahap 1, 2 & 3) sebelum menjalankan bot.*

---

## 📡 Tahap 5: Pengoperasian & Scan QR Code
Setelah instalasi selesai dan Anda telah mengedit file `.env` serta `firebase-service-account.json`, ikuti langkah ini untuk menyambungkan WhatsApp:

1. Buka *log real-time* PM2 dengan mode raw agar *barcode* tidak terpotong:
```bash
pm2 logs CyberX --raw
```
2. Terminal akan memunculkan **QR Code**.
3. Buka WhatsApp di HP bot Anda > **Linked Devices (Perangkat Taut)** > **Link a Device**.
4. *Scan* QR Code yang ada di layar komputer Anda.
5. Tunggu hingga muncul log tulisan `Client is ready!` atau `WhatsApp Connected`.
6. Tekan `Ctrl + C` untuk keluar dari layar *log*.

Bot Cyber-X kini siap mendengarkan perintah Anda! Coba kirim pesan `!ping` atau perintah AI lainnya ke nomor bot Anda.

---

## 🛠️ Perintah Manajemen Server (PM2)
Jika Anda melakukan perubahan pada kode, mengedit file `.env`, atau memperbarui kredensial, gunakan perintah berikut untuk merestart sistem:

- **Restart Bot:** `pm2 restart CyberX --update-env`
- **Melihat Log:** `pm2 logs CyberX`
- **Melihat Log Tanpa Terpotong:** `pm2 logs CyberX --raw`
- **Menghentikan Bot:** `pm2 stop CyberX`
- **Melihat Status Kinerja:** `pm2 monit`

---
© 2026 Cyber Sentinel Secure Team. All Rights Reserved.
