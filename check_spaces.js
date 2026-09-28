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

async function checkSpaces(oldId) {
  const spaces = await db.collection('spaces').get();
  console.log(`Total spaces: ${spaces.size}`);
  let count = 0;
  spaces.forEach(doc => {
    const data = doc.data();
    let hasRef = false;
    if (data.creatorId === oldId) hasRef = true;
    if (data.partners) {
      // is partners array of objects?
      if (Array.isArray(data.partners)) {
        if (data.partners.some(p => p === oldId || p.id === oldId || p.userId === oldId)) {
          hasRef = true;
        }
      } else if (typeof data.partners === 'object') {
        if (Object.keys(data.partners).includes(oldId)) hasRef = true;
      }
    }
    
    if (hasRef) {
      count++;
      console.log(`Found in space: ${doc.id}`);
    }
  });
  console.log(`Total spaces with ref: ${count}`);
}

checkSpaces('QtFOpDR3cRbyi7494Ah0bxf60VF2').catch(console.error);
