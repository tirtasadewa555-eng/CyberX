const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const logger = require('../utils/logger');

const PROTECTED_DIR = process.env.PROTECTED_DIR || '/var/www/html';
const BACKUP_DIR = process.env.BACKUP_DIR || '/root/backup_vault';

let isRestoring = false;
let isMaintenance = false;

// --- VARIABEL 2FA OTP & KONEKSI ---
let pendingOTP = null;
let otpTimeout = null;
let waClient = null; // [BARU] Menyimpan sesi WA untuk kirim pesan Japri

const sendAlert = (client, type, file, action) => {
    const adminNumber = process.env.ADMIN_NUMBER;
    if (!adminNumber) return;

    const alertMsg = `
🛡️ *CYBER-X AUTO-RESTORE AKTIF* 🛡️
⚠️ *Deteksi Perubahan Ilegal!*

📂 *File:* \`${file}\`
🚨 *Kejadian:* ${type}
✅ *Tindakan Bot:* ${action}

_Sistem telah mengembalikan file ke kondisi aman._`.trim();

    client.sendMessage(`${adminNumber}@c.us`, alertMsg).catch(e => console.error("Gagal kirim alert FIM:", e));
};

const createInitialBackup = () => {
    if (!fs.existsSync(PROTECTED_DIR)) return false;

    if (!fs.existsSync(BACKUP_DIR)) {
        logger.info(`[FIM] Membuat brankas backup baru di ${BACKUP_DIR}...`);
        fs.cpSync(PROTECTED_DIR, BACKUP_DIR, { recursive: true });
    }
    return true;
};

// ==========================================
// --- FUNGSI 2FA & OTENTIKASI JAPRI ---
// ==========================================

const requestMaintenance = async (msg) => {
    const adminNumber = process.env.ADMIN_NUMBER;

    if (!adminNumber) {
        return msg.reply('⚠️ *Sistem Error:* Nomor Admin belum diatur di file .env (ADMIN_NUMBER). Fitur 2FA dibatalkan.');
    }

    if (!waClient) {
        return msg.reply('⚠️ *Sistem Error:* Sesi bot WhatsApp belum siap.');
    }

    // Generate 6 digit OTP acak
    pendingOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // Pesan rahasia yang HANYA dikirim ke Japri Admin
    const otpSecretMsg = `
🔐 *SECURITY ALERT: 2FA REQUIRED* 🔐
Seseorang mencoba mematikan perisai FIM (Mode Maintenance).

🔑 *Kode OTP:* \`${pendingOTP}\`

Balas dengan perintah berikut untuk mengonfirmasi:
\`!otp ${pendingOTP}\`

_Kode ini bersifat rahasia dan akan hangus dalam 3 menit._`.trim();

    try {
        // 1. KIRIM OTP SECARA PRIVAT KE NOMOR ADMIN
        await waClient.sendMessage(`${adminNumber}@c.us`, otpSecretMsg);
        logger.info(`[FIM] OTP 2FA Maintenance dikirim secara rahasia ke Admin (${adminNumber}).`);

        // 2. KIRIM NOTIFIKASI KE CHAT ASAL (Tempat perintah !mt on diketik)
        // Jika yang mengetik !mt on bukan di chat pribadi Admin (misal di grup)
        if (msg.from !== `${adminNumber}@c.us`) {
            await msg.reply('🔒 *Akses 2FA Aktif:*\nKode OTP rahasia telah dikirimkan ke WhatsApp pribadi Admin. Silakan minta admin untuk memasukkan kode tersebut.');
        } else {
            await msg.reply('🔒 *Akses 2FA Aktif:*\nCek pesan terbaru dari saya. Kode OTP telah dikirimkan ke Anda.');
        }

    } catch (err) {
        logger.error(`[FIM] Gagal mengirim OTP Japri: ${err.message}`);
        return msg.reply('❌ *Gagal mengirim OTP.* Pastikan ADMIN_NUMBER di file .env sudah diisi dengan benar (Gunakan format 628xxx tanpa tanda + atau spasi).');
    }

    // Hapus OTP jika tidak ada balasan dalam 3 Menit
    if (otpTimeout) clearTimeout(otpTimeout);
    otpTimeout = setTimeout(() => {
        pendingOTP = null;
        // Beritahu Admin bahwa sesi hangus
        waClient.sendMessage(`${adminNumber}@c.us`, '⏳ *Sesi OTP Kedaluwarsa.* Permintaan Mode Maintenance dibatalkan secara otomatis.').catch(() => {});
        logger.warn('[FIM] Sesi OTP 2FA kedaluwarsa.');
    }, 3 * 60 * 1000);
};

const verifyMaintenanceOTP = async (msg, userOtp) => {
    if (!pendingOTP) {
        return msg.reply('⚠️ *Sesi Invalid:* Tidak ada permintaan Maintenance yang aktif atau OTP sudah hangus. Silakan ketik `!mt on` lagi.');
    }

    if (userOtp === pendingOTP) {
        // Jika OTP Benar -> Bersihkan timer dan OTP, lalu nyalakan Maintenance
        clearTimeout(otpTimeout);
        pendingOTP = null;
        await handleMaintenance(msg, true);
    } else {
        // Jika OTP Salah
        logger.warn(`[SECURITY] Upaya 2FA Maintenance gagal! OTP yang dimasukkan salah.`);
        msg.reply('❌ *OTP SALAH!* Akses ditolak. Tameng FIM tetap menyala.');
    }
};

// ==========================================
// --- FUNGSI MAINTENANCE INTI ---
// ==========================================

const handleMaintenance = async (msg, status) => {
    isMaintenance = status;

    if (status) {
        logger.info('[FIM] Mode Maintenance DIAKTIFKAN melalui otentikasi 2FA.');
        await msg.reply('🛠️ *MODE MAINTENANCE AKTIF*\n\nOtentikasi berhasil! Sistem FIM & Auto-Restore ditangguhkan (PAUSED). Anda bebas mengedit, mengunggah, atau menghapus file di server saat ini tanpa diganggu bot.');
    } else {
        logger.info('[FIM] Mode Maintenance DINONAKTIFKAN. Memperbarui brankas backup...');
        await msg.reply('⏳ *Menyimpan Perubahan Anda...*\nSistem sedang menyalin kode terbaru Anda ke brankas rahasia...');
        
        try {
            // Hapus backup lama, ganti dengan yang baru
            fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
            fs.cpSync(PROTECTED_DIR, BACKUP_DIR, { recursive: true });
            
            await msg.reply('🛡️ *MODE MAINTENANCE NONAKTIF*\n\nBrankas Backup berhasil diperbarui dengan kode terbaru Anda. Sistem FIM kembali aktif menjaga server 24/7!');
        } catch (err) {
            logger.error(`[FIM] Gagal update brankas: ${err.message}`);
            await msg.reply(`❌ *Gagal memperbarui brankas:* ${err.message}`);
        }
    }
};

const startFIM = (client) => {
    waClient = client; // [BARU] Simpan koneksi WA agar bisa digunakan untuk kirim pesan Japri
    
    if (!createInitialBackup()) return;

    const watcher = chokidar.watch(PROTECTED_DIR, {
        ignored: /(^|[\/\\])\../, 
        persistent: true,
        ignoreInitial: true, 
    });

    watcher
        .on('add', (filePath) => {
            if (isRestoring || isMaintenance) return;
            isRestoring = true;
            
            try {
                fs.unlinkSync(filePath);
                sendAlert(client, 'Penyusupan File Baru', filePath, 'Menghapus file ilegal');
            } catch (err) {}

            setTimeout(() => { isRestoring = false; }, 1000);
        })
        .on('change', (filePath) => {
            if (isRestoring || isMaintenance) return;
            isRestoring = true;

            try {
                const relativePath = path.relative(PROTECTED_DIR, filePath);
                const backupFilePath = path.join(BACKUP_DIR, relativePath);

                if (fs.existsSync(backupFilePath)) {
                    fs.copyFileSync(backupFilePath, filePath);
                    sendAlert(client, 'Modifikasi Ilegal (Deface/Inject)', filePath, 'Menimpa (Restore) dari Backup');
                }
            } catch (err) {}

            setTimeout(() => { isRestoring = false; }, 1000);
        })
        .on('unlink', (filePath) => {
            if (isRestoring || isMaintenance) return;
            isRestoring = true;

            try {
                const relativePath = path.relative(PROTECTED_DIR, filePath);
                const backupFilePath = path.join(BACKUP_DIR, relativePath);

                if (fs.existsSync(backupFilePath)) {
                    fs.copyFileSync(backupFilePath, filePath);
                    sendAlert(client, 'Penghapusan File Ilegal', filePath, 'Memulihkan file dari Backup');
                }
            } catch (err) {}

            setTimeout(() => { isRestoring = false; }, 1000);
        });
};

module.exports = { startFIM, handleMaintenance, requestMaintenance, verifyMaintenanceOTP };