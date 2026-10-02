require('dotenv').config({ path: '.env.local' });
const { adminDb, adminMessaging } = require('./src/lib/firebaseAdmin.ts');

async function run() {
  const users = await adminDb.collection('users').get();
  users.forEach(doc => {
    const data = doc.data();
    if (data.realName && data.realName.includes('יהודה')) {
      console.log('Found Yehuda:', doc.id, 'Tokens count:', data.fcmTokens ? data.fcmTokens.length : 0, 'Phone:', data.phone);
    }
  });
}
run();
