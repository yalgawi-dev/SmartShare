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

async function getSpace(id) {
  const s = await db.collection('spaces').doc(id).get();
  console.log(`Space ${id} exists?`, s.exists);
  if (s.exists) console.log(JSON.stringify(s.data(), null, 2));
}

getSpace('8905af92-b617-4634-8af3-33dcac7d3ddc').catch(console.error);
getSpace('a42b8407-8c7c-46f5-9f3e-5e8c9fc991d4').catch(console.error);
