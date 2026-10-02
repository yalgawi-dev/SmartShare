const fs = require('fs');
let txt = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');
txt = txt.replace(
  'export interface UserProfile {',
  'export interface UserProfile {\n  fcmTokens?: string[];'
);
fs.writeFileSync('src/app/context/AuthContext.tsx', txt);
console.log('Added fcmTokens to UserProfile');
