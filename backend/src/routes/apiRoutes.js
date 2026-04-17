const express = require('express');
const { sendAlert } = require('../controllers/alertController');

const router = express.Router();

// Fungsi untuk menerima inject client WA dari index.js
module.exports = (waClient) => {
    router.post('/send-alert', sendAlert(waClient));
    
    // Endpoint check status API
    router.get('/status', (req, res) => {
        const isConnected = waClient.info ? true : false;
        res.json({
            service: 'WhatsApp Gateway',
            status: isConnected ? 'online' : 'offline'
        });
    });

    return router;
};