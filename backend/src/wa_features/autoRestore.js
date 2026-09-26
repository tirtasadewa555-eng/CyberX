const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const logger = require('../utils/logger');

const PROTECTED_DIR = process.env.PROTECTED_DIR || '/var/www/html';
const BACKUP_DIR = process.env.BACKUP_DIR || '/root/backup_vault';
const ADMIN_NUMBER = (process.env.ADMIN_NUMBER || '').replace(/\D/g, '');
const ADMIN_CHAT_ID = ADMIN_NUMBER ? `${ADMIN_NUMBER}@c.us` : null;
const OTP_TTL_MS = 3 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;

let isRestoring = false;
let isMaintenance = false;
let pendingMaintenance = null;
let otpTimeout = null;
let waClient = null;

const isAdminMessage = msg => Boolean(ADMIN_CHAT_ID && msg.from === ADMIN_CHAT_ID && !msg.from.endsWith('@g.us'));

const sendAlert = (client, type, file, action) => {
    if (!ADMIN_NUMBER) return;
    const alertMessage = [
        '*CYBER-X AUTO-RESTORE AKTIF*',
        'Deteksi perubahan file.',
        `File: \`${file}\``,
        `Kejadian: ${type}`,
        `Tindakan: ${action}`
    ].join('\n');
    client.sendMessage(ADMIN_CHAT_ID, alertMessage).catch(error => logger.error(`[FIM] Gagal kirim alert: ${error.message}`));
};

const createInitialBackup = () => {
    if (!fs.existsSync(PROTECTED_DIR)) {
        logger.error(`[FIM] PROTECTED_DIR tidak ditemukan: ${PROTECTED_DIR}`);
        return false;
    }
    if (!fs.existsSync(BACKUP_DIR)) {
        logger.info(`[FIM] Membuat backup awal di ${BACKUP_DIR}.`);
        fs.cpSync(PROTECTED_DIR, BACKUP_DIR, { recursive: true, dereference: false });
    }
    return true;
};

const clearPendingMaintenance = () => {
    if (otpTimeout) clearTimeout(otpTimeout);
    otpTimeout = null;
    pendingMaintenance = null;
};

const requestMaintenance = async msg => {
    if (!isAdminMessage(msg)) return msg.reply('⛔ Hanya administrator yang dapat mengubah mode maintenance.');
    if (!waClient) return msg.reply('Sesi WhatsApp belum siap.');

    const code = crypto.randomInt(100000, 1000000).toString();
    pendingMaintenance = {
        code,
        requesterChatId: msg.from,
        attempts: 0,
        expiresAt: Date.now() + OTP_TTL_MS
    };

    try {
        await waClient.sendMessage(ADMIN_CHAT_ID, [
            '*2FA REQUIRED*',
            'Permintaan mengaktifkan maintenance diterima.',
            `Kode OTP: \`${code}\``,
            `Konfirmasi dengan: \`!otp ${code}\``,
            'Kode berlaku selama 3 menit.'
        ].join('\n'));
        await msg.reply('Kode OTP telah dikirim ke chat pribadi administrator.');
    } catch (error) {
        clearPendingMaintenance();
        logger.error(`[FIM] Gagal mengirim OTP: ${error.message}`);
        return msg.reply('Gagal mengirim OTP.');
    }

    if (otpTimeout) clearTimeout(otpTimeout);
    otpTimeout = setTimeout(() => {
        clearPendingMaintenance();
        logger.warn('[FIM] Sesi OTP maintenance kedaluwarsa.');
    }, OTP_TTL_MS);
};

const verifyMaintenanceOTP = async (msg, userOtp) => {
    if (!isAdminMessage(msg) || !pendingMaintenance || pendingMaintenance.requesterChatId !== msg.from) {
        return msg.reply('⛔ Sesi OTP tidak valid.');
    }
    if (Date.now() > pendingMaintenance.expiresAt) {
        clearPendingMaintenance();
        return msg.reply('Sesi OTP telah kedaluwarsa.');
    }

    pendingMaintenance.attempts += 1;
    if (userOtp !== pendingMaintenance.code) {
        const attemptsLeft = MAX_OTP_ATTEMPTS - pendingMaintenance.attempts;
        logger.warn('[FIM] OTP maintenance salah.');
        if (attemptsLeft <= 0) {
            clearPendingMaintenance();
            return msg.reply('Terlalu banyak percobaan OTP. Sesi dibatalkan.');
        }
        return msg.reply(`OTP salah. Sisa percobaan: ${attemptsLeft}.`);
    }

    clearPendingMaintenance();
    return handleMaintenance(msg, true);
};

const handleMaintenance = async (msg, status) => {
    if (!isAdminMessage(msg)) return msg.reply('⛔ Hanya administrator yang dapat mengubah mode maintenance.');

    isMaintenance = status;
    if (status) {
        logger.info('[FIM] Mode maintenance diaktifkan.');
        return msg.reply('*MODE MAINTENANCE AKTIF*\nFIM dan auto-restore ditangguhkan.');
    }

    if (!fs.existsSync(PROTECTED_DIR)) {
        isMaintenance = true;
        logger.error(`[FIM] Tidak dapat memperbarui backup. PROTECTED_DIR tidak ditemukan: ${PROTECTED_DIR}`);
        return msg.reply('Gagal memperbarui backup. Mode maintenance tetap aktif.');
    }

    try {
        fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
        fs.cpSync(PROTECTED_DIR, BACKUP_DIR, { recursive: true, dereference: false });
        logger.info('[FIM] Backup baseline diperbarui dan mode maintenance dinonaktifkan.');
        return msg.reply('*MODE MAINTENANCE NONAKTIF*\nBackup baseline telah diperbarui. FIM aktif kembali.');
    } catch (error) {
        isMaintenance = true;
        logger.error(`[FIM] Gagal memperbarui backup: ${error.message}`);
        return msg.reply('Gagal memperbarui backup. Mode maintenance tetap aktif.');
    }
};

const startFIM = client => {
    waClient = client;
    if (!createInitialBackup()) return;

    const watcher = chokidar.watch(PROTECTED_DIR, {
        ignored: /(^|[\\/])\../,
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false
    });

    const finishRestore = () => setTimeout(() => { isRestoring = false; }, 1000);
    watcher.on('add', filePath => {
        if (isRestoring || isMaintenance) return;
        isRestoring = true;
        try {
            fs.unlinkSync(filePath);
            sendAlert(client, 'File baru', filePath, 'File dihapus');
        } catch (error) {
            logger.error(`[FIM] Gagal menghapus file baru ${filePath}: ${error.message}`);
        }
        finishRestore();
    }).on('change', filePath => {
        if (isRestoring || isMaintenance) return;
        isRestoring = true;
        try {
            const backupFilePath = path.join(BACKUP_DIR, path.relative(PROTECTED_DIR, filePath));
            if (fs.existsSync(backupFilePath)) {
                fs.copyFileSync(backupFilePath, filePath);
                sendAlert(client, 'Modifikasi file', filePath, 'File dipulihkan dari backup');
            }
        } catch (error) {
            logger.error(`[FIM] Gagal memulihkan ${filePath}: ${error.message}`);
        }
        finishRestore();
    }).on('unlink', filePath => {
        if (isRestoring || isMaintenance) return;
        isRestoring = true;
        try {
            const backupFilePath = path.join(BACKUP_DIR, path.relative(PROTECTED_DIR, filePath));
            if (fs.existsSync(backupFilePath)) {
                fs.copyFileSync(backupFilePath, filePath);
                sendAlert(client, 'Penghapusan file', filePath, 'File dipulihkan dari backup');
            }
        } catch (error) {
            logger.error(`[FIM] Gagal memulihkan file terhapus ${filePath}: ${error.message}`);
        }
        finishRestore();
    }).on('error', error => logger.error(`[FIM] Error watcher: ${error.message}`));
};

module.exports = { startFIM, handleMaintenance, requestMaintenance, verifyMaintenanceOTP };
