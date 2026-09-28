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

async function checkReferences(oldId) {
  console.log(`Checking references for ${oldId}...`);
  
  // Spaces where creator
  const spacesAsCreator = await db.collection('spaces').where('creatorId', '==', oldId).get();
  console.log(`Spaces as creator: ${spacesAsCreator.size}`);
  
  // Spaces where partner - partners is array of objects { id, role... } or array of strings?
  // Let's check a space structure
  const spacesRef = await db.collection('spaces').limit(1).get();
  if (!spacesRef.empty) {
    console.log("Sample space partners:", JSON.stringify(spacesRef.docs[0].data().partners));
  }
  
  // Invoices where paidBy
  const invoicesAsPaidBy = await db.collection('invoices').where('paidBy', '==', oldId).get();
  console.log(`Invoices as paidBy: ${invoicesAsPaidBy.size}`);
  
  const invoicesAsCreator = await db.collection('invoices').where('creatorId', '==', oldId).get();
  console.log(`Invoices as creator: ${invoicesAsCreator.size}`);
}

checkReferences('QtFOpDR3cRbyi7494Ah0bxf60VF2').catch(console.error);
