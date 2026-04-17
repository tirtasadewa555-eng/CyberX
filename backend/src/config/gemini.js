require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger'); // Sesuaikan path jika berbeda

// Parsing API Keys dari .env (bisa dipisah dengan koma)
// Mendukung fallback ke GEMINI_API_KEY tunggal jika GEMINI_API_KEYS belum disetel
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const geminiApiKeys = rawKeys.split(',').map(key => key.trim()).filter(key => key.length > 0);

if (geminiApiKeys.length === 0) {
    console.warn('\n[!] CRITICAL WARNING: API Key Gemini tidak ditemukan di file .env!');
} else {
    console.log(`[+] Gemini Load Balancer Aktif (Menyebarkan beban ke ${geminiApiKeys.length} API Key)`);
}

let currentKeyIndex = 0;

/**
 * Mengambil API Key selanjutnya (Sistem Round-Robin)
 */
function getNextGeminiKey() {
    if (geminiApiKeys.length === 0) throw new Error("API Key Gemini kosong. Cek file .env Anda!");
    const key = geminiApiKeys[currentKeyIndex];
    const indexUsed = currentKeyIndex;
    
    // Geser antrean ke key selanjutnya (kembali ke 0 jika sudah di ujung)
    currentKeyIndex = (currentKeyIndex + 1) % geminiApiKeys.length;
    return { key, index: indexUsed };
}

/**
 * Memproses prompt ke Gemini menggunakan fitur Load Balancing & Auto-Failover
 * @param {string} prompt - Teks pertanyaan / instruksi
 */
async function analyzeWithGemini(prompt) {
    let attempts = 0;
    const maxAttempts = geminiApiKeys.length;

    // Loop Auto-Failover: Coba terus sampai ada API Key yang berhasil
    while (attempts < maxAttempts) {
        const { key, index } = getNextGeminiKey();
        
        try {
            // logger.info(`[AI-ROUTER] Routing prompt melalui API Key #${index + 1}`);
            
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const result = await model.generateContent(prompt);
            return result.response.text();
            
        } catch (error) {
            logger.warn(`[AI-ROUTER] API Key #${index + 1} Gagal (Error: ${error.message})`);
            attempts++;
            
            if (attempts >= maxAttempts) {
                logger.error('[AI-CRITICAL] Semua barisan API Key gagal merespons! Sistem AI down sementara.');
                throw new Error('Seluruh API Key Gemini kehabisan kuota atau mengalami gangguan server.');
            }
            
            logger.info('[AI-ROUTER] Mengalihkan trafik (*Failover*) ke API Key selanjutnya...');
        }
    }
}

module.exports = { analyzeWithGemini };