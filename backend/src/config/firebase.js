const admin = require('firebase-admin');
const path = require('path');

// Mengambil kredensial dari root folder backend (mundur dari config -> src -> backend)
const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

console.log('[+] Firebase Firestore Initialized');

module.exports = db;