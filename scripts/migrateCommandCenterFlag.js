// scripts/migrateCommandCenterFlag.js

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { ensureCommandCenterFlag } = require('../src/lib/partnerUtils');

// Firebase config – same as src/lib/firebase.ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dummy',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dummy',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'dummy',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'dummy',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

(async () => {
  try {
    const spacesSnap = await getDocs(collection(db, 'spaces'));
    for (const spaceDoc of spacesSnap.docs) {
      await ensureCommandCenterFlag(spaceDoc.id);
    }
    console.log('Migration completed');
  } catch (e) {
    console.error('Migration error', e);
  }
})();
