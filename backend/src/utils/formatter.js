/**
 * Memformat nomor telepon ke standar WhatsApp Web JS (@c.us)
 * @param {string} number - Nomor HP (misal: 62812xxx atau +62812xxx)
 * @returns {string} Nomor yang sudah diformat
 */
const formatPhoneNumber = (number) => {
    let formatted = number.replace(/\D/g, ''); // Hapus semua karakter non-angka
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1); // Ganti 0 di depan dengan 62
    }
    if (!formatted.endsWith('@c.us')) {
        formatted += '@c.us';
    }
    return formatted;
};

module.exports = { formatPhoneNumber };