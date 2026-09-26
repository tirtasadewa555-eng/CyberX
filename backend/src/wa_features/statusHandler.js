const db = require('../config/firebase');
const logger = require('../utils/logger');

const handleStatusCheck = async (msg, senderNumber) => {
    try {
        const snapshot = await db.collection('cyber_reports')
            .where('reporter', '==', senderNumber)
            .orderBy('timestamp', 'desc')
            .limit(3)
            .get();

        if (snapshot.empty) {
            return msg.reply('Belum ada riwayat laporan.');
        }

        const entries = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : 'Waktu tidak diketahui';
            entries.push(`*Tgl:* ${date}\n*Laporan:* ${data.content}\n*Status:* ${data.status || 'pending'}`);
        });
        await msg.reply(`*[Status Laporan]*\n\n${entries.join('\n\n')}`);
        logger.info(`[REPORT] Status laporan dikirim untuk ${senderNumber}.`);
    } catch (error) {
        logger.error(`[STATUS] Gagal mengambil laporan: ${error.message}`);
        await msg.reply('Terjadi kesalahan saat mengambil laporan.');
    }
};

module.exports = { handleStatusCheck };
