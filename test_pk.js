const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let pk = "";
env.split('\n').forEach(line => {
  if (line.startsWith('FIREBASE_PRIVATE_KEY')) {
    pk = line.split('=')[1];
  }
});
console.log(pk.substring(0, 50));
