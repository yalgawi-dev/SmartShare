const fs = require('fs');
let c = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf-8');

c = c.replace(
  "import WelcomeGate from '../../../components/widgets/WelcomeGate';",
  "import WelcomeGate from '../../../components/widgets/Partners/WelcomeGate';"
);

c = c.replace(
  "import PendingApprovalBanner from '../../../components/widgets/PendingApprovalBanner';",
  "import PendingApprovalBanner from '../../../components/widgets/Partners/PendingApprovalBanner';"
);

fs.writeFileSync('src/app/space/[id]/page.tsx', c);
console.log('Fixed page.tsx imports');
