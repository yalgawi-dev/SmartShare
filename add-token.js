require('dotenv').config({ path: '.env.local' });
const { adminDb } = require('./src/lib/firebaseAdmin.ts');

async function run() {
  await adminDb.collection('users').doc('Bb0PavnSfkMmUCJLVsjA7xLtBqg2').update({
    fcmTokens: ['dummy-token-for-testing-123']
  });
  console.log('Added dummy token');
}
run();
