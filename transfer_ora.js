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

async function transferOra() {
  const spaceId = 'ad178852-cc69-4dfc-81f8-5ae8eecec1f9';
  const newOwnerUid = '3vJqgPULoLcJG9gTutEeW4qLV1z1'; // Doron's new phone account
  
  const spaceRef = db.collection('spaces').doc(spaceId);
  const spaceDoc = await spaceRef.get();
  
  if (!spaceDoc.exists) return console.log("Space not found!");
  
  await spaceRef.update({
    status: 'active',
    creatorId: newOwnerUid,
    deletionScheduledFor: require('firebase-admin/firestore').FieldValue.delete()
  });
  
  console.log("Transferred 'דירה באורה' to Doron's phone account and restored it to active!");
}

transferOra().catch(console.error);
