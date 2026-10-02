require('dotenv').config({ path: '.env.local' });
const { adminDb } = require('./src/lib/firebaseAdmin.ts');

async function run() {
  const users = await adminDb.collection('users').get();
  users.forEach(doc => {
    const data = doc.data();
    const tokens = data.fcmTokens ? data.fcmTokens.length : 0;
    console.log(`ID: ${doc.id} | Name: ${data.realName || data.nickname || 'N/A'} | Phone: ${data.phone} | FCM Tokens: ${tokens}`);
  });
}
run();
