const fs = require('fs');
let txt = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');

const searchImports = "import { auth, db, googleProvider } from '@/lib/firebase';";
const replaceImports = "import { auth, db, googleProvider } from '@/lib/firebase';\nimport { setupForegroundFCM } from '@/utils/notifications';";
txt = txt.replace(searchImports, replaceImports);

const searchInit = "getRedirectResult(auth).then(res =>";
const replaceInit = "setupForegroundFCM();\n    getRedirectResult(auth).then(res =>";
txt = txt.replace(searchInit, replaceInit);

fs.writeFileSync('src/app/context/AuthContext.tsx', txt);
console.log('Added foreground FCM setup to AuthContext');
