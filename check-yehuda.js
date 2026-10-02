require('dotenv').config({ path: '.env.local' });
const { adminDb } = require('./src/lib/firebaseAdmin.ts');

async function run() {
  const yehudaIds = ['STZrOUeCU8VO03fgKbM7pZ8BXrm1', 'YloSiUmQemhXj0rMhe7O3i8p8pF3', 'jTW0URwaZnejqzwDCpDZMZFvtsK2', 'Bb0PavnSfkMmUCJLVsjA7xLtBqg2'];
  for (const id of yehudaIds) {
    const doc = await adminDb.collection('users').doc(id).get();
    const data = doc.data();
    console.log(`\n=== ID: ${id} ===`);
    console.log('realName:', data.realName);
    console.log('phone:', data.phone);
    console.log('email:', data.email);
    console.log('fcmTokens:', JSON.stringify(data.fcmTokens));
    // Check spaceKeys - the old phone-based token system
    console.log('spaceKeys keys:', data.spaceKeys ? Object.keys(data.spaceKeys).join(', ') : 'none');
  }
}
run();
