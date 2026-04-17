const db = require('../config/firebase');
const logger = require('../utils/logger');

const handleStatusCheck = async (msg, senderNumber) => {
    try {
        // Asumsi nama collection tempat Anda menyimpan laporan adalah 'reports'
        const reportsRef = db.collection('reports');
        
        // Mengambil maksimal 3 laporan terakhir dari nomor tersebut
        const snapshot = await reportsRef
            .where('sender', '==', senderNumber)
            // HAPUS SEMENTARA baris orderBy di bawah jika error Index muncul di terminal
            .orderBy('timestamp', 'desc') 
            .limit(3)
            .get();

        if (snapshot.empty) {
            logger.info(`[CMD-CEK] Laporan kosong untuk nomor ${senderNumber}`);
            return msg.reply('Anda belum memiliki riwayat laporan, atau laporan sudah ditutup.');
        }

        let replyMessage = '*[📋 Status Laporan Anda]*\n\n';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID') : 'Waktu tidak diketahui';
            const status = data.status || '🔴 Pending (Belum diproses)';
            
            replyMessage += `*Tgl:* ${date}\n*Laporan:* ${data.content}\n*Status:* ${status}\n\n`;
        });

        await msg.reply(replyMessage);
        logger.info(`[CMD-CEK] Berhasil mengirim status ke ${senderNumber}`);

    } catch (error) {
        // Ini akan mencatat error ASLINYA ke dalam file log dan terminal
        console.error('\n[Error Status Handler]:', error);
        logger.error(`[STATUS-ERROR] Gagal ambil data untuk ${senderNumber}: ${error.message}`);
        
        msg.reply('Terjadi kesalahan sistem saat mengambil data dari database.');
    }
};

module.exports = { handleStatusCheck };