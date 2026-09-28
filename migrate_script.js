const admin = require('firebase-admin');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function migrateDoron() {
  const phone1 = '0524740288';
  const phone2 = '+972524740288';
  
  const usersRef = db.collection('users');
  const q1 = await usersRef.where('phone', '==', phone1).get();
  const q2 = await usersRef.where('phone', '==', phone2).get();
  
  const allDocs = [...q1.docs, ...q2.docs];
  
  console.log(`Found ${allDocs.length} user documents for Doron`);
  
  const docsData = allDocs.map(d => ({ id: d.id, data: d.data() }));
  
  // Also check Firebase Auth users directly
  const authUserByPhone = await auth.getUserByPhoneNumber(phone2).catch(() => null);
  console.log("Auth user by phone +972...", authUserByPhone ? authUserByPhone.uid : "not found");

  console.log(JSON.stringify(docsData, null, 2));
}

migrateDoron().catch(console.error);
