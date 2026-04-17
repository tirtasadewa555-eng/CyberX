const fs = require('fs');
const { Tail } = require('tail');
const { exec } = require('child_process');
const logger = require('../utils/logger');

// Penyimpanan sementara untuk hitungan serangan
const attackCache = new Map();
const MAX_ATTEMPTS = 3; // Blokir setelah 3x percobaan jahat
const CACHE_TIMEOUT = 10 * 60 * 1000; // Reset hitungan setelah 10 menit

// Pola Serangan yang diincar (Regex)
const patterns = [
    {
        type: "SSH Brute Force",
        // Mencari IP dari log gagal login SSH
        regex: /Failed password for .* from ((?:[0-9]{1,3}\.){3}[0-9]{1,3})/
    },
    {
        type: "Web Vulnerability Probe",
        // Mendeteksi pencarian file sensitif (.env, wp-admin, config)
        // Asumsi format Nginx/Apache: IP - - [date] "GET /.env ...
        regex: /^((?:[0-9]{1,3}\.){3}[0-9]{1,3}).*"(?:GET|POST)\s+\/(?:\.env|wp-admin|phpmyadmin|config)/i
    }
];

const banIP = async (client, ip, type) => {
    logger.warn(`[IPS] Memblokir IP ${ip} karena ${type}`);

    // Eksekusi pemblokiran UFW
    exec(`ufw deny from ${ip} comment 'Auto-IPS: ${type}'`, (err) => {
        if (err) {
            logger.error(`[IPS-ERROR] Gagal blokir IP ${ip}: ${err.message}`);
            return;
        }

        const alertMsg = `
🚨 *CYBER-X IPS ALERT* 🚨
Sistem mendeteksi dan memblokir serangan aktif!

🎯 *Target:* Zotac Server (LanderSpot Network)
🛑 *IP Diblokir:* \`${ip}\`
🔪 *Tipe Serangan:* ${type}

_Sistem Firewall telah mengisolasi IP ini secara permanen._`.trim();

        // Mengirim peringatan ke nomor admin (Ambil dari .env atau fallback ke console)
        const adminNumber = process.env.ADMIN_NUMBER; 
        if (adminNumber) {
            client.sendMessage(`${adminNumber}@c.us`, alertMsg).catch(e => console.error("Gagal kirim alert IPS:", e));
        }
    });
};

const processLogLine = (client, line) => {
    for (const { type, regex } of patterns) {
        const match = line.match(regex);
        if (match) {
            const ip = match[1];

            // Whitelist: Abaikan IP lokal / IP Anda sendiri agar tidak kena senjata makan tuan
            if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1') return;

            let attempts = (attackCache.get(ip) || 0) + 1;
            attackCache.set(ip, attempts);

            logger.info(`[IPS-TRACK] ${ip} mencoba menyerang (${type}) - ${attempts}/${MAX_ATTEMPTS}`);

            if (attempts >= MAX_ATTEMPTS) {
                banIP(client, ip, type);
                attackCache.delete(ip); // Hapus dari memori setelah diblokir
            }

            // Hapus cache jika tidak ada serangan lanjutan dalam 10 menit
            setTimeout(() => {
                if (attackCache.has(ip)) attackCache.delete(ip);
            }, CACHE_TIMEOUT);

            break; 
        }
    }
};

const startIPS = (client) => {
    const logFiles = [
        '/var/log/auth.log',                  // Target utama: SSH
        '/var/log/nginx/access.log',          // Target utama: Nginx Web
        '/var/log/apache2/access.log'         // Target utama: Apache Web
    ];

    logger.info('[IPS] Inisialisasi Modul Auto-Block...');

    logFiles.forEach(file => {
        if (fs.existsSync(file)) {
            const tail = new Tail(file);
            tail.on("line", (data) => processLogLine(client, data));
            tail.on("error", (error) => logger.error(`[IPS] Error membaca ${file}:`, error));
            console.log(`[+] Cyber-X IPS Aktif memantau: ${file}`);
        } else {
            console.log(`[-] File log tidak ada (diabaikan): ${file}`);
        }
    });
};

module.exports = { startIPS };