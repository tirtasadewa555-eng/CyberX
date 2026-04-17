const db = require('../config/firebase');
const admin = require('firebase-admin');

async function handleReport(msg, senderNumber, reportContent) {
    try {
        await db.collection('cyber_reports').add({
            reporter: senderNumber,
            content: reportContent,
            status: 'pending',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        msg.reply('✅ Laporan berhasil diamankan ke dalam database sistem.');
    } catch (error) {
        console.error('[Error Report Handler]:', error);
        msg.reply('❌ Gagal menyimpan laporan ke database.');
    }
}

module.exports = { handleReport };