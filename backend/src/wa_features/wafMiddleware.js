const logger = require('../utils/logger');

const SIGNATURES = {
    sqlInjection: /(UNION\s+ALL\s+SELECT|UNION\s+SELECT|CONCAT\s*\(|WAITFOR\s+DELAY|SELECT\s+.*\s+FROM|UPDATE\s+.*\s+SET|DROP\s+TABLE|INSERT\s+INTO|EXEC(\s|\+)+(s|x)p\w+)/i,
    xss: /(<|%3C).*?(script|iframe|object|embed|applet|meta|style|form|svg|body|link).*?(>|%3E)|(javascript:|vbscript:|data:text\/html|onmouseover=|onerror=|onload=)/i,
    lfi: /((\.\.\/|\.\.\\)+|etc\/passwd|boot\.ini|windows\/win\.ini|sysprep\.inf)/i,
    sensitiveFiles: /\.(env|git|svn|log|bak|ini|conf|sql|sh|yml|md|tgz|zip|tar|swp)$|\/(wp-config\.php|config\.php)/i,
    badBots: /(nikto|sqlmap|acunetix|dirbuster|nmap|zmeu|masscan|havij|arachni|hydra|w3af|netsparker)/i,
    nullByte: /%00|\x00/i
};

const scanPayload = (data, pattern) => {
    if (!data) return false;
    if (typeof data === 'string') return pattern.test(data);
    if (typeof data === 'object') {
        try {
            return pattern.test(JSON.stringify(data));
        } catch (error) {
            return false;
        }
    }
    return false;
};

const wafMiddleware = (req, res, next) => {
    const url = req.originalUrl || req.url;
    const userAgent = req.get('user-agent') || '';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    let decodedUrl = url;
    try {
        decodedUrl = decodeURIComponent(decodeURIComponent(url));
    } catch (error) {
        // URL yang tidak dapat didekode tetap diperiksa dalam bentuk aslinya.
    }

    let blockReason = null;
    if (SIGNATURES.nullByte.test(decodedUrl)) blockReason = 'Null Byte Injection';
    else if (SIGNATURES.badBots.test(userAgent)) blockReason = 'Malicious Scanner Bot';
    else if (SIGNATURES.sensitiveFiles.test(decodedUrl)) blockReason = 'Sensitive File Access';
    else if (SIGNATURES.lfi.test(decodedUrl)) blockReason = 'Path Traversal / LFI';
    else if (SIGNATURES.sqlInjection.test(decodedUrl)) blockReason = 'SQL Injection (URL)';
    else if (SIGNATURES.xss.test(decodedUrl)) blockReason = 'XSS Payload (URL)';
    else if (req.body && Object.keys(req.body).length > 0) {
        if (scanPayload(req.body, SIGNATURES.sqlInjection)) blockReason = 'SQL Injection (Body Payload)';
        else if (scanPayload(req.body, SIGNATURES.xss)) blockReason = 'XSS Payload (Body Payload)';
        else if (scanPayload(req.body, SIGNATURES.lfi)) blockReason = 'Path Traversal (Body Payload)';
    }

    if (blockReason) {
        logger.warn(`[WAF-BLOCK] IP: ${clientIp} | Tipe: ${blockReason} | Target: ${url}`);
        return res.status(403).json({ status: 'error', message: 'Request diblokir oleh WAF.' });
    }
    return next();
};

module.exports = wafMiddleware;
