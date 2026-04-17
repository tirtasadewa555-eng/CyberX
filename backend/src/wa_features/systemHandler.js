const si = require('systeminformation');

const handleSystemInfo = async (msg) => {
    try {
        // Mengambil data CPU, Memory, OS, dan Disk secara paralel
        const [cpu, mem, os, disk] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.osInfo(),
            si.fsSize()
        ]);

        // Hitung penggunaan RAM dalam GB
        const usedMem = (mem.active / 1024 / 1024 / 1024).toFixed(2);
        const totalMem = (mem.total / 1024 / 1024 / 1024).toFixed(2);
        const memPercent = ((mem.active / mem.total) * 100).toFixed(1);

        // Hitung penggunaan Disk Utama (biasanya indeks 0 atau cari yang mount '/')
        const mainDisk = disk.find(d => d.mount === '/') || disk[0];
        const diskUsed = (mainDisk.used / 1024 / 1024 / 1024).toFixed(2);
        const diskTotal = (mainDisk.size / 1024 / 1024 / 1024).toFixed(2);

        const infoMessage = `
🖥️ *SYSTEM MONITOR - VPS HACKERLAB*

📌 *OS:* ${os.distro} ${os.release}
🚀 *CPU:* ${cpu.manufacturer} ${cpu.brand}
⏲️ *Uptime:* ${(si.time().uptime / 3600).toFixed(1)} jam

📊 *RESOURCE USAGE:*
• *RAM:* ${usedMem}GB / ${totalMem}GB (${memPercent}%)
• *Disk:* ${diskUsed}GB / ${diskTotal}GB (${mainDisk.use}%)

🔌 *NETWORK:*
• *Hostname:* ${os.hostname}
• *Port Active:* 3008

_Status: System Operational_
        `.trim();

        await msg.reply(infoMessage);

    } catch (error) {
        console.error('SysInfo Error:', error);
        await msg.reply('_[!] Gagal mengambil data sistem._');
    }
};

module.exports = { handleSystemInfo };