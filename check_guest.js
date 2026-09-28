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

async function checkGuestCreator() {
  const t1 = 'guest_7ceavy18e';
  const t2 = 'guest_mtwqmwml9';
  
  const q1 = await db.collection('spaces').where('creatorId', '==', t1).get();
  console.log(`Spaces where creator is ${t1}: ${q1.size}`);
  
  const q2 = await db.collection('spaces').where('creatorId', '==', t2).get();
  console.log(`Spaces where creator is ${t2}: ${q2.size}`);
}
checkGuestCreator().catch(console.error);
