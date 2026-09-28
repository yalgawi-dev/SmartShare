const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = "const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');";
const btnStart = content.lastIndexOf('onClick={() => {', content.indexOf(anchor));
const btnEnd = content.indexOf('}}', content.indexOf(anchor)) + 2;

const oldCode = content.substring(btnStart, btnEnd);
const newCode = `onClick={() => {
                    setTimeout(() => {
                      const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');
                      window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                    }, 100);
                  }}`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(file, content, 'utf8');
console.log("Patched successfully");
