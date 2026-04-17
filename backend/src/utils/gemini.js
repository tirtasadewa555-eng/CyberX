require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger'); // Mengambil logger dari folder yang sama

// Parsing API Keys dari .env (Load Balancing)
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
    
    currentKeyIndex = (currentKeyIndex + 1) % geminiApiKeys.length;
    return { key, index: indexUsed };
}

/**
 * Memproses prompt ke Gemini dengan sistem Failover
 * @param {string} prompt - Instruksi untuk AI
 */
async function analyzeWithGemini(prompt) {
    let attempts = 0;
    const maxAttempts = geminiApiKeys.length;

    while (attempts < maxAttempts) {
        const { key, index } = getNextGeminiKey();
        
        try {
            const genAI = new GoogleGenerativeAI(key);
            
            // Menggunakan model 1.5-flash-latest yang lebih stabil & support versi terbaru
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            
            const result = await model.generateContent(prompt);
            return result.response.text();
            
        } catch (error) {
            // Mencatat error spesifik tiap key ke file log
            logger.warn(`[AI-ROUTER] API Key #${index + 1} Gagal (Error: ${error.message})`);
            attempts++;
            
            if (attempts >= maxAttempts) {
                logger.error('[AI-CRITICAL] Semua barisan API Key gagal merespons!');
                throw new Error('Seluruh API Key Gemini kehabisan kuota atau mengalami gangguan server.');
            }
            logger.info('[AI-ROUTER] Mengalihkan trafik (Failover) ke API Key selanjutnya...');
        }
    }
}

module.exports = { analyzeWithGemini };