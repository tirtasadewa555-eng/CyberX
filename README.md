# 🛡️ Cyber-X Gateway (Enterprise Edition)
**Developed by Tirta Sadewa | Cyber Sentinel Secure Team**

> ⚠️ **DISCLAIMER / PERINGATAN EDUKASI:** > Sistem ini dikembangkan **HANYA UNTUK TUJUAN EDUKASI**, penelitian keamanan siber (Cyber Security Research), dan manajemen jaringan pribadi. Segala bentuk penyalahgunaan sistem ini untuk tindakan ilegal, *spamming*, atau merugikan pihak ketiga adalah di luar tanggung jawab pengembang. Gunakan dengan bijak.

Cyber-X Gateway adalah sistem bot WhatsApp terintegrasi yang dirancang untuk memonitor, mengelola, dan mengotomatisasi perintah server (VPS/Mini PC) dengan arsitektur yang aman dan stabil.

---

## 📋 Persyaratan Sistem (Prerequisites)
Sebelum melakukan instalasi, pastikan Anda telah menyiapkan:
1. Server berbasis Linux (Ubuntu/Debian) dengan akses **ROOT**.
2. Akun GitHub.
3. Akun Google Firebase (untuk *database/auth*).
4. Nomor WhatsApp aktif (disarankan menggunakan nomor khusus bot).

---

## ⚙️ Tahap 1: Setup Kredensial Firebase

Aplikasi ini menggunakan Firebase sebagai fondasi *database*. Anda wajib mendapatkan file `firebase-service-account.json` dari Google.

**Langkah-langkah mendapatkan Service Account JSON:**
1. Kunjungi [Firebase Console](https://console.firebase.google.com/).
2. Klik **"Add Project"** (Buat Proyek Baru) dan ikuti langkah pembuatannya hingga selesai.
3. Di *dashboard* utama Firebase, klik ikon ⚙️ **Gear (Settings)** di menu kiri atas, lalu pilih **"Project settings"**.
4. Pindah ke tab **"Service accounts"**.
5. Pastikan "Node.js" terpilih, lalu klik tombol biru **"Generate new private key"**.
6. Sebuah file berekstensi `.json` akan terunduh ke komputer Anda. Buka file tersebut dengan Notepad/VS Code.
7. Anda akan menyalin isi (teks) dari file JSON ini nanti saat diminta oleh sistem, atau menimpanya secara manual di direktori `/backend/firebase-service-account.json`.

---

## 🔑 Tahap 2: Setup Environment Variables (.env)

Sistem membutuhkan file konfigurasi rahasia untuk bisa berjalan. File `.env` mengatur port, nomor *admin*, dan jalur direktori Anda.

Bentuk struktur konfigurasi `.env` adalah sebagai berikut:
```env
PORT=3008
ADMIN_NUMBER=6281234567890   # Ganti dengan nomor WhatsApp pribadi Anda (tanpa +)
SERVER_IP=127.0.0.1          # IP Server/VPS Anda
PROTECTED_DIR=/var/www/html  # Direktori yang ingin dipantau/dilindungi
BACKUP_DIR=/root/backup_vault
# Konfigurasi Gemini (Pisahkan dengan koma jika ada banyak untuk Load Balancing)
GEMINI_API_KEYS=Key1,Key2,Key3
