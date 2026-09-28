const fs = require('fs');
const file = 'src/app/settings/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { auth }')) {
  content = content.replace("import { useAuth }", "import { auth } from '@/lib/firebase';\nimport { useAuth }");
  fs.writeFileSync(file, content, 'utf8');
  console.log("Added import { auth }");
}
