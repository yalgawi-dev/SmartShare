const fs = require('fs');
let file = 'src/components/widgets/Partners/WelcomeGate.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "resolvedToken, \\n      currentMember?.sharePercentage",
  "resolvedToken, \\n      resolvedToken, \\n      currentMember?.sharePercentage"
);

fs.writeFileSync(file, content, 'utf8');
