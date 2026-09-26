const crypto = require('crypto');
const express = require('express');
const { sendAlert } = require('../controllers/alertController');
const logger = require('../utils/logger');

const router = express.Router();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestsByIp = new Map();

const getClientIp = req => req.ip || req.socket.remoteAddress || 'unknown';

const requireApiToken = (req, res, next) => {
    const configuredToken = process.env.API_AUTH_TOKEN || '';
    const suppliedHeader = req.get('authorization') || '';
    const suppliedToken = suppliedHeader.startsWith('Bearer ')
        ? suppliedHeader.slice(7)
        : req.get('x-api-token') || '';

    if (!configuredToken) {
        logger.error('[API-AUTH] API_AUTH_TOKEN belum dikonfigurasi. Request ditolak.');
        return res.status(503).json({ status: 'error', message: 'API belum dikonfigurasi.' });
    }

    const expected = Buffer.from(configuredToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
        logger.warn(`[API-AUTH] Token tidak valid dari ${getClientIp(req)}`);
        return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
    }

    return next();
};

const rateLimit = (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const record = requestsByIp.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

    if (now >= record.resetAt) {
        record.count = 0;
        record.resetAt = now + WINDOW_MS;
    }
    record.count += 1;
    requestsByIp.set(ip, record);

    if (record.count > MAX_REQUESTS_PER_WINDOW) {
        logger.warn(`[API-RATE] Batas request terlampaui dari ${ip}`);
        return res.status(429).json({ status: 'error', message: 'Terlalu banyak request. Coba lagi nanti.' });
    }
    return next();
};

setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestsByIp.entries()) {
        if (now >= record.resetAt) requestsByIp.delete(ip);
    }
}, WINDOW_MS).unref();

module.exports = waClient => {
    router.use(requireApiToken, rateLimit);
    router.post('/send-alert', sendAlert(waClient));
    router.get('/status', (req, res) => {
        res.json({
            service: 'WhatsApp Gateway',
            status: waClient.info ? 'online' : 'offline'
        });
    });
    return router;
};
