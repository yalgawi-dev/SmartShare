const fs = require('fs');
const file = 'src/components/auth/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{mode !== 'forgot' && \(\s*<>\s*<button type="button" onClick=\{\(\) => setMode\('phone'\)\}/;
const replace = `{(mode === 'login' || mode === 'register') && (\n          <>\n            <button type="button" onClick={() => setMode('phone')}`;

if (regex.test(content)) {
  content = content.replace(regex, replace);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched visibility");
} else {
  console.log("Failed to match regex");
}
