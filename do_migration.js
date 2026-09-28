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

async function run() {
  const oldId = 'QtFOpDR3cRbyi7494Ah0bxf60VF2';
  const newId = '3vJqgPULoLcJG9gTutEeW4qLV1z1';

  const oldRef = db.collection('users').doc(oldId);
  const newRef = db.collection('users').doc(newId);

  const oldDoc = await oldRef.get();
  if (!oldDoc.exists) {
    console.log("Old doc not found!");
    return;
  }
  
  const oldData = oldDoc.data();
  console.log("Old space keys:", oldData.spaceKeys);

  // Update new doc
  await newRef.update({
    spaceKeys: oldData.spaceKeys || {},
    realName: oldData.realName || 'דורן חדד',
    nickname: oldData.nickname || 'דורן',
    isAdmin: oldData.isAdmin || false,
    email: oldData.email || ''
  });

  console.log("Migration complete!");
}

run().catch(console.error);
