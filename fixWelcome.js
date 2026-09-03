const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/WelcomeGate.tsx', 'utf-8');

c = c.replace(
  "display: 'flex', alignItems: 'center', justifyContent: 'center',",
  "display: 'flex', alignItems: 'flex-start', justifyContent: 'center',"
);

c = c.replace(
  "padding: '1rem',",
  "padding: '2rem 1rem', overflowY: 'auto',"
);

c = c.replace(
  "maxWidth: '450px',",
  "maxWidth: '450px',\n        margin: 'auto',"
);

fs.writeFileSync('src/components/widgets/WelcomeGate.tsx', c);
console.log('Fixed WelcomeGate');
