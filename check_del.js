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

async function checkDeleted() {
  const q = await db.collection('spaces').where('status', '==', 'pending_deletion').get();
  console.log(`Total deleted spaces: ${q.size}`);
  q.forEach(doc => {
    const d = doc.data();
    console.log(`- Space ${doc.id}: title=${d.title}, creatorId=${d.creatorId}`);
  });
}
checkDeleted().catch(console.error);
