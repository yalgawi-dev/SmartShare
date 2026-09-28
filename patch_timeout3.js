const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                    onClick={() => {
                      const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');
                      window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                    }}`;

// Because of Windows CRLF, let's normalize strings
const normalize = str => str.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(targetStr))) {
  content = normalize(content).replace(normalize(targetStr), `                    onClick={() => {
                      setTimeout(() => {
                        const url = (window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'action=login').replace(/^https?:\\/\\//, '');
                        window.location.href = \`intent://\${url}#Intent;scheme=https;package=com.android.chrome;end\`;
                      }, 100);
                    }}`);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched successfully with normalization");
} else {
  console.log("Not found");
}
