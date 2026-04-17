const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file'); // [PERBAIKAN DISINI]
const path = require('path');

// Format log: [Timestamp] [Level]: Pesan
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
);

// [PERBAIKAN DISINI] Menggunakan 'new DailyRotateFile'
const transport = new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/cyber-gateway-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,      // Kompres file log lama menjadi .gz
    maxSize: '20m',           // Ukuran max per file (20 Megabyte)
    maxFiles: '30d'           // Simpan log selama 30 hari terakhir
});

const logger = winston.createLogger({
    format: logFormat,
    transports: [
        transport,
        new winston.transports.Console() // Tetap tampilkan di terminal
    ]
});

module.exports = logger;