const logger = require('../utils/logger');

const handleHoneyTokenTrigger = async (client, req) => {
    const adminNumber = process.env.ADMIN_NUMBER;
    if (!adminNumber) return;

    // Menangkap data intelijen dari peretas
    const intruderData = {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown',
        referer: req.headers['referer'] || 'Direct Access',
        timestamp: new Date().toLocaleString('id-ID'),
        // Jika Anda menggunakan layanan GeoIP eksternal, Anda bisa menambahkan lokasi di sini
    };

    logger.warn(`[HONEY-TOKEN] TRAPPED! IP: ${intruderData.ip} mengakses file umpan.`);

    const alertMsg = `
🚨 *CYBER-X HONEY-TOKEN DETONATED* 🚨
Seorang penyusup baru saja memakan umpan!

🕵️ *INTELIJEN PENYUSUP:*
📍 *IP Address:* \`${intruderData.ip}\`
📱 *User Agent:* \`${intruderData.userAgent}\`
🔗 *Sumber/Referer:* ${intruderData.referer}
⏰ *Waktu:* ${intruderData.timestamp}

⚠️ *Tindakan:* Bot telah mencatat sidik jari perangkat ini. Gunakan \`!ban ${intruderData.ip}\` untuk memutus akses secara permanen.`.trim();

    try {
        await client.sendMessage(`${adminNumber}@c.us`, alertMsg);
    } catch (err) {
        logger.error(`[HONEY-TOKEN] Gagal kirim alert: ${err.message}`);
    }
};

module.exports = { handleHoneyTokenTrigger };