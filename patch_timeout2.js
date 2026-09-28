const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /onClick=\{\(\) => \{\r?\n\s+const url = \(window\.location\.href \+ \(window\.location\.href\.includes\('\?'\) \? '&' : '\?'\) \+ 'action=login'\)\.replace\(\/\^https\?:\\\\\/\\\\\/\\/\, ''\);\r?\n\s+window\.location\.href = `intent:\/\/\$\{url\}#Intent;scheme=https;package=com\.android\.chrome;end`;\r?\n\s+\}\}/;

const newCode = `onClick={() => {
                      setTimeout(() => {
                        const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');
                        window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                      }, 100);
                    }}`;

content = content.replace(regex, newCode);
fs.writeFileSync(file, content, 'utf8');
console.log("Patched AuthModal.tsx with setTimeout regex");
