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

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp({
  credential: cert({
    projectId: envVars.FIREBASE_PROJECT_ID,
    clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
    privateKey: envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

async function run() {
  try {
    const phone = '+972524740288';
    const auth = getAuth();
    const userRecord = await auth.getUserByPhoneNumber(phone);
    console.log(`Found user: ${userRecord.uid}`);
    await auth.deleteUser(userRecord.uid);
    console.log(`Successfully deleted user with phone ${phone} from Auth`);
  } catch(e) {
    console.error(e.message);
  }
  process.exit(0);
}
run();
