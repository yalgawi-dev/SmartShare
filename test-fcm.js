require('dotenv').config({ path: '.env.local' });
const { adminDb, adminMessaging } = require('./src/lib/firebaseAdmin.ts');

async function run() {
  const users = await adminDb.collection('users').get();
  let yehuda = null;
  users.forEach(doc => {
    const data = doc.data();
    if (data.realName && data.realName.includes('יהודה')) {
      yehuda = { id: doc.id, ...data };
    }
  });

  if (!yehuda) {
    console.log('Yehuda not found');
    return;
  }
  
  console.log('Found Yehuda:', yehuda.id, 'Tokens count:', yehuda.fcmTokens ? yehuda.fcmTokens.length : 0);

  if (!yehuda.fcmTokens || yehuda.fcmTokens.length === 0) {
    console.log('No tokens to test.');
    return;
  }

  const message = {
    token: yehuda.fcmTokens[0],
    notification: { title: 'Test', body: 'Test body' },
    data: { tag: 'test-tag' },
    webpush: {
      fcmOptions: { link: '/' },
      notification: { title: 'Test', body: 'Test body', tag: 'test-tag' }
    }
  };

  try {
    const response = await adminMessaging.sendEach([message]);
    console.log('Response:', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('Fatal Error:', err);
  }
}
run();
