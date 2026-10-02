require('dotenv').config({ path: '.env.local' });
const { adminDb } = require('./src/lib/firebaseAdmin.ts');

async function run() {
  // 1. Clean dummy token from test
  await adminDb.collection('users').doc('Bb0PavnSfkMmUCJLVsjA7xLtBqg2').update({ fcmTokens: [] });
  console.log('Cleaned dummy token');

  // 2. Ensure Yehuda primary ID has empty fcmTokens array (not undefined)
  await adminDb.collection('users').doc('STZrOUeCU8VO03fgKbM7pZ8BXrm1').update({ fcmTokens: [] });
  console.log('Reset Yehuda primary ID fcmTokens to []');

  // 3. Ensure Hilly has fcmTokens array
  await adminDb.collection('users').doc('jBBIbkW2Q7OMr4yaYutSGPKA9jF3').update({ fcmTokens: [] });
  console.log('Reset Hilly fcmTokens to []');

  console.log('Done. Now re-enable push from Settings page.');
}
run();
