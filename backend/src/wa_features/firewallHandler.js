const { exec } = require('child_process');
const logger = require('../utils/logger');

// --- FITUR 1: BAN IP MANUAL ---
const handleBanIP = async (msg, ipAddress) => {
    // Validasi format IP Address (IPv4)
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    if (!ipRegex.test(ipAddress)) {
        return msg.reply('❌ Format IP tidak valid. Contoh: !ban 192.168.1.50');
    }

    await msg.reply(`🛡️ *Menambahkan IP ${ipAddress} ke Blacklist Server...*`);

    // Mengeksekusi perintah UFW di Ubuntu (Tanpa sudo karena akses via root)
    const cmd = `ufw deny from ${ipAddress} comment 'Banned via Cyber-X Bot'`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            logger.error(`[FIREWALL-ERROR] Gagal block IP: ${error.message}`);
            return msg.reply(`❌ *Gagal memblokir IP:*\nSistem gagal mengeksekusi perintah. Pastikan UFW (Firewall) sudah terinstal dan dalam status aktif.`);
        }

        const result = `
🛑 *IP BLACKLISTED!*
Target: \`${ipAddress}\`
Status: Akses diputus dari semua port server.

_Tindakan ini telah dicatat di log keamanan._`.trim();

        logger.info(`[FIREWALL-BAN] IP ${ipAddress} berhasil di-blacklist.`);
        msg.reply(result);
    });
};

// --- FITUR 2: REKAP SERANGAN ---
const handleRecap = async (msg) => {
    await msg.reply('⏳ *Mengambil data rekap keamanan dari Firewall...*');

    // Mengambil daftar IP yang statusnya DENY (Ditolak) di UFW
    exec(`ufw status | grep DENY`, (error, stdout) => {
        if (error || !stdout.trim()) {
            return msg.reply('✅ *Aman Terkendali!*\nBelum ada serangan atau IP jahat yang diblokir oleh sistem sejauh ini.');
        }

        // Memproses output terminal menjadi daftar yang rapi
        const lines = stdout.trim().split('\n');
        const blockedCount = lines.length;
        
        // Mengambil 10 IP terakhir yang diblokir agar chat WA tidak terlalu panjang
        const topList = lines.slice(0, 10).map(line => {
            // Merapikan spasi berlebih dari output UFW
            return `• ${line.replace(/\s+/g, ' ').trim()}`;
        }).join('\n');

        const result = `
🛡️ *REKAP KEAMANAN CYBER-X* 🛡️

📊 *Total IP Terblokir:* ${blockedCount} penyerang

*10 Pemblokiran Terakhir:*
${topList}

_Sistem IPS aktif melindungi jaringan 24/7._`.trim();

        logger.info(`[FIREWALL-REKAP] Admin mengecek rekap serangan. Total: ${blockedCount} IP.`);
        msg.reply(result);
    });
};

// Pastikan kedua fungsi diekspor agar bisa dibaca oleh index.js
module.exports = { handleBanIP, handleRecap };