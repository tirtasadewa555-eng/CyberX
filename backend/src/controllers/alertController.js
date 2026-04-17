const db = require('../config/firebase');
const admin = require('firebase-admin');
const { formatPhoneNumber } = require('../utils/formatter');
const logger = require('../utils/logger'); // [NEW] Import logger

// Kita memerlukan instance client WA, ini akan di-inject dari routes
const sendAlert = (client) => async (req, res) => {
    const { number, alertLevel, message } = req.body;

    if (!number || !message) {
        logger.warn(`[API-ALERT] Pengiriman ditolak: Parameter number atau message kosong.`);
        return res.status(400).json({ status: 'error', message: 'Parameter number dan message wajib diisi!' });
    }

    try {
        const formattedNumber = formatPhoneNumber(number);
        const level = alertLevel || 'INFO';
        const waMessage = `*[🚨 CYBER ALERT: ${level}]*\n\n${message}`;
        
        // Validasi apakah nomor terdaftar di WA
        const isRegistered = await client.isRegisteredUser(formattedNumber);
        if (!isRegistered) {
            logger.warn(`[API-ALERT] Gagal: Nomor ${number} tidak terdaftar di jaringan WhatsApp.`);
            return res.status(404).json({ status: 'error', message: 'Nomor tidak terdaftar di jaringan WhatsApp.' });
        }

        // Kirim Pesan
        await client.sendMessage(formattedNumber, waMessage);
        
        // Simpan log ke Firebase
        await db.collection('alert_history').add({
            targetNumber: number,
            level: level,
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // [NEW] Simpan log ke file lokal untuk audit trail
        logger.info(`[API-ALERT] TERKIRIM ke ${number} | Level: ${level} | Pesan: ${message}`);
        
        res.status(200).json({ status: 'success', message: 'Alert terkirim & tercatat.' });

    } catch (error) {
        console.error('[Error Alert Controller]:', error);
        
        // [NEW] Simpan log error secara detail
        logger.error(`[API-ALERT] SISTEM ERROR saat kirim ke ${number}: ${error.message}`);
        
        res.status(500).json({ status: 'error', message: 'Gagal memproses alert', error: error.message });
    }
};

module.exports = { sendAlert };