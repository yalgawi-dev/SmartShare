require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
  })
});

async function run() {
  try {
    const phone = '+972524740288';
    const userRecord = await admin.auth().getUserByPhoneNumber(phone);
    console.log(`Found user: ${userRecord.uid}`);
    
    await admin.auth().deleteUser(userRecord.uid);
    console.log(`Successfully deleted user with phone ${phone} from Auth`);
    
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).delete();
    console.log("Deleted from Firestore users collection");
    
  } catch(e) {
    if (e.code === 'auth/user-not-found') {
      console.log('User not found in Auth, nothing to delete.');
    } else {
      console.error(e);
    }
  }
  process.exit(0);
}
run();
