const logger = require('../utils/logger');

// =====================================================================
// CYBER-X NODE.JS WAF (WEB APPLICATION FIREWALL) - ENTERPRISE EDITION
// =====================================================================

// --- KUMPULAN POLA SERANGAN (SIGNATURES) ---
const SIGNATURES = {
    // 1. Serangan SQL Injection (SQLi)
    sqlInjection: /(UNION\s+ALL\s+SELECT|UNION\s+SELECT|CONCAT\s*\(|WAITFOR\s+DELAY|SELECT\s+.*\s+FROM|UPDATE\s+.*\s+SET|DROP\s+TABLE|INSERT\s+INTO|EXEC(\s|\+)+(s|x)p\w+)/i,
    
    // 2. Serangan Cross-Site Scripting (XSS)
    xss: /(<|%3C).*?(script|iframe|object|embed|applet|meta|style|form|svg|body|link).*?(>|%3E)|(javascript:|vbscript:|data:text\/html|onmouseover=|onerror=|onload=)/i,
    
    // 3. Path Traversal & Local File Inclusion (LFI)
    lfi: /((\.\.\/|\.\.\\)+|etc\/passwd|boot\.ini|windows\/win\.ini|sysprep\.inf)/i,
    
    // 4. Akses File Sensitif & Source Code
    sensitiveFiles: /\.(env|git|svn|log|bak|ini|conf|sql|sh|yml|md|tgz|zip|tar|swp)$|\/(wp-config\.php|config\.php)/i,
    
    // 5. Bot Scanner & Alat Hacking
    badBots: /(nikto|sqlmap|acunetix|dirbuster|nmap|zmeu|masscan|havij|arachni|hydra|w3af|netsparker)/i,

    // 6. Null Byte Injection (Trik memotong string ekstensi)
    nullByte: /%00|\x00/i
};

// --- FUNGSI PEMERIKSAAN ---
const scanPayload = (data, pattern) => {
    if (!data) return false;
    if (typeof data === 'string') return pattern.test(data);
    if (typeof data === 'object') {
        // Mengubah object (seperti req.body json) menjadi string untuk di-scan
        try {
            const stringified = JSON.stringify(data);
            return pattern.test(stringified);
        } catch (e) {
            return false;
        }
    }
    return false;
};

const wafMiddleware = (req, res, next) => {
    // 1. Ekstraksi Data Klien
    const url = req.originalUrl || req.url;
    const userAgent = req.headers['user-agent'] || '';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // 2. Decode URL untuk mencegah trik Double URL Encoding
    let decodedUrl = url;
    try {
        decodedUrl = decodeURIComponent(url);
        // Lakukan decode kedua kali jika hacker menggunakan double encoding (%2527 -> %27 -> ')
        decodedUrl = decodeURIComponent(decodedUrl);
    } catch (e) {
        // Abaikan jika gagal decode (misal karakter invalid)
    }

    // 3. Persiapkan variabel untuk mencatat alasan pemblokiran
    let blockReason = null;

    // --- PROSES PEMINDAIAN (SCANNING) ---

    // A. Cek Null Byte Injection
    if (SIGNATURES.nullByte.test(decodedUrl)) blockReason = 'Null Byte Injection';

    // B. Cek Bot Scanner di User-Agent
    else if (SIGNATURES.badBots.test(userAgent)) blockReason = `Malicious Scanner Bot (${userAgent.substring(0, 20)}...)`;

    // C. Cek Pencarian File Sensitif di URL
    else if (SIGNATURES.sensitiveFiles.test(decodedUrl)) blockReason = 'Sensitive File Access';

    // D. Cek Path Traversal (LFI)
    else if (SIGNATURES.lfi.test(decodedUrl)) blockReason = 'Path Traversal / LFI';

    // E. Cek SQLi & XSS di URL (GET Parameters)
    else if (SIGNATURES.sqlInjection.test(decodedUrl)) blockReason = 'SQL Injection (URL)';
    else if (SIGNATURES.xss.test(decodedUrl)) blockReason = 'XSS Payload (URL)';

    // F. Cek SQLi & XSS di Body Data (POST / PUT Parameters JSON/Form)
    else if (req.body && Object.keys(req.body).length > 0) {
        if (scanPayload(req.body, SIGNATURES.sqlInjection)) blockReason = 'SQL Injection (Body Payload)';
        else if (scanPayload(req.body, SIGNATURES.xss)) blockReason = 'XSS Payload (Body Payload)';
        else if (scanPayload(req.body, SIGNATURES.lfi)) blockReason = 'Path Traversal (Body Payload)';
    }

    // --- EKSEKUSI PEMBLOKIRAN ---
    if (blockReason) {
        logger.warn(`[WAF-BLOCK] IP: ${clientIp} | Tipe: ${blockReason} | Target: ${url}`);
        
        // Memutuskan koneksi dengan respons HTML peringatan bergaya militer/cyber
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>403 Forbidden - WAF</title>
                <style>
                    body { background-color: #0d0d0d; color: #ff3333; font-family: monospace; text-align: center; margin-top: 10%; }
                    .box { border: 2px solid #ff3333; padding: 30px; display: inline-block; box-shadow: 0 0 20px #ff3333; }
                    h1 { margin: 0 0 10px 0; }
                    p { color: #cccccc; margin: 5px 0; }
                    .ip { color: #00ffcc; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>🛑 ACCESS DENIED</h1>
                    <p>Sistem Web Application Firewall (WAF) telah memblokir permintaan Anda.</p>
                    <p>Aktivitas mencurigakan terdeteksi dari IP Anda: <span class="ip">${clientIp}</span></p>
                    <p><i>Incident Logged.</i></p>
                </div>
            </body>
            </html>
        `);
    }

    // Jika aman, persilakan masuk ke rute aplikasi Express berikutnya
    next();
};

module.exports = wafMiddleware;