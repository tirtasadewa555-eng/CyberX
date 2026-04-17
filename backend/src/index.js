require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// --- IMPORT CORE UTILS & MIDDLEWARE ---
const logger = require('./utils/logger');
const wafMiddleware = require('./wa_features/wafMiddleware'); // [PERISAI WAF NODEJS]

// --- IMPORT FITUR WHATSAPP & SECURITY ---
const apiRoutes = require('./routes/apiRoutes');
const { handleAIPrompt } = require('./wa_features/aiHandler');
const { handleReport } = require('./wa_features/reportHandler');
const { handleStatusCheck } = require('./wa_features/statusHandler');
const { handleSystemInfo } = require('./wa_features/systemHandler');
const { handleNetworkScan } = require('./wa_features/scanHandler');
const { handleBanIP, handleRecap } = require('./wa_features/firewallHandler');
const { handleVirtualPatch, deployHoneyToken } = require('./wa_features/virtualPatch'); 
const { startIPS } = require('./wa_features/logWatcher'); 
const { startFIM, handleMaintenance, requestMaintenance, verifyMaintenanceOTP } = require('./wa_features/autoRestore'); // [UPDATE - TAMBAH 2FA OTP]
const { handleHoneyTokenTrigger } = require('./wa_features/honeyToken'); 

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE LAYER ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// AKTIFKAN WAF INTERNAL (Mencegah serangan langsung ke API Node.js)
app.use(wafMiddleware); 

// --- KONFIGURASI PUPPETEER HANDAL ---
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "cyber-gateway-session" }),
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

// --- EVENT WHATSAPP ---

client.on('qr', (qr) => {
    console.log('\n[!] AUTHENTICATION REQUIRED. SCAN QR CODE DI BAWAH:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    const msg = 'Cyber-X Gateway is ONLINE! Sistem pertahanan berlapis diaktifkan.';
    console.log(`\n[+] ${msg}`);
    logger.info(msg); 

    // Jalankan Intrusion Prevention System (Pantau Log SSH/Web)
    startIPS(client);

    // Jalankan File Integrity Monitoring (Pantau Modifikasi File)
    startFIM(client); 
});

client.on('auth_failure', msg => {
    const errMsg = 'AUTH FAILURE: Sesi tidak valid atau kadaluarsa.';
    console.error(`\n[!] ${errMsg}`);
    logger.error(`${errMsg} | Detail: ${msg}`);
});

// Fitur Self-Healing: Paksa keluar agar PM2 restart bersih jika disconnect
client.on('disconnected', async (reason) => {
    const warnMsg = `WARNING: WhatsApp Client Terputus! Alasan: ${reason}`;
    logger.warn(warnMsg);
    console.log(`\n[!] ${warnMsg}`);
    process.exit(1); 
});

// --- ROUTING PESAN MASUK ---
client.on('message', async msg => {
    const senderNumber = msg.from.replace('@c.us', '');
    const text = msg.body ? msg.body.trim() : '';

    if (!text) return;

    logger.info(`[INBOX] Dari ${senderNumber}: ${text}`);

    try {
        if (text === '!menu' || text === '!help') {
            const menu = `
*🤖 CYBER-X GATEWAY MENU*
_Status: Shield Active | Port: ${PORT}_

📝 *OPERASIONAL:*
• \`!ai <tanya>\` : Konsultasi Tech & OSINT.
• \`!lapor <info>\` : Simpan log ke Database.
• \`!cekstatus\` : Lihat riwayat laporan.

🛡️ *SECURITY & FIREWALL:*
• \`!vpatch <nginx/apache/nodejs>\` : Tanam Perisai WAF.
• \`!token\` : Tanam Ranjau.
• \`!scan <target>\` : Audit Port (Nmap).
• \`!ban <IP>\` : Blacklist IP Manual.
• \`!rekap\` : Lihat Daftar Blacklist.
• \`!mt on/off\` : Mode Perawatan.

📊 *MONITORING:*
• \`!sysinfo\` : Cek Resource Server.
• \`!ping\` : Tes koneksi sistem.

_Gunakan perintah dengan prefix (!) untuk merespons._

© Copyright Cyber Sentinel Secure Team`.trim();
            await msg.reply(menu);
        }
        else if (text.startsWith('!ai ')) {
            await handleAIPrompt(msg, senderNumber, text.substring(4));
        } 
        else if (text.startsWith('!lapor ')) {
            await handleReport(msg, senderNumber, text.substring(7));
        }
        else if (text === '!cekstatus') {
            await handleStatusCheck(msg, senderNumber);
        }
        else if (text === '!sysinfo') {
            await handleSystemInfo(msg);
        }
        else if (text.startsWith('!scan ')) {
            await handleNetworkScan(msg, text.substring(6).trim());
        }
        else if (text.startsWith('!ban ')) { 
            const ip = text.substring(5).trim();
            await handleBanIP(msg, ip);
        }
        else if (text === '!rekap') { 
            await handleRecap(msg);
        }
        else if (text.startsWith('!vpatch ')) { 
            const type = text.substring(8).trim().toLowerCase();
            await handleVirtualPatch(msg, type);
        }
        else if (text === '!token') { 
            await deployHoneyToken(msg);
        }
        else if (text === '!mt on') { 
            // Mengalihkan perintah untuk meminta OTP 2FA terlebih dahulu
            await requestMaintenance(msg);
        }
        else if (text.startsWith('!otp ')) { 
            // Memverifikasi kode OTP yang dimasukkan
            const userOtp = text.substring(5).trim();
            await verifyMaintenanceOTP(msg, userOtp);
        }
        else if (text === '!mt off') { 
            // Matikan maintenance (menyalakan pertahanan) tidak butuh OTP
            await handleMaintenance(msg, false);
        }
        else if (text === '!ping') {
            await msg.reply('🏓 *Pong!* Gateway aktif dan responsif.');
        }
    } catch (err) {
        logger.error(`Error processing message: ${err.message}`);
        if (err.message.includes('Execution context was destroyed')) process.exit(1);
    }
});

// --- ANTI-ZOMBIE & ERROR HANDLING ---

const cleanShutdown = async (signal) => {
    logger.info(`[SYSTEM] Sinyal ${signal}. Mematikan semua engine secara aman...`);
    try {
        await client.destroy();
        console.log('[+] Client hancur.');
    } catch (err) {
        console.error('[!] Gagal shutdown bersih:', err.message);
    } finally {
        process.exit(0);
    }
};

process.on('SIGINT', () => cleanShutdown('SIGINT'));
process.on('SIGTERM', () => cleanShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.error(`[FATAL] Unhandled Rejection: ${reason}`);
    if (reason.toString().includes('Execution context was destroyed') || 
        reason.toString().includes('already running')) {
        process.exit(1);
    }
});

// INISIALISASI WHATSAPP
client.initialize().catch(err => {
    logger.error(`[FATAL] Gagal Start Client: ${err.message}`);
    process.exit(1);
});

// ==========================================
// --- WEB SERVER & API ROUTES LAYER ---
// ==========================================

// --- 🍯 HONEY-TOKEN TRACKER ENDPOINT ---
app.get('/assets/css/theme-dark-cache.css', async (req, res) => {
    handleHoneyTokenTrigger(client, req);
    res.set('Content-Type', 'text/css');
    res.send('/* Theme Cache Initialized - CyberX */');
});

// --- REST API ROUTES ---
app.use('/api', apiRoutes(client));

app.listen(PORT, () => {
    const startMsg = `Gateway API & WAF Engine running on port ${PORT}`;
    console.log(`\n[+] ${startMsg}`);
    logger.info(startMsg);
});
