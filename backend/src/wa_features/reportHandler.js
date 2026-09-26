const db = require('../config/firebase');
const admin = require('firebase-admin');
const logger = require('../utils/logger');

async function handleReport(msg, senderNumber, reportContent) {
    const content = String(reportContent || '').trim();
    if (!content || content.length > 2000) {
        return msg.reply('Isi laporan wajib diisi dan maksimal 2000 karakter.');
    }

    try {
        await db.collection('cyber_reports').add({
            reporter: senderNumber,
            content,
            status: 'pending',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return msg.reply('Laporan berhasil disimpan.');
    } catch (error) {
        logger.error(`[REPORT] Gagal menyimpan laporan: ${error.message}`);
        return msg.reply('Gagal menyimpan laporan ke database.');
    }
}

module.exports = { handleReport };
