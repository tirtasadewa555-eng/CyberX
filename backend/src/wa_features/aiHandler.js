// Import Load Balancer Gemini dan Logger
// Sesuaikan '../utils/gemini' jika file gemini.js Anda ada di folder config
const { analyzeWithGemini } = require('../utils/gemini'); 
const logger = require('../utils/logger');

// ==========================================
// 1. KUSTOMISASI PERSONA AI (SYSTEM PROMPT)
// ==========================================
const systemPersona = `Anda adalah "Cyber-X", asisten AI spesialis Cyber Security, Network Engineering, dan Open Source Intelligence (OSINT).
Gaya bahasa Anda: Taktis, profesional, langsung pada intinya (no-nonsense), dan logis.
Keahlian khusus Anda meliputi:
- Analisis dan konfigurasi jaringan tingkat lanjut (khususnya MikroTik, Mangle rules, Load Balancing failover).
- Web development dan server management (Node.js, integrasi Cloudflare, migrasi OS Ubuntu).
- Investigasi OSINT dan pembuatan script otomatisasi.

Aturan ketat: 
1. Jangan menggunakan sapaan ramah tamah yang berlebihan (seperti "Halo, ada yang bisa saya bantu?").
2. Jika diminta script atau kode, berikan yang paling efisien, aman, dan berikan komentar singkat pada bagian yang krusial.
3. Anda sedang berkomunikasi via WhatsApp, jadi gunakan pemformatan tebal (*) untuk penekanan dan miring (_) untuk istilah teknis secara proporsional.`;

// ==========================================
// 2. FUNGSI ANTI-BANNED (HUMAN SIMULATOR)
// ==========================================
// Fungsi untuk membuat jeda waktu acak (dalam milidetik)
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const handleAIPrompt = async (msg, senderNumber, prompt) => {
    let chat;
    try {
        chat = await msg.getChat();

        // [ANTI-BANNED] 1. Beri tanda "Read" (Centang Biru)
        await chat.sendSeen();

        // [ANTI-BANNED] 2. Jeda "membaca" sebelum mulai mengetik (1 - 2.5 detik)
        await new Promise(resolve => setTimeout(resolve, randomDelay(1000, 2500)));

        // [ANTI-BANNED] 3. Munculkan status "Sedang mengetik..." di HP pengirim
        await chat.sendStateTyping();

        logger.info(`[AI-PROCESS] Memproses prompt dari ${senderNumber}: ${prompt}`);

        // Gabungkan Persona dengan Prompt User (Format untuk Gemini API standar)
        const fullPrompt = `${systemPersona}\n\n[Instruksi dari Tim]:\n${prompt}`;

        // Panggil model Gemini menggunakan Load Balancer
        // Semua proses rotasi key dan auto-failover ditangani secara otomatis di gemini.js
        const responseText = await analyzeWithGemini(fullPrompt);

        // [ANTI-BANNED] 4. Kalkulasi Waktu Ketik Berdasarkan Panjang Pesan
        // Manusia tidak mungkin mengetik 1000 huruf dalam 1 detik.
        // Kita simulasikan waktu ketik: 1 detik per 100 karakter (maksimal 5 detik agar user tidak bosan menunggu).
        const typingDuration = Math.min(Math.floor(responseText.length / 100) * 1000, 5000);
        await new Promise(resolve => setTimeout(resolve, typingDuration + randomDelay(500, 1500)));

        // [ANTI-BANNED] 5. Hapus status "Sedang mengetik..." lalu kirim balasan
        await chat.clearState();
        await msg.reply(responseText);

        logger.info(`[AI-SUCCESS] Balasan AI terkirim ke ${senderNumber}`);

    } catch (error) {
        console.error('[Error AI Handler]:', error);
        logger.error(`[AI-ERROR] Gagal merespons ${senderNumber}: ${error.message}`);

        // [ANTI-BANNED] Pastikan status "mengetik" dimatikan jika terjadi error server
        if (chat) await chat.clearState();

        await msg.reply('_[!] Transmisi AI terputus: Gangguan koneksi API atau limit semua Key._');
    }
};

module.exports = { handleAIPrompt };