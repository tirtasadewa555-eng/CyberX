const { exec } = require('child_process');
const logger = require('../utils/logger');

/**
 * Handler untuk pemindaian port menggunakan Nmap secara Asynchronous
 */
const handleNetworkScan = async (msg, target) => {
    // Validasi input untuk mencegah Command Injection
    const domainRegex = /^[a-zA-Z0-9.-]+$/;
    const ipRegex = /^[0-9.]+$/;

    if (!domainRegex.test(target) && !ipRegex.test(target)) {
        return msg.reply('❌ Format target tidak valid. Gunakan IP atau Domain (contoh: 192.168.1.1 atau google.com).');
    }

    await msg.reply(`🔍 *Memulai pemindaian pada target:* ${target}\nMohon tunggu, proses ini berjalan di latar belakang...`);

    // Perintah Nmap: -F (Fast scan), -sV (Service version detection)
    // Anda bisa menyesuaikan parameter sesuai kebutuhan
    const cmd = `nmap -F -sV ${target}`;

    logger.info(`[SCAN-START] Memulai nmap untuk: ${target}`);

    // Menjalankan proses secara async
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            logger.error(`[SCAN-ERROR] ${error.message}`);
            return msg.reply(`❌ *Pemindaian Gagal:*\n${error.message}`);
        }
        if (stderr) {
            logger.warn(`[SCAN-STDERR] ${stderr}`);
        }

        // Format hasil scan agar rapi di WhatsApp
        const result = `
🛡️ *HASIL PEMINDAIAN CYBER-X*
🎯 *Target:* ${target}

\`\`\`
${stdout.trim()}
\`\`\`

_Status: Audit Selesai_
        `.trim();

        // Mengirimkan hasil setelah proses selesai
        msg.reply(result);
        logger.info(`[SCAN-SUCCESS] Hasil dikirim untuk target: ${target}`);
    });
};

module.exports = { handleNetworkScan };