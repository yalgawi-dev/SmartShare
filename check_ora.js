const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })});
}
const db = getFirestore();
const auth = getAuth();

async function checkUser() {
  const uid = 'zeKlfsQAicNRbQNzIE6RxgDTssx2';
  const docSnap = await db.collection('users').doc(uid).get();
  if (docSnap.exists) {
    console.log("Firestore User:", JSON.stringify(docSnap.data(), null, 2));
  } else {
    console.log("Not in Firestore users collection.");
  }
  
  try {
    const authUser = await auth.getUser(uid);
    console.log("Auth User:", authUser.toJSON());
  } catch (e) {
    console.log("Auth user not found.", e.message);
  }
  
  // Check the space "דירה באורה"
  const spaceId = 'ad178852-cc69-4dfc-81f8-5ae8eecec1f9';
  const spaceDoc = await db.collection('spaces').doc(spaceId).get();
  if (spaceDoc.exists) {
    const spaceData = spaceDoc.data();
    console.log("Space Invoices count:", spaceData.invoices ? spaceData.invoices.length : 0);
    const total = spaceData.invoices ? spaceData.invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0) : 0;
    console.log("Space Invoices total:", total);
  }
}

checkUser().catch(console.error);
