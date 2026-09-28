const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `                    onClick={() => {
                      const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');
                      window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                    }}`;

const newCode = `                    onClick={() => {
                      setTimeout(() => {
                        const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');
                        window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                      }, 100);
                    }}`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched AuthModal.tsx with setTimeout");
} else {
  console.log("Could not find oldCode");
}
