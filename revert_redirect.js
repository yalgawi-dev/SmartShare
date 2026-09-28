const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /signInWithRedirect\(auth, provider\)\.catch\(e => \{\s*setPopupBlocked\(true\);\s*\}\);/;
const replace = `setPopupBlocked(true);`;

if (regex.test(content)) {
  content = content.replace(regex, replace);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Reverted Redirect");
} else {
  console.log("Could not find signInWithRedirect catch block");
}
