const db = require('../config/firebase');
const admin = require('firebase-admin');
const { formatPhoneNumber } = require('../utils/formatter');
const logger = require('../utils/logger');

const ALLOWED_ALERT_LEVELS = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const MAX_MESSAGE_LENGTH = 2000;

const sendAlert = client => async (req, res) => {
    const { number, alertLevel, message } = req.body;

    if (typeof number !== 'string' || typeof message !== 'string' || !number.trim() || !message.trim()) {
        return res.status(400).json({ status: 'error', message: 'Parameter number dan message wajib diisi.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ status: 'error', message: `Message maksimal ${MAX_MESSAGE_LENGTH} karakter.` });
    }

    try {
        const formattedNumber = formatPhoneNumber(number);
        const normalizedLevel = String(alertLevel || 'INFO').toUpperCase();
        const level = ALLOWED_ALERT_LEVELS.has(normalizedLevel) ? normalizedLevel : 'INFO';
        const waMessage = `*[CYBER ALERT: ${level}]*\n\n${message.trim()}`;

        const isRegistered = await client.isRegisteredUser(formattedNumber);
        if (!isRegistered) {
            logger.warn(`[API-ALERT] Nomor tujuan tidak terdaftar: ${formattedNumber}`);
            return res.status(404).json({ status: 'error', message: 'Nomor tidak terdaftar di WhatsApp.' });
        }

        await client.sendMessage(formattedNumber, waMessage);
        await db.collection('alert_history').add({
            targetNumber: formattedNumber,
            level,
            message: message.trim(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`[API-ALERT] Alert terkirim ke ${formattedNumber}, level ${level}.`);
        return res.status(200).json({ status: 'success', message: 'Alert terkirim dan tercatat.' });
    } catch (error) {
        logger.error(`[API-ALERT] Gagal mengirim alert: ${error.message}`);
        return res.status(500).json({ status: 'error', message: 'Gagal memproses alert.' });
    }
};

module.exports = { sendAlert };
