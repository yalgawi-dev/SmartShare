const fs = require('fs');
const file = 'src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('PhoneLinkEnforcer')) {
  content = content.replace('import AuthModal from \'../components/auth/AuthModal\';', 'import AuthModal from \'../components/auth/AuthModal\';\nimport PhoneLinkEnforcer from \'../components/auth/PhoneLinkEnforcer\';');
  content = content.replace('<div className={styles.container}>', '<div className={styles.container}>\n      <PhoneLinkEnforcer />');
  fs.writeFileSync(file, content, 'utf8');
  console.log("page.tsx updated");
} else {
  console.log("Already updated");
}
