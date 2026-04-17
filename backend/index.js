const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Inisialisasi Client WhatsApp dengan LocalAuth untuk menyimpan sesi
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "cyber-team-session" }),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

// Event: Menampilkan QR Code di terminal
client.on('qr', (qr) => {
    console.log('\n[!] SCAN QR CODE INI MENGGUNAKAN WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

// Event: Ketika WhatsApp siap digunakan
client.on('ready', () => {
    console.log('[+] WhatsApp Gateway Berhasil Terhubung dan Siap Digunakan!');
});

// Event: Menangkap pesan masuk (Opsional: untuk chatbot/OSINT commands)
client.on('message', async msg => {
    // Contoh sederhana: merespon perintah !ping
    if (msg.body === '!ping') {
        msg.reply('Pong! Sistem monitoring aktif.');
    }
});

client.initialize();

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Endpoint untuk memeriksa status koneksi
app.get('/api/status', (req, res) => {
    const isConnected = client.info ? true : false;
    res.json({
        status: isConnected ? 'connected' : 'disconnected',
        info: client.info
    });
});

// Endpoint untuk mengirim pesan teks
app.post('/api/send-message', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ status: 'error', message: 'Parameter number dan message wajib diisi!' });
    }

    try {
        // Format nomor telepon (Tambahkan @c.us untuk format WhatsApp)
        // Pastikan nomor diawali dengan kode negara tanpa '+' (misal: 62812xxx)
        const formattedNumber = `${number}@c.us`;
        
        // Cek apakah nomor terdaftar di WhatsApp
        const isRegistered = await client.isRegisteredUser(formattedNumber);
        
        if (!isRegistered) {
            return res.status(404).json({ status: 'error', message: 'Nomor tidak terdaftar di WhatsApp.' });
        }

        // Kirim pesan
        await client.sendMessage(formattedNumber, message);
        
        res.status(200).json({ 
            status: 'success', 
            message: 'Pesan berhasil dikirim',
            data: { to: number }
        });

    } catch (error) {
        console.error('Error saat mengirim pesan:', error);
        res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan', error: error.message });
    }
});

// Jalankan Server Express
app.listen(port, () => {
    console.log(`[+] Server API berjalan di http://localhost:${port}`);
});