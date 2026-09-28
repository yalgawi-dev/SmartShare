const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })});
}
const db = getFirestore();

async function restore() {
  await db.collection('spaces').doc('8905af92-b617-4634-8af3-33dcac7d3ddc').update({
    status: 'active'
  });
  console.log("Restored space 8905af92!");
}
restore().catch(console.error);
