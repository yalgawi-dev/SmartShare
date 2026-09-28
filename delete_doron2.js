const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    let val = rest.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    envVars[key.trim()] = val;
  }
});

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: envVars.FIREBASE_PROJECT_ID,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    privateKey: (envVars.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n')
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
