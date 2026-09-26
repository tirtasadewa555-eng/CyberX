const { execFile } = require('child_process');
const net = require('net');
const logger = require('../utils/logger');

const MAX_OUTPUT_LENGTH = 3500;
const SCAN_TIMEOUT_MS = 45 * 1000;
let scanInProgress = false;

const isValidDomain = target => {
    if (target.length > 253 || target.includes('..')) return false;
    return target.split('.').every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
};

const isPrivateAddress = target => {
    if (net.isIP(target) !== 4) return false;
    const [first, second] = target.split('.').map(Number);
    return first === 10 || first === 127 || first === 0 || first >= 224 ||
        (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168);
};

const handleNetworkScan = async (msg, target) => {
    const normalizedTarget = String(target || '').trim().toLowerCase();
    if (!normalizedTarget || (!net.isIP(normalizedTarget) && !isValidDomain(normalizedTarget))) {
        return msg.reply('Format target tidak valid. Gunakan alamat IPv4 publik atau domain yang valid.');
    }
    if (isPrivateAddress(normalizedTarget) || normalizedTarget === 'localhost') {
        return msg.reply('Target jaringan privat atau lokal tidak diizinkan.');
    }
    if (scanInProgress) return msg.reply('Pemindaian lain sedang berjalan. Coba lagi setelah selesai.');

    scanInProgress = true;
    await msg.reply(`Memulai pemindaian terbatas pada target: ${normalizedTarget}`);
    logger.info(`[SCAN] Nmap dimulai untuk ${normalizedTarget}.`);

    execFile('nmap', ['-F', '-sV', '--host-timeout', '30s', '--max-retries', '1', normalizedTarget], {
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: 64 * 1024,
        windowsHide: true
    }, (error, stdout, stderr) => {
        scanInProgress = false;
        if (error) {
            logger.error(`[SCAN] Gagal untuk ${normalizedTarget}: ${error.message}`);
            return msg.reply('Pemindaian gagal atau melewati batas waktu.');
        }
        if (stderr) logger.warn(`[SCAN] Nmap stderr: ${stderr.slice(0, 500)}`);

        const output = (stdout || 'Tidak ada hasil.').trim();
        const truncated = output.length > MAX_OUTPUT_LENGTH;
        const safeOutput = output.slice(0, MAX_OUTPUT_LENGTH);
        const result = [
            '*HASIL PEMINDAIAN CYBER-X*',
            `Target: ${normalizedTarget}`,
            '',
            '```',
            safeOutput,
            '```',
            truncated ? '_Output dipotong karena melebihi batas pesan._' : '_Audit selesai._'
        ].join('\n');
        logger.info(`[SCAN] Selesai untuk ${normalizedTarget}.`);
        return msg.reply(result);
    });
};

module.exports = { handleNetworkScan };
