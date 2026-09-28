const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const url = window.location.href.replace(/^https?:\\\\/\\\\//, '');",
  "const url = window.location.href.replace(/^https?:\\\\/\\\\//, '') + '?action=login';"
);
// Also fix the unescaped backslashes in my script if they were compiled differently
content = content.replace(
  "const url = window.location.href.replace(/^https?:\\/\\//, '');",
  "const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');"
);


fs.writeFileSync(file, content, 'utf8');
console.log("Patched AuthModal.tsx with action=login");
