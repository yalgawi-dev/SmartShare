import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let appInitialized = false;

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID) {
      const credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });
      
      initializeApp({ credential });
      appInitialized = true;
    } else {
      console.warn('Firebase Admin env vars missing. Skipping initialization during build phase.');
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.message);
  }
} else {
  appInitialized = true;
}

export const adminDb = appInitialized ? getFirestore() : (null as any);
export const adminMessaging = appInitialized ? getMessaging() : (null as any);
