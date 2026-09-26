require('dotenv').config();
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const logger = require('./utils/logger');
const wafMiddleware = require('./wa_features/wafMiddleware');
const apiRoutes = require('./routes/apiRoutes');
const { handleAIPrompt } = require('./wa_features/aiHandler');
const { handleReport } = require('./wa_features/reportHandler');
const { handleStatusCheck } = require('./wa_features/statusHandler');
const { handleSystemInfo } = require('./wa_features/systemHandler');
const { handleNetworkScan } = require('./wa_features/scanHandler');
const { handleBanIP, handleRecap } = require('./wa_features/firewallHandler');
const { handleVirtualPatch, deployHoneyToken } = require('./wa_features/virtualPatch');
const { startIPS } = require('./wa_features/logWatcher');
const { startFIM, handleMaintenance, requestMaintenance, verifyMaintenanceOTP } = require('./wa_features/autoRestore');
const { handleHoneyTokenTrigger } = require('./wa_features/honeyToken');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_NUMBER = (process.env.ADMIN_NUMBER || '').replace(/\D/g, '');
const ADMIN_CHAT_ID = ADMIN_NUMBER ? `${ADMIN_NUMBER}@c.us` : null;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

if (!ADMIN_CHAT_ID) {
    logger.error('[CONFIG] ADMIN_NUMBER wajib diisi. Semua perintah WhatsApp akan ditolak.');
}

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(cors({
    origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('Origin tidak diizinkan oleh CORS.'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
}));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(wafMiddleware);

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'cyber-gateway-session' }),
    puppeteer: {
        headless: true,
        handleSIGINT: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--js-flags="--max-old-space-size=512"'
        ]
    }
});

const isAuthorizedAdminMessage = msg => Boolean(
    ADMIN_CHAT_ID && !msg.from.endsWith('@g.us') && msg.from === ADMIN_CHAT_ID
);

client.on('qr', qr => {
    console.log('\n[!] AUTHENTICATION REQUIRED. SCAN QR CODE DI BAWAH:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    const message = 'Cyber-X Gateway is ONLINE! Sistem pertahanan berlapis diaktifkan.';
    console.log(`\n[+] ${message}`);
    logger.info(message);
    startIPS(client);
    startFIM(client);
});

client.on('auth_failure', message => {
    logger.error(`AUTH FAILURE: Sesi tidak valid atau kadaluarsa. Detail: ${message}`);
});

client.on('disconnected', reason => {
    logger.warn(`WARNING: WhatsApp Client Terputus! Alasan: ${reason}`);
    process.exit(1);
});

client.on('message', async msg => {
    const text = msg.body ? msg.body.trim() : '';
    if (!text || !text.startsWith('!')) return;

    if (!isAuthorizedAdminMessage(msg)) {
        logger.warn(`[AUTH] Perintah WhatsApp ditolak dari ${msg.from}`);
        await msg.reply('⛔ Perintah ini hanya dapat digunakan oleh administrator melalui chat pribadi.');
        return;
    }

    const senderNumber = ADMIN_NUMBER;
    logger.info(`[INBOX] Perintah diterima dari administrator: ${text.split(/\s+/)[0]}`);

    try {
        if (text === '!menu' || text === '!help') {
            await msg.reply([
                '*CYBER-X GATEWAY MENU*',
                '',
                '*OPERASIONAL:*',
                '• `!ai <tanya>`',
                '• `!lapor <info>`',
                '• `!cekstatus`',
                '',
                '*SECURITY & FIREWALL:*',
                '• `!vpatch <nginx/apache/nodejs>`',
                '• `!token`',
                '• `!scan <target>`',
                '• `!ban <IP>`',
                '• `!rekap`',
                '• `!mt on/off`',
                '',
                '*MONITORING:*',
                '• `!sysinfo`',
                '• `!ping`'
            ].join('\n'));
        } else if (text.startsWith('!ai ')) {
            await handleAIPrompt(msg, senderNumber, text.substring(4));
        } else if (text.startsWith('!lapor ')) {
            await handleReport(msg, senderNumber, text.substring(7));
        } else if (text === '!cekstatus') {
            await handleStatusCheck(msg, senderNumber);
        } else if (text === '!sysinfo') {
            await handleSystemInfo(msg);
        } else if (text.startsWith('!scan ')) {
            await handleNetworkScan(msg, text.substring(6).trim());
        } else if (text.startsWith('!ban ')) {
            await handleBanIP(msg, text.substring(5).trim());
        } else if (text === '!rekap') {
            await handleRecap(msg);
        } else if (text.startsWith('!vpatch ')) {
            await handleVirtualPatch(msg, text.substring(8).trim().toLowerCase());
        } else if (text === '!token') {
            await deployHoneyToken(msg);
        } else if (text === '!mt on') {
            await requestMaintenance(msg);
        } else if (text.startsWith('!otp ')) {
            await verifyMaintenanceOTP(msg, text.substring(5).trim());
        } else if (text === '!mt off') {
            await handleMaintenance(msg, false);
        } else if (text === '!ping') {
            await msg.reply('Pong. Gateway aktif dan responsif.');
        }
    } catch (error) {
        logger.error(`Error processing WhatsApp command: ${error.message}`);
        if (error.message.includes('Execution context was destroyed')) process.exit(1);
        await msg.reply('Terjadi kesalahan saat memproses perintah.');
    }
});

const cleanShutdown = async signal => {
    logger.info(`[SYSTEM] Sinyal ${signal}. Mematikan semua engine secara aman...`);
    try {
        await client.destroy();
    } catch (error) {
        logger.error(`[SYSTEM] Gagal shutdown bersih: ${error.message}`);
    } finally {
        process.exit(0);
    }
};

process.on('SIGINT', () => cleanShutdown('SIGINT'));
process.on('SIGTERM', () => cleanShutdown('SIGTERM'));
process.on('unhandledRejection', reason => {
    logger.error(`[FATAL] Unhandled Rejection: ${reason}`);
    if (String(reason).includes('Execution context was destroyed') || String(reason).includes('already running')) {
        process.exit(1);
    }
});

client.initialize().catch(error => {
    logger.error(`[FATAL] Gagal Start Client: ${error.message}`);
    process.exit(1);
});

app.get('/assets/css/theme-dark-cache.css', async (req, res) => {
    await handleHoneyTokenTrigger(client, req);
    res.type('text/css').send('/* Theme Cache Initialized - CyberX */');
});

app.use('/api', apiRoutes(client));

app.use((error, req, res, next) => {
    if (error.message === 'Origin tidak diizinkan oleh CORS.') {
        logger.warn(`[CORS] Origin ditolak: ${req.headers.origin || 'unknown'}`);
        return res.status(403).json({ status: 'error', message: 'Origin tidak diizinkan.' });
    }
    logger.error(`[HTTP] ${error.message}`);
    return res.status(400).json({ status: 'error', message: 'Request tidak valid.' });
});

app.listen(PORT, () => {
    logger.info(`Gateway API & WAF Engine running on port ${PORT}`);
});
